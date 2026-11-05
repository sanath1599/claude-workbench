---
name: testing-apis-from-the-command-line
description: Use when the owner wants to try an endpoint, check an API against its OpenAPI spec, add a contract or smoke test for a FastAPI or Next.js route, or load test lightly. Triggers on "test this API", "does the endpoint work", "hit it with requests". Not for browser flows, which is verifying-ui-in-browser, nor for designing the API, which is designing-apis.
---

# Testing APIs from the command line

No GUI client is needed. A one-off check is a `curl` line, a repeatable check is a pytest file with `httpx`, and a spec check is Schemathesis. Keep the assertions in the repo so they run in CI.

## When to use

- "Try the new endpoint", "is the webhook route alive".
- A FastAPI app exposes `/openapi.json` and nobody has checked that responses match it.
- A smoke test must run after each deploy.

## When not to use

- Page behaviour, layout, clicks: `design-studio:verifying-ui-in-browser`.
- Shaping resources and errors: `engineering-craft:designing-apis`.
- Planning the whole test suite: `engineering-craft:planning-tests`.

## Procedure

1. **Pick the target.** Local server or a preview URL first. Production only for read-only requests with the owner's yes. Never point write tests at production data, and never trigger real emails, SMS or LLM calls; use test recipients or mocks.
   **Done when:** the base URL is stated and is not production for any write.
2. **One-off check.** `curl -sS -i -X POST "$BASE/api/x" -H 'content-type: application/json' --data @payload.json --max-time 20`. Read status, headers and body. For a protected Vercel preview use `vercel curl`. Read auth from an environment variable, never inline in the command.
3. **Repeatable check.** In Python, a pytest module using `httpx` (`httpx.Client(base_url=...)`, or `ASGITransport` to call a FastAPI app in-process without a server). Assert status, the Pydantic model of the body, and the error shape. In TypeScript, Vitest with `fetch`. One test per behaviour; cover the 4xx paths.
4. **Spec conformance.** For FastAPI, run Schemathesis against the OpenAPI document. It generates inputs from the schema and reports responses that violate it, 500s and slow calls. Run it against a local server with a throwaway database, because it sends many odd writes. Read `schemathesis run --help` for the current flags.
5. **Light load.** Use a short run only on local or preview: a few dozen concurrent requests with a Python `asyncio` and `httpx` loop, or `hey`/`k6` when installed. Set a latency and error-rate threshold up front. Never load test production or a third-party API.
6. **Smoke after deploy.** A script that GETs the health endpoint, compares the version marker with the commit, then performs one safe read. Exit non-zero on any failure so CI or a hook can stop.
7. **Record.** Save the commands or tests in the repo (`tests/api/`), not in chat.
   **Done when:** one command runs the checks and exits 0.

## Quick reference

| Goal | Tool |
|---|---|
| One request | `curl -sS -i` |
| Protected preview | `vercel curl` |
| Kept assertions | pytest + `httpx` |
| Spec conformance | Schemathesis |
| Webhook signature test | build the signed payload in the test with the secret from env |

## Rationalizations

| Excuse | Instead |
|---|---|
| "It returned 200 once" | Assert the body and the error cases. |
| "Test against prod, it is quicker" | Use preview or local; production is read-only and needs a yes. |
| "Install a GUI client" | A committed test beats a click history. |

## Verification

- [ ] Target is not production for writes; no real sends happened.
- [ ] Assertions live in the repo and a single command runs them.
- [ ] 4xx and malformed-input paths covered.
- [ ] Secrets came from the environment and are not in output.

## Versions

- schemathesis 4.33.1 (verified 2026-11-05, https://pypi.org/pypi/schemathesis/json)
- httpx 0.28.1 (verified 2026-11-05, https://pypi.org/pypi/httpx/json)
