---
name: choosing-background-work-on-vercel
description: Use when a Vercel app needs a cron job, a retried background task, a multi-step durable flow, scheduled jobs, or untrusted code execution, or when someone asks Queues versus Workflow versus Temporal. Not for response-time tuning, which is sizing-vercel-functions, nor for the Temporal worker itself, which is stack-python orchestrating-with-temporal.
---

# Choosing background work on Vercel

Pick the smallest mechanism that survives the failure you actually fear. The owner's default for long-running or human-in-the-loop agent work is Temporal on their own server; Vercel's own durable options are for work that lives inside a TypeScript or Next.js app.

## When to use

- "Run this nightly", "send these in the background", "retry until it works".
- Choosing between Queues, Workflow, Cron, `waitUntil`, Sandbox and Temporal.
- A function times out because it does too much per request.

## When not to use

- Making one request faster: `stack-web:sizing-vercel-functions`.
- Writing Temporal workflows and workers: `stack-python:orchestrating-with-temporal`; hosting them: `ops-and-sre:deploying-to-a-vps`.

## Procedure

1. **Name the failure to survive.** Client disconnects, function crash, deploy mid-run, a human approving three days later, or a retry storm. The failure picks the tool.
   **Done when:** one sentence states the failure and the maximum runtime.
2. **Choose with the table below.** Prefer the first row that fits.
3. **Make every handler idempotent.** Queues deliver at least once. Use a stable key (`<event>/<entity-id>`) for side effects such as email sends.
4. **Register the trigger.** A Queues consumer route with no `experimentalTriggers` entry in `vercel.json` or `vercel.ts` never receives anything. Cron entries live in the same file; Hobby crons run once a day at most. Protect the cron route with `CRON_SECRET` (sent as a Bearer token). For stale-session or pending-job sweeps on Hobby, keep the daily cron as the backstop and also run the same sweep from `after()` on a busy page, throttled by a module-level timestamp (about 5 minutes) and guarded by a cheap count query. Wrap `after()` in try/catch because it throws outside a request scope (scripts, tests). On Pro use a real short cron instead.
5. **Run `vercel link` and `vercel env pull` before local tests** of Queues or Workflow, or `send()` fails with an auth error.
6. **Set a poison-message rule.** Acknowledge after a delivery-count threshold, with exponential backoff, or a bad message retries until it expires (24 h default, 7 days max).
7. **Ask before adding infrastructure.** Queues and Workflow are beta-level products with their own pricing. State the cost and the fallback (a Postgres jobs table polled by Cron) and get a yes.

## Quick reference

| Need | Use | Notes |
|---|---|---|
| Finish a small task after responding | `waitUntil` / `after` | Lost on crash |
| Time-based trigger | Cron Jobs | Calls a route; Hobby daily only |
| Buffer, fan out, retry a single step | Vercel Queues | At-least-once, topics, consumer groups, 24 h default retention |
| Multi-step with sleep, hooks or approval, inside a TS app | Vercel Workflow (`"use workflow"`, `"use step"`) | Steps have full Node access; the workflow body is sandboxed (no `fetch`, timers or Node modules) |
| Agent loops across days, signals, human review, Python workers | Temporal on the VPS | Owner default for Pydantic AI agents |
| Run untrusted or generated code | Vercel Sandbox (Firecracker microVM) | Stop it in `finally`; billed while running. The owner has previously preferred Docker on their own server |

## Rationalizations

| Excuse | Instead |
|---|---|
| "Chain a few functions that call each other" | That is a hand-built workflow; use one. |
| "Queues for a two-step approval" | Approvals need Workflow or Temporal. |
| "Exactly-once, so no idempotency" | Delivery is at least once. |

## Verification

- [ ] Failure mode and runtime written down.
- [ ] Consumer registered in config; a test message was consumed and logged.
- [ ] Retry and poison-message policy present.
- [ ] Cost stated to the owner before enabling a paid product.

## Versions

- @vercel/queue 0.11.0 (verified 2026-11-05, https://registry.npmjs.org/@vercel/queue/latest)
- workflow 5.4.0 (verified 2026-11-05, https://registry.npmjs.org/workflow/latest); read `node_modules/workflow/docs/` once installed
- @vercel/sandbox 3.9.1 (verified 2026-11-05, https://registry.npmjs.org/@vercel/sandbox/latest)
