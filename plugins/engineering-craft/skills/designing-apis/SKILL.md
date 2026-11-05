---
name: designing-apis
description: Use when adding or changing an HTTP API, endpoint, error format, pagination, webhook sender or receiver, API versioning, rate limit, or generated client. Also when OpenAPI, Spectral, oasdiff or breaking changes come up. Not for internal function signatures, nor for retry and duplicate handling inside a handler (hardening-distributed-systems).
---

# Designing APIs

The contract comes first and is the source of truth. FastAPI and Pydantic models produce the OpenAPI document, TypeScript clients are generated from it, and two automated gates (lint and breaking-change diff) decide whether a change ships.

## When to use

- New endpoint, new resource, new webhook, or a change to a response shape.
- Choosing error format, pagination, idempotency, versioning or rate limits.
- Wiring the TS client to the backend, or a frontend type drifting from the server.

## When not to use

- Making handlers safe against duplicates and partial failure: `hardening-distributed-systems` (this skill defines the client-visible contract only).
- Auth and authorization review: `reviewing-security`.
- Release and rollback: `ops-and-sre:releasing-safely`.
- Tools exposed to a model over the Model Context Protocol: `building-mcp-servers`.

## Procedure

### 1. Model the resource and the change

Write down: the resource nouns, who calls the API (own frontend, partners, webhooks to others), and whether any consumer cannot be updated in step with the server. Assume any observable behaviour will be depended on (Hyrum's law): field order, error text, even undocumented nulls. Prefer adding over changing.

**Done when:** each endpoint has a noun, a verb, an owner and a list of known consumers.

### 2. Write the contract first

Define Pydantic request and response models and route signatures in FastAPI before the handler bodies. Give every model a description, examples and explicit `response_model`. Declare each error response with `responses=` using the problem model. Export the schema:

```bash
python -c "import json; from app.main import app; print(json.dumps(app.openapi(), indent=2))" > openapi.json
```

Generate the TypeScript client from `openapi.json` with the current generator (check the docs of `@hey-api/openapi-ts` or `openapi-typescript`, see Versions) and commit the output or generate in CI. The frontend never hand-writes API types.

**Done when:** `openapi.json` is committed and the TS client builds from it.

### 3. Apply the conventions

| Concern | Rule |
|---|---|
| Errors | RFC 9457 `application/problem+json`: `type`, `title`, `status`, `detail`, `instance`, plus machine-readable extension members such as `code` and `errors[]`. Never leak stack traces or SQL. See `references/error-model.md` |
| Pagination | Cursor-based with an opaque cursor, a `limit` cap, a stable sort with a unique tiebreaker. Offset only for small admin tables. See `references/pagination.md` |
| Idempotency | Every non-idempotent POST that creates something or sends something accepts `Idempotency-Key`; same key and body returns the first result; same key and a different body returns 422 or 409 |
| Versioning | Additive changes need no version. Breaking changes: new version in the path (`/v2`) or a dated header; support both until usage of the old one is zero; mark deprecated in OpenAPI and send `Deprecation` and `Sunset` headers |
| Rate limits | Return 429 with `Retry-After` and the `RateLimit` headers; limits per API key or user, stricter on auth and expensive routes. Stateless host with Postgres: one upsert per check, see `references/rate-limit-postgres.md` |
| Webhooks sent | Sign the raw body with HMAC-SHA256 and a timestamp; include a unique event id; retry with backoff; document the replay window. See `references/webhooks.md` |
| Webhooks received | Verify signature over the raw bytes before parsing, check timestamp tolerance, dedupe on event id, respond 2xx fast and process async |
| Machine callers | Worker, webhook and cron routes authenticate with a bearer secret or provider signature and opt out of the cookie Origin check explicitly. Compare secrets by hashing both sides, then `timingSafeEqual`. See `references/webhooks.md` |
| Docs for agents | Every operation has a request and a response example, documented error codes, and parameter descriptions with units and allowed values; an agent cannot guess them. FastAPI: `examples` on Pydantic models, `responses=` on routes |
| Approval by emailed link | See `references/approvals.md` |
| Naming | Plural nouns, snake_case JSON, ISO 8601 UTC timestamps, string ids, enums as lowercase strings, money as integer minor units plus currency |
| Partial update | PATCH with explicit semantics (merge patch); document how to clear a field |
| Long operations | Return 202 with a status resource, or start a Temporal workflow and return its id |

**Done when:** each endpoint's OpenAPI entry shows the error responses, pagination parameters and idempotency header that apply.

### 4. Gate it

Run both gates locally and in CI. Neither is optional.

```bash
npx @stoplight/spectral-cli lint openapi.json            # style and rules; ruleset in .spectral.yaml
oasdiff breaking origin-main-openapi.json openapi.json   # breaking-change diff vs the base branch
oasdiff changelog origin-main-openapi.json openapi.json  # paste into the PR
```

Get the base spec with `git show origin/main:openapi.json > origin-main-openapi.json`. Redocly CLI (`npx @redocly/cli lint`) is an acceptable linter in place of Spectral; use one. A breaking finding needs either a version bump with a deprecation plan or a written justification in the PR.

**Done when:** lint exits 0, and `oasdiff breaking` is empty or each item is justified in the PR description.

### 5. Prove it with a consumer

Run a contract test: call each endpoint with the generated client against a local server and a real local Postgres, covering one success, one validation error (assert problem+json shape), one auth failure and one replay of the idempotency key. Use `planning-tests` for placement.

**Done when:** those four cases pass for each new endpoint.

## Quick reference

| Status | Use |
|---|---|
| 200/201/204 | read or update / created with `Location` / success without body |
| 202 | accepted for async work |
| 400 | malformed request; 422 for well-formed but invalid fields |
| 401/403 | unauthenticated / authenticated but not allowed |
| 404 | missing, and also for resources the caller may not know exist |
| 409 | state conflict, idempotency key reused with a different body |
| 412/428 | ETag precondition failed / required |
| 429 | rate limited, with `Retry-After` |
| 503 | overloaded or dependency down, with `Retry-After` |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "Only our frontend uses it" | Old browser tabs and cached bundles are consumers. Keep additive changes. |
| "We will document the API later" | The OpenAPI file is the doc. Generate it now or the types will drift. |
| "Offset pagination is simpler" | It skips and repeats rows when data changes. Use a cursor unless the table is tiny and static. |
| "A 200 with an error field is easier for the client" | Use real status codes with problem+json; clients and proxies depend on them. |
| "The breaking diff is noisy" | Fix the spec so the diff is signal, not the gate. |

## Verification

- [ ] `openapi.json` regenerated and committed; TS client rebuilt.
- [ ] Spectral (or Redocly) lint passes.
- [ ] `oasdiff breaking` against the base branch run; results empty or justified.
- [ ] Errors are problem+json with a stable `code`; no internals leaked.
- [ ] Lists use cursors with a `limit` maximum; creating endpoints accept `Idempotency-Key`.
- [ ] Webhooks signed and verified over raw bytes, timestamp checked, event id deduped.
- [ ] Consumer contract tests pass.

## Versions

- @stoplight/spectral-cli 6.17.0 (verified 2026-11-05, https://www.npmjs.com/package/@stoplight/spectral-cli)
- @redocly/cli 2.75.0 (verified 2026-11-05, https://www.npmjs.com/package/@redocly/cli)
- oasdiff v1.35.0 (verified 2026-11-05, https://github.com/oasdiff/oasdiff/releases/latest)
- @hey-api/openapi-ts 0.99.0 (verified 2026-11-05, https://www.npmjs.com/package/@hey-api/openapi-ts)

Read the current docs of each tool before using flags not shown above.

## References

| File | Load when |
|---|---|
| references/error-model.md | defining or reviewing error responses and the FastAPI problem handler |
| references/pagination.md | adding a list endpoint or changing a cursor |
| references/webhooks.md | sending or receiving signed webhooks |
| references/rate-limit-postgres.md | rate limiting on a stateless host that already has Postgres |
| references/approvals.md | approving or rejecting by a link in an email |
