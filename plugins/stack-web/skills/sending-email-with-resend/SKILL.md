---
name: sending-email-with-resend
description: Use when an app must send transactional email (welcome, invite, notification, reset), handle Resend webhooks, test email code, or hit Resend limits. Not for adding DNS records for the sending domain, which is adding-subdomains, nor for marketing blasts.
---

# Sending email with Resend

Email goes through Resend from `{{wb.email_from}}` on the verified `{{wb.domain}}`. Code sends behind a small transport function so tests swap it for a mock. A real send needs the owner's yes.

## When to use

- "Send a welcome / invite / alert email", "add email notifications".
- Webhook handling for delivery, bounce, complaint events.
- Tests or CI that touch email code; 429 or quota errors.

## When not to use

- Resend DNS records: `stack-web:adding-subdomains`.
- Account chores (domains, API keys, logs): use the official Resend plugin or MCP, below.

## Procedure

1. **Wrap the SDK.** One module exports `sendEmail(msg)` with an injectable transport (a function from message to `{ id, error }`). Business code never imports the SDK directly. Write the row before sending and mark it `SENT` only once the provider returns a message id; otherwise `FAILED`, or `SKIPPED_NOT_CONFIGURED` when there is no key or sending is off, and give staff a copy-the-link fallback in the UI. Store plain-language reasons ("Email isn't set up on this server yet"), not variable names.
2. **Sender and reply-to.** `from` is `{{wb.email_from}}` (or a display-name variant of it) read from `EMAIL_FROM`. Put the owner or a team inbox in `replyTo`, from env, not code, on mail to people; staff notifications set none and link to the record in the dashboard. Recipient lists merge a global env list with a per-record list, de-duplicate case-insensitively and cap at 10. Prefer a dedicated sending subdomain for reputation isolation when volume or marketing mail is expected; each subdomain is verified on its own.
3. **Send and handle the result.** The Node SDK returns `{ data, error }` and does not throw; check `error` explicitly. The Python SDK raises `ResendError`. Snippets in `references/snippets.md`.
4. **Idempotency keys.** Pass one on every send that a retry could repeat, shaped `<event>/<entity-id>` (`welcome/user-123`). Keys expire after 24 hours and are limited to 256 characters. In the Node SDK the key is the second argument (`{ idempotencyKey }`); check the installed version's types.
5. **Test recipients.** Use `delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev` (a `+label` suffix works on these), and `suppressed@resend.dev`. Test sends still count against quota. Automated tests use a mock transport and never reach Resend.
6. **Production send gate.** Never send to real people without the owner's yes. Until then the app runs with email disabled or pointed at test recipients, and says so in the UI or log. A config flag (`EMAIL_ENABLED`) gates real sends; unset means skip and record `SKIPPED`.
7. **Webhooks.** Verify the Svix signature against the **raw** request body (`svix-id`, `svix-timestamp`, `svix-signature` headers). Parsing JSON and re-serialising breaks verification. Node: `resend.webhooks.verify` or the `svix` package. Python: the `svix` package. Return 2xx quickly, dedupe on `svix-id`, then process.
8. **Limits.** 10 requests per second per team across all keys. On 429 read `retry-after` and back off; do not tight-loop. Free plans have a daily quota (header `x-resend-daily-quota`), plus a monthly one; treat `daily_quota_exceeded` and `monthly_quota_exceeded` as non-retryable until reset. Batch with the batch endpoint when sending many.
9. **Templates.** Plain HTML with a text alternative is the default. React Email is optional for rich templates (`references/deliverability.md`). A `MAIL_TEST_TO` switch that redirects every send keeps local approval flows off real inboxes.
10. **Mocked tests.** Test that business events call the transport once with the right idempotency key, that errors are recorded without crashing the user flow, and that the webhook handler rejects a bad signature and accepts a good one.
    **Done when:** the test suite passes with no network access and a grep shows no test imports `resend` directly.

## Quick reference

| Need | Value |
|---|---|
| Node | `resend` package; `new Resend(process.env.RESEND_API_KEY)` |
| Python | `resend` package; `resend.Emails.send(params, options)`; async variant for FastAPI |
| Test inbox | `delivered@resend.dev` |
| Key shape | `<event>/<entity-id>` (recipient-specific: `<event>/<entity>/<recipient>`) |
| Rate | 10 req/s per team |
| Webhook secret | `whsec_...` from the webhook page, in env |

## Rationalizations

| Excuse | Instead |
|---|---|
| "Just one real send to check" | Use `delivered@resend.dev`; real addresses need the owner's yes. |
| "Parse the JSON then verify" | Verify the raw body first. |
| "Retries are rare" | Retries duplicate emails without a key. Add one. |

## Verification

- API key and webhook secret only in env; none in code, logs or tests.
- Every send path has an idempotency key and handles `error`.
- Tests run offline with a mock transport.
- Webhook route reads the raw body.

## Resend plugin and MCP

For account operations (domains, API keys, logs, webhooks, broadcasts) use the official plugin: `claude plugin install resend@claude-plugins-official`, or the remote MCP at `https://mcp.resend.com/mcp`. It is for operating the account, not for app code, and a send through it is still a real send that needs the owner's yes.

## References

| File | Load when |
|---|---|
| references/snippets.md | writing the transport, a Python send, or a webhook handler |
| references/deliverability.md | first send on a new subdomain, bounce and complaint handling, React Email, the CLI in CI, a local redirect switch |

## Versions

- resend (npm) 6.37.0 (verified 2026-11-05, https://registry.npmjs.org/resend/latest)
- resend (PyPI) 2.51.0 (verified 2026-11-05, https://pypi.org/project/resend/)
- Rate limits and quota headers (verified 2026-11-05, https://resend.com/docs/api-reference/rate-limit)
- Test addresses (verified 2026-11-05, https://resend.com/docs/dashboard/emails/send-test-emails)
- Webhook verification (verified 2026-11-05, https://resend.com/docs/webhooks/verify-webhooks-requests)
- react-email 6.11.6 and @react-email/components 1.0.12, optional (verified 2026-11-05, https://registry.npmjs.org/react-email/latest)
- MCP server (verified 2026-11-05, https://resend.com/docs/mcp-server)
