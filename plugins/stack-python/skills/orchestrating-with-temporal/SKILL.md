---
name: orchestrating-with-temporal
description: Use when work is long-running, multi-step, must retry, wait for a human or a timer, fan out, or survive crashes, or when the owner says workflow, saga, approval wait, scheduled job, durable agent or Temporal. Not for a request that finishes in seconds, which needs no orchestrator, or Pydantic AI agent internals, which is stack-python:building-pydantic-ai-agents.
---

# Orchestrating with Temporal

Temporal is the default for durable work. The job is to pick the right pattern for the case, not to use all of them. Workflows decide, activities act.

## When to use

- A flow outlives one request: approvals, onboarding, interviews, document pipelines, billing, scheduled jobs.
- Anything with retries, timeouts, compensation or "wait up to N days".
- An AI agent loop that must not lose progress or repeat side effects.

## When not to use

- One short call with a retry: plain code and a library retry.
- A single database transaction: use the transaction.
- Fire-and-forget email with no state: a queue or the provider's own retry is enough.
- Agent internals: `stack-python:building-pydantic-ai-agents`. Hosting the API: `stack-python:building-fastapi-services`.

## Procedure

1. **Read the current docs for the primitive.** Index: `https://docs.temporal.io/llms.txt` (pages have `.md` twins). The official agent skill `temporalio/skill-temporal-developer` (GitHub) is further reading and tracks the SDK closely; install it for deep API questions. Check `uv pip show temporalio`.
   **Done when:** you know the SDK version and have the doc page for each primitive.
2. **Walk the decision flow below** and write the chosen pattern next to each requirement.
   **Done when:** every requirement maps to exactly one pattern in `references/patterns.md`.
3. **Split deterministic from side-effecting code.** Workflow = decisions, timers, waiting, state. Activity = every I/O call, LLM call, DB write, clock or random read. Pass ids and small payloads, not documents (2 MB cap).
   **Done when:** no workflow file imports an HTTP, DB or LLM client.
4. **Set timeouts and retries explicitly** on every activity: `start_to_close_timeout`, a `RetryPolicy` with `maximum_attempts` or a sane cap, `non_retryable_error_types` for bad input, auth and quota. Add `heartbeat_timeout` for anything longer than about 30 s. Make each activity idempotent.
   **Done when:** a test kills an activity mid-run and the result is unchanged.
5. **Name the workflow id** from the business key (`review-{doc_id}`) and set the conflict policy. This is your dedupe and your handle for signals.
   **Done when:** starting the same request twice does not create two runs.
6. **Test determinism and time.** Use the time-skipping environment and a replay test (`references/testing-and-determinism.md`).
   **Done when:** the replay test over a captured history passes and the approval-timeout path is covered.
7. **Plan hosting and versioning** (below). Add worker versioning or `patched()` before the first change to a running workflow.
   **Done when:** the deploy note says which worker host runs it and how a code change reaches in-flight runs.

## Decision flow

1. Does the work need to outlive the request, retry, or wait? No: stop, use plain code.
2. Does it wait on a person or an external event? Signal or update (patterns 5, 6). Event may never arrive: add a timeout and an escalation path.
3. Does it touch several systems that can each fail? Saga (1).
4. Is there state per entity that many callers touch? Entity workflow (2), started with signal-with-start.
5. Does it repeat on a calendar? Schedule (8), not a cron-looping workflow.
6. Does it loop or run for months? Continue-as-new (3) at history-suggested points.
7. Does it process many items? Fan-out with a bounded window (13); child workflows only if history would be too large (4).
8. Is an activity long? Heartbeat (10). Does an outside system finish it? Async completion (11) or a signal.
9. Is it an LLM loop? Durable agent (21) using `TemporalDurability`.

## Selection table

