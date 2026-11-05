---
name: hardening-distributed-systems
description: Use when a design or change involves retries, queues, webhooks, background jobs, multi-step writes across services, caches, locks, or "what if this runs twice or the call times out". Also when reviewing for duplicates, lost messages, stuck workflows or overload. Not for the initial architecture choice (designing-systems) or workflow API usage (stack-python:orchestrating-with-temporal).
---

# Hardening distributed systems

Assume every call can fail, time out, arrive twice, arrive late or arrive out of order. Walk each boundary in the design and give every failure an answer you can test.

## When to use

- A webhook handler, queue consumer, cron job, or any code another process can call more than once.
- A flow that writes to two places (database and queue, database and third-party API, two services).
- Retry logic, timeouts, circuit breakers, caches, distributed locks, rate limiting.
- Symptoms: duplicate emails or charges, stuck jobs, retry storms, a slow dependency taking down everything, stale reads, "it works until traffic spikes".

## When not to use

- Choosing the overall architecture: `designing-systems`.
- Temporal workflow, activity and signal mechanics: `stack-python:orchestrating-with-temporal`.
- LLM provider retries and fallbacks: `stack-python:calling-llms-reliably`.
- Table and migration design: `stack-python:modeling-data-in-postgres`. Alerts and SLOs: `ops-and-sre:defining-slos-and-alerts`.

## Procedure

### 1. Draw the boundaries

List every hop where one process calls or messages another, including third parties (Resend, LiveKit, payment providers), the database, queues and cron triggers. For each, write: who initiates, what is the side effect, is the receiver or the sender the system of record.

**Done when:** a numbered list of hops exists and each has an initiator and a side effect.

### 2. Run the failure walk

For each hop, ask the five questions below and write the answer next to it. Use `references/failure-modes.md` to find the mitigation and the test for each.

1. It times out and you do not know if it happened. What is safe to do next?
2. It is delivered twice. What stops the second effect?
3. It arrives late or after a newer message. What decides which wins?
4. The dependency is slow or down for ten minutes. What does the caller do, and what protects the rest of the system?
5. The process dies half-way. What state is left, and who finishes or undoes it?

**Done when:** every hop has five answers, or a written reason a question does not apply.

### 3. Pick mechanisms with the decision table

| Situation | Use |
|---|---|
| Handler may run more than once (webhook, queue, retry) | Idempotency key plus a unique constraint, in the same transaction as the effect |
| Must write a row and publish an event | Transactional outbox, relay publishes, consumers dedupe |
| Consumer receives at-least-once | Inbox table keyed by message id, process inside the transaction |
| Multi-step business process across services, needs undo | Saga. Default to a Temporal workflow with compensations |
| Short step that can be retried | Retry with exponential backoff, full jitter, a max attempts cap and a retry budget |
| Calling a slow or flaky dependency | Timeout on every call, deadline propagated from the edge, circuit breaker, bulkhead |
| Producer faster than consumer | Bounded queue, reject or shed at the limit, backpressure to the caller |
| Message fails every time | Retry cap, then dead-letter queue with an alert and a replay path |
| Two workers must not do the same thing | Lease with expiry plus a fencing token checked by the resource, never a bare lock |
| Hot key expires and everyone recomputes | Single-flight, jittered TTL, stale-while-revalidate |
| Contract between services changes | Expand, migrate, contract. Tolerant readers. Never remove and add in one deploy |

Do not promise exactly-once. Deliver at-least-once and make the effect idempotent. State this in the design in those words.

**Done when:** each failure from step 2 maps to one mechanism, and nothing relies on "it should not happen".

### 4. Specify the numbers

Write the actual values: timeout per call, total deadline, backoff base and cap, max attempts, retry budget (for example retries limited to 10 percent of request volume), queue depth limit, breaker thresholds, lease duration, TTL. A mechanism with no numbers is not specified. Timeouts must nest: caller deadline longer than the sum of the callee work it waits for, and the user-facing deadline shortest at the edge.

**Done when:** a table of values is in the design with a reason for each.

### 5. Prove it

For each mitigation write the test from the last column of the reference table, and run it. Failure tests that matter most: replay the same event twice; kill the process between the write and the publish; make the dependency return 500 and then hang; fill the queue; deliver messages out of order. Use `planning-tests` for how to place them, and for Temporal replay and time-skipping tests.

**Done when:** each critical mechanism has a test that fails when the mechanism is removed. Run it with the mechanism removed once to see it fail.

## Quick reference

| Myth | Reality |
|---|---|
| "Exactly-once delivery" | Impossible across a network. At-least-once plus idempotent effect gives exactly-once effect. |
| "Retry fixes it" | Retries multiply load on a struggling dependency. Cap them and budget them. |
| "A lock makes it safe" | A paused holder wakes up after its lease expired. Only a fencing token checked by the resource is safe. |
| "Timestamps order events" | Clocks drift. Use sequence numbers, versions or a single writer. |
| "The queue is durable so we are fine" | Durable is not deduplicated, not ordered, and not bounded. |
| "Eventually consistent is fine" | Name what the reader sees in the gap and whether the product tolerates it. |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "Duplicates are rare" | They happen on every deploy and every provider retry. Add the key. |
| "The provider guarantees once" | Read its docs: nearly all say at-least-once. Verify the signature and dedupe on the event id. |
| "We will add timeouts later" | A missing timeout is an outage waiting on one slow call. Add now; the default in most clients is none. |
| "Just retry forever" | Infinite retry turns one bad message into a permanent stuck consumer. Cap and dead-letter. |
| "Temporal is overkill for this" | Then it must be a single idempotent step. If there are two side effects with a gap, use the workflow. |

## Verification

- [ ] Every hop has answers to the five questions.
- [ ] Every handler reachable more than once has an idempotency key enforced by a unique constraint.
- [ ] Every outbound call has a timeout and a stated retry policy with jitter and a cap.
- [ ] No queue or buffer is unbounded; every consumer has a dead-letter path.
- [ ] Locks use leases plus fencing tokens, or are replaced by a unique constraint.
- [ ] Numbers table written; tests exist and were seen to fail without the mechanism.

## References

| File | Load when |
|---|---|
| references/failure-modes.md | doing the failure walk; choosing a mitigation; writing the test |
| references/patterns.md | implementing outbox, inbox, retries, fencing or single-flight in Python/Postgres |
