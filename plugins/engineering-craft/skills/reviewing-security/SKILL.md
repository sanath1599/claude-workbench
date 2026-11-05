---
name: reviewing-security
description: Use when writing code that handles auth, uploads, URLs, webhooks, secrets, sessions or user content (guidance mode), or when asked for a security review, audit or pen-test style pass (audit mode). Not for generic code review (code-review) or production incident response (ops-and-sre).
---

# Reviewing security

Two modes. Guidance mode shapes code while it is written and never starts an audit. Audit mode runs only when asked, and no finding is reported until a second, independent pass has tried to knock it down.

## When to use

- Guidance: adding a route, an upload, a URL fetcher, a webhook, a login or session, a prompt that includes user content, or a new dependency.
- Audit: "security review", "audit this", "is this safe to ship", before a production deploy of anything exposed to the internet.

## When not to use

- Style, correctness and maintainability review: `code-review`.
- Live incident: `ops-and-sre`.
- Prompt-level design of LLM features: `building-llm-features` (this skill checks that it was done).

## Procedure

### Mode A: guidance (while coding)

Loading this skill authorizes nothing heavy. Apply the checklist below to the code being written, fix issues in place, and mention only what changed behaviour. Do not spawn agents or write a findings file.

**Done when:** the code touched satisfies the matching rows in the checklist.

### Mode B: audit (when asked)

1. **Scope.** Ask what is in scope (repo, branch, diff, deployed URL) and out of scope. Read-only on the codebase; never run against production; never print secrets found (record the file and line, redact the value).
2. **Map.** List entry points (routes, webhooks, cron, queue consumers, file uploads, CLI), trust boundaries, roles, data stores and secrets locations. Write it down.
3. **Sweep.** For every entry point, go through the checklist. Run available tooling: dependency advisories (`npm audit`, `pip-audit` or `uv`-based equivalents), secret scanning on the working tree and history, linters with security rules. Tool output is a lead, not a finding.
4. **Draft findings.** One per issue, following `references/findings.schema.json`: id, title, severity, category, location (file and line), description, exploit scenario, evidence, recommendation, confidence. Severity uses likelihood and impact, not scanner scores.
5. **Verify each finding independently.** Spawn `finding-verifier` for every finding, one agent per finding, giving it the finding and the code but not your reasoning. It tries to refute it: is the code reachable, is input attacker-controlled, is there a guard elsewhere, is the exploit real. Keep only CONFIRMED findings. Record the verifier's evidence in the finding.
6. **Filter false positives.** Drop: pre-existing issues outside the audit scope (list separately), purely theoretical issues with no reachable path, linter-only style items, test or example code not shipped, findings the code explicitly suppresses with a justification you checked, and issues requiring an attacker who already has the access the issue would grant.
7. **Report.** Write findings JSON (validate it against the schema) and a short human summary ordered by severity. Say what was out of scope and what was not examined.

**Done when:** the findings file validates against the schema, every entry has `verification.verdict: "CONFIRMED"` with evidence, and rejected candidates are listed with the reason in a separate section.

## Quick reference: checklist by area

| Area | Check |
|---|---|
| Authz per route | Every route checks identity and permission server-side; every lookup by id also filters by the caller's tenant or owner (IDOR); admin routes tested as a normal user and anonymous |
| Uploads | Allowlist type by content, not extension; size limit enforced before reading fully; random storage names; private bucket with short-lived signed URLs; no execution or inline rendering of user HTML or SVG |
| URL fetchers (SSRF) | Allowlist scheme and host; resolve DNS and block private, loopback, link-local and metadata ranges after resolution and on each redirect; timeout and size cap; no credentials forwarded |
| Rate limits | On login, OTP, password reset, invite, upload, LLM-backed and email-sending routes; keyed by user and IP |
| Secrets | Only in environment or a secret store; never in logs, errors, client bundles or git; `.env*` ignored except `.env.example`; rotate anything that leaked |
| CSP and headers | Strict `Content-Security-Policy` without `unsafe-inline` scripts where feasible, `frame-ancestors`, `X-Content-Type-Options`, HSTS, `Referrer-Policy` |
| Webhooks | Signature over raw body, constant-time compare, timestamp tolerance, event-id dedupe (`designing-apis`) |
| Sessions and cookies | `HttpOnly`, `Secure`, `SameSite=Lax` or `Strict`, short lifetime, rotate on login, server-side revocation; CSRF protection for cookie-authed state changes |
| Prompt injection | User content delimited and treated as data; model output validated; models reading untrusted text have no send/delete/spend tools; no model-chosen URLs, paths or SQL without validation |
| Dependencies | Advisory scan clean or triaged; lockfile committed; no unpinned install scripts from unknown packages |
| Data | Parameterised queries only; least-privilege database role; PII minimised and not in logs; backups access-controlled |
| Errors | No stack traces or internals to clients; consistent responses that do not reveal whether an account exists |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "It is an internal tool" | Internal tools get exposed by accident. Auth and IDOR checks still apply. |
| "The frontend hides that button" | Enforce on the server. |
| "The scanner flagged it, so it is a finding" | Trace the path and write the exploit. Otherwise it is a lead. |
| "I am sure it is real, skip verification" | The independent pass is the point. Run it. |
| "Just ship, we will audit later" | Audit mode before production for anything internet-facing. |

## Verification

- [ ] Mode chosen and stated; guidance mode did not start an audit.
- [ ] (Audit) Scope and exclusions written; read-only; no secret values printed.
- [ ] (Audit) Every finding has an independent verifier verdict and evidence.
- [ ] (Audit) False-positive filter applied; rejected candidates listed.
- [ ] (Audit) Findings JSON validates against `references/findings.schema.json`.

## References

| File | Load when |
|---|---|
| references/findings.schema.json | writing or validating audit findings |
| references/checks.md | needing exploit patterns and fix snippets for the checklist rows |