| Need | Pattern (number in references/patterns.md) |
|---|---|
| Undo earlier steps on failure | Saga / compensation (1) |
| One durable object per user/order/session | Entity workflow (2) |
| Bound history on long loops | Continue-as-new (3) |
| Separate history or lifecycle | Child workflow (4); otherwise an activity |
| Write from outside, tracked result | Update (5); fire-and-forget write: signal; read: query |
| Create or poke in one call | Signal-with-start / update-with-start (5) |
| Reply fast, keep working | Update-with-start early return (5) |
| Manager approves within N days | Human approval with timeout (6) |
| Sleep days or months | Durable timer (7) |
| Recurring job | Schedule (8) |
| Wait for external state | Polling variants (9), or a webhook signal |
| Long job, resumable | Heartbeating activity (10) |
| Callback completes the work | Async activity completion (11) |
| Tiny, fast, low-risk call | Local activity (12), rarely |
| Many items | Fan-out/fan-in, sliding window (13) |
| One-at-a-time access | Mutex (14) |
| Change code under live runs | Versioning (15) |
| At-least-once side effects | Idempotency keys (16) |
| Other team's capability | Nexus (17) |
| Big files or transcripts | Claim check (18) |
| Testing | see references/testing-and-determinism.md (19, 20) |
| LLM agent loop | Durable AI agent (21) |
| Run one activity without a workflow | Standalone activity (22) |

## Hosting

- Temporal Cloud for the cluster (a $0 developer plan exists; check the pricing page before the owner commits), or `temporal server start-dev` locally. Self-host only for residency or scale; ask first.
- Workers are outbound long-pollers. They cannot run in Vercel Functions, which are request-scoped. Run them on an always-on host such as the owner's VPS (`{{wb.vps_hosts}}`) in Docker with graceful shutdown and worker versioning.
- Vercel Daemons (beta) look like the right shape for an outbound poller, but running a Temporal worker there is untested and unsupported as of 2026-11-05. Say so before suggesting it.
- Temporal Serverless Workers (Lambda, Cloud Run) are Public Preview and require worker versioning; Vercel is not a supported target.
- The FastAPI app (possibly on Vercel) only uses the Temporal client: start workflows, send signals and updates, run queries. Connection settings come from environment variables; the API key is a secret that is never logged.
- Local dev: `temporal server start-dev` binds 7233 and a UI on 8233. Check `lsof -i :7233` first.

## Rationalizations

| Excuse | Do instead |
|---|---|
| "I will poll a database table from a cron" | Use a signal or a schedule; Temporal already owns the state. |
| "A child workflow keeps the code tidy" | Plain functions tidy code. Child workflows partition history and lifecycle. |
| "I will call the API directly in the workflow, it is quick" | Any I/O belongs in an activity. |
| "Activities run once" | They run at least once. Add idempotency. |
| "I will edit the workflow and redeploy" | In-flight runs replay old history. Patch or version first. |

## Verification

- [ ] No I/O, `datetime.now()`, `random` or `uuid4()` in workflow code.
- [ ] Every activity has a timeout, a retry policy, and is idempotent.
- [ ] Workflow ids are business keys; conflict policy set.
- [ ] Unbounded loops use continue-as-new; handlers are finished before it.
- [ ] Time-skipping test covers every timeout branch; a replay test exists.
- [ ] Tests never hit a real Temporal Cloud namespace or real providers.
- [ ] Worker host, versioning plan and secret handling are written down.

## References

| File | Load when |
|---|---|
| references/patterns.md | choosing or writing any of the 22 patterns |
| references/testing-and-determinism.md | writing tests, hitting a sandbox or nondeterminism error, or adding time skipping |

## Versions

- temporalio 1.35.0, Python >= 3.10 (verified 2026-11-05, https://pypi.org/project/temporalio/)
- Temporal server OSS v1.32.2 (verified 2026-11-05, https://github.com/temporalio/temporal/releases)
- Per-workflow time skipping is experimental in 1.35 (verified 2026-11-05, https://github.com/temporalio/sdk-python/releases)
- Standalone Activities GA since 1.33 (verified 2026-11-05, same source)
- Worker Versioning, Serverless Workers (Public Preview), External Storage (Public Preview) (verified 2026-11-05, https://docs.temporal.io/serverless-workers.md and https://docs.temporal.io/external-storage.md)
- Official agent skill: https://github.com/temporalio/skill-temporal-developer (verified 2026-11-05)
- Upgrade hygiene: pin `temporalio`; three of the last six releases had breaking notes. Read https://github.com/temporalio/sdk-python/releases before bumping.
