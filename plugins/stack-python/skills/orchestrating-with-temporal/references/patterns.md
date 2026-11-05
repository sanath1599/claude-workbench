# Temporal pattern catalogue (Python SDK)

Verified against docs and release notes on 2026-11-05 (temporalio 1.35.0). Signatures drift; confirm in https://docs.temporal.io/develop/python before relying on an exact argument. Common imports assumed:

```python
from datetime import timedelta
import asyncio
from temporalio import workflow, activity
from temporalio.common import RetryPolicy
with workflow.unsafe.imports_passed_through():
    from .activities import charge, refund, reserve  # activity functions
```

Contents: 1 Saga, 2 Entity, 3 Continue-as-new, 4 Child vs activity, 5 Signals/queries/updates, 6 Approval with timeout, 7 Timers, 8 Schedules, 9 Polling, 10 Heartbeats, 11 Async completion, 12 Local activities, 13 Fan-out and sliding window, 14 Mutex, 15 Versioning, 16 Idempotency, 17 Nexus, 18 Claim check, 19 Testing (pointer), 20 Determinism (pointer), 21 Durable AI agent, 22 Standalone activities and other primitives.

## 1. Saga / compensation

**When:** several systems must all succeed or be undone, and there is no shared transaction. **When not:** one database (use a transaction) or when partial failure is acceptable.
**Primitive:** try/except in the workflow, a stack of compensations run in reverse, each compensation idempotent.

```python
@workflow.defn
class BookTrip:
    @workflow.run
    async def run(self, trip: dict) -> str:
        comps: list = []
        opts = dict(start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=RetryPolicy(maximum_attempts=5))
        try:
            await workflow.execute_activity(reserve_flight, trip, **opts)
            comps.append((cancel_flight, trip))
            await workflow.execute_activity(reserve_hotel, trip, **opts)
            comps.append((cancel_hotel, trip))
            await workflow.execute_activity(charge, trip, **opts)
            return "booked"
        except Exception:
            for fn, arg in reversed(comps):
                await asyncio.shield(asyncio.ensure_future(
                    workflow.execute_activity(fn, arg, **opts)))   # survive cancellation
            raise
```

Compensate in reverse order, retry compensations hard, and record the compensation state so a human can see a stuck one.

## 2. Entity (actor) workflow

**When:** one durable object per key (candidate, order, session) whose state is changed by many events. **When not:** stateless jobs, or very high event rates on one key (a single workflow handles a modest event rate; shard the key).
**Primitive:** `@workflow.signal`/`update`/`query`, `workflow.wait_condition`, continue-as-new, signal-with-start.

```python
@workflow.defn
class CandidateSession:
    def __init__(self) -> None:
        self.events: list[dict] = []
        self.closed = False

    @workflow.run
    async def run(self, candidate_id: str) -> None:
        while not self.closed:
            await workflow.wait_condition(lambda: bool(self.events) or self.closed)
            while self.events:
                ev = self.events.pop(0)
                await workflow.execute_activity(apply_event, args=[candidate_id, ev],
                                                start_to_close_timeout=timedelta(seconds=30))
            if workflow.info().is_continue_as_new_suggested():
                await workflow.wait_condition(workflow.all_handlers_finished)
                workflow.continue_as_new(candidate_id)

    @workflow.signal
    def push(self, ev: dict) -> None:
        self.events.append(ev)

    @workflow.signal
    def close(self) -> None:
        self.closed = True

    @workflow.query
    def pending(self) -> int:
        return len(self.events)
```

Carry unprocessed events in the continue-as-new arguments if they matter.

## 3. Continue-as-new

**When:** loops or entities that could exceed history limits (about 50K events or 50 MB), or any workflow that runs for months. **When not:** short workflows.
**Primitive:** `workflow.continue_as_new(*args)`; check `workflow.info().is_continue_as_new_suggested()`. Before calling it, `await workflow.wait_condition(workflow.all_handlers_finished)`. Never call it from an update or signal handler. Pass state as arguments (keep it small). `backoff_start_interval` (1.30+) delays the next run. `TemporalDurability(continue_as_new=fn)` does this for agent loops.

## 4. Child workflow vs activity

**Activity:** one retryable unit of side-effecting work (HTTP call, LLM call, DB write). **Child workflow:** its own history, id, retry and timeouts, and a parent-close policy. **Use a child when** you fan out thousands of items (partition history), need a separate lifecycle (survives or is cancelled with the parent by policy), or reuse a workflow from several parents. **Do not use a child** to organise code; call a normal function.

```python
result = await workflow.execute_child_workflow(
    ProcessBatch.run, batch, id=f"batch-{batch_id}",
    parent_close_policy=workflow.ParentClosePolicy.ABANDON)
```

## 5. Signals, queries, updates

- **Signal:** async write, no return value. **Query:** sync read (`def`, not `async def`), no mutation, works on closed workflows. **Update:** tracked write that returns a value; optional validator rejects bad input without writing history.
- Prefer an update over signal-then-poll-a-query when the caller needs the result.
- Handlers may be async and call activities; guard shared state with `asyncio.Lock` if they interleave.

```python
@workflow.update
async def approve(self, by: str) -> str:
    self.decision = ("approved", by)
    return "recorded"

@approve.validator
def _check(self, by: str) -> None:
    if not by:
        raise ValueError("approver required")
```

Caller (FastAPI): `handle = client.get_workflow_handle(wid); await handle.execute_update(CandidateSession.approve, "ana")`. Use `start_update(..., wait_for_stage=WorkflowUpdateStage.ACCEPTED)` when you only need acceptance.

**Signal-with-start** (create or poke, idempotent):

```python
await client.start_workflow(CandidateSession.run, cid, id=f"cand-{cid}", task_queue="main",
                            start_signal="push", start_signal_args=[ev])
```

**Update-with-start and early return** (reply fast while work continues; needs a workflow id conflict policy and a recent server):

```python
from temporalio.client import WithStartWorkflowOperation, WorkflowUpdateStage
from temporalio.common import WorkflowIDConflictPolicy

op = WithStartWorkflowOperation(Intake.run, doc_id, id=f"intake-{doc_id}", task_queue="main",
                                id_conflict_policy=WorkflowIDConflictPolicy.USE_EXISTING)
ack = await client.execute_update_with_start_workflow(Intake.accept, doc_id, start_workflow_operation=op)
```

`Intake.accept` returns as soon as the document is validated and stored; the workflow keeps running. An operation object is single use. Workflows cannot send updates to other workflows directly; use an activity that calls the client.

## 6. Human approval with timeout

**When:** a person decides, possibly days later; silence needs a default or escalation. **When not:** sub-second interaction.

```python
@workflow.defn
class DocReview:
    def __init__(self) -> None:
        self.decision: tuple[str, str] | None = None

    @workflow.signal
    def decide(self, outcome: str, by: str) -> None:
        self.decision = (outcome, by)

    @workflow.run
    async def run(self, doc_id: str) -> str:
        await workflow.execute_activity(notify_manager, doc_id,
                                        start_to_close_timeout=timedelta(seconds=30))
        for attempt in range(3):                       # reminders
            try:
                await workflow.wait_condition(lambda: self.decision is not None,
                                              timeout=timedelta(days=1))
                break
            except asyncio.TimeoutError:
                await workflow.execute_activity(remind_manager, doc_id,
                                                start_to_close_timeout=timedelta(seconds=30))
        if self.decision is None:
            await workflow.execute_activity(escalate, doc_id,
                                            start_to_close_timeout=timedelta(seconds=30))
            return "escalated"
        return self.decision[0]
```

Use an update instead of a signal when the approver's UI needs a confirmation or error. Check the approver's permission in the API before sending the signal and again in an activity if the action is sensitive. With Pydantic AI, the same wait lives in a `HandleDeferredToolCalls` handler (see `stack-python:building-pydantic-ai-agents`, pattern 7).

## 7. Durable timers

`await asyncio.sleep(timedelta(days=30).total_seconds())` or `await workflow.sleep(timedelta(days=30))`. Costs nothing while waiting and survives restarts. Not for polling. A workflow that loops on timers for years should continue-as-new. Pair with `wait_condition(timeout=...)` for "wake early on signal".

## 8. Schedules vs cron

**Use schedules** for recurring work (`client.create_schedule`); they support pause, trigger-now, backfill, overlap and catch-up policies. The workflow-level `cron_schedule` is legacy. Set `catchup_window` explicitly (default changed to `None` in 1.35).

```python
from temporalio.client import Schedule, ScheduleActionStartWorkflow, ScheduleSpec, ScheduleIntervalSpec, SchedulePolicy
from temporalio.client import ScheduleOverlapPolicy

await client.create_schedule(
    "nightly-digest",
    Schedule(
        action=ScheduleActionStartWorkflow(Digest.run, id="digest", task_queue="main"),
        spec=ScheduleSpec(intervals=[ScheduleIntervalSpec(every=timedelta(days=1))]),
        policy=SchedulePolicy(overlap=ScheduleOverlapPolicy.SKIP),
    ),
)
```

Create schedules from a setup script that is idempotent (catch `ScheduleAlreadyRunningError`), not from app startup on every replica.

## 9. Polling

- **Frequent (about once a second or faster):** loop inside one long activity with heartbeats. History stays small.
- **Infrequent (a minute or more):** the activity raises when "not ready" and the retry policy repeats it (retries are not recorded in history). Set `maximum_interval` and `backoff_coefficient=1.0`.
- **Best:** have the external system push a webhook that your API turns into a signal.

```python
policy = RetryPolicy(initial_interval=timedelta(minutes=1), backoff_coefficient=1.0,
                     maximum_interval=timedelta(minutes=1))
await workflow.execute_activity(check_export_ready, job_id, retry_policy=policy,
                                start_to_close_timeout=timedelta(seconds=30),
                                schedule_to_close_timeout=timedelta(hours=6))
```

## 10. Heartbeating long activities

**When:** activities longer than about 30 seconds, loops over items, streaming LLM calls. Heartbeats detect dead workers, deliver cancellation, and carry resume details.

```python
@activity.defn
async def import_rows(job_id: str) -> int:
    start = (activity.info().heartbeat_details or [0])[0]
    for i in range(start, total_rows(job_id)):
        await process_row(job_id, i)
        activity.heartbeat(i)
    return total_rows(job_id)
# caller: heartbeat_timeout=timedelta(seconds=30), start_to_close_timeout=timedelta(hours=1)
```

Heartbeats are throttled by the SDK; call freely. Async activities must `await` regularly or heartbeating stalls; run blocking code in a thread executor with `activity.heartbeat` from the thread.

## 11. Async activity completion

**When:** an external system finishes the work later and you want activity timeouts and retries rather than a signal. **When not:** a signal is simpler and the external system is reliable.

```python
@activity.defn
async def start_scan(doc_id: str) -> None:
    token = activity.info().task_token
    await scanner.submit(doc_id, callback_token=token.hex())
    activity.raise_complete_async()

# in the webhook handler
handle = client.get_async_activity_handle(task_token=bytes.fromhex(token))
await handle.complete(result)
```

Set `schedule_to_close_timeout` so a lost callback fails the activity.

## 12. Local activities

Run in the workflow worker without a task-queue hop. **Only** for short (seconds), cheap, low-risk calls where latency matters, such as a quick pure transformation. Not durable like normal activities, bad for rate-limited or long calls. Default: do not use. `workflow.execute_local_activity(...)`.

## 13. Fan-out/fan-in and sliding window

Small N (tens): `await asyncio.gather(*[workflow.execute_activity(f, x, ...) for x in items])`. Use `return_exceptions=True` when one failure should not cancel the rest.

Large N: cap in-flight work and continue-as-new per slice.

```python
@workflow.run
async def run(self, items: list[str], offset: int = 0) -> int:
    window, size = 20, 500
    chunk = items[offset:offset + size]
    sem = asyncio.Semaphore(window)

    async def one(x: str) -> None:
        async with sem:
            await workflow.execute_activity(process, x,
                start_to_close_timeout=timedelta(minutes=2))

    await asyncio.gather(*[one(x) for x in chunk])
    if offset + size < len(items):
        workflow.continue_as_new(args=[items, offset + size])
    return len(items)
```

For tens of thousands of items, do not pass the list as an argument (payload cap); pass a cursor and read pages in an activity, or use child workflows per batch. Bound concurrency; a single workflow's history is the limit.

## 14. Mutex / resource locking

Simple throttling: worker `max_concurrent_activities`, task-queue rate limits. True exclusion over a resource across workflows: an entity workflow per resource that accepts lock requests (update), grants one lease at a time with a timeout, and releases on completion or expiry. If one entity workflow already owns the resource, no lock is needed because its handlers are serial.

```python
@workflow.update
async def acquire(self, who: str) -> bool:
    await workflow.wait_condition(lambda: self.holder is None)
    self.holder = who
    return True
```

Always add a lease timeout so a crashed holder cannot block everyone.

## 15. Versioning

Running workflows replay their old history against new code. Any change to command order breaks them.

- **Patching:** `if workflow.patched("fix-fee-v2"): new_code() else: old_code()`. Later `workflow.deprecate_patch("fix-fee-v2")`, then delete the branch once old runs are gone. Patch ids are memoized per id; suffix ids inside loops.
- **Worker Versioning (Worker Deployments):** build ids per deployment; `@workflow.defn(versioning_behavior=VersioningBehavior.PINNED)` finishes on the version it started on (no patching needed); `AUTO_UPGRADE` moves to the current version and must stay replay-safe. Roll out through Current/Ramping versions; old versions drain. Required for Serverless Workers. Read https://docs.temporal.io/worker-versioning.md for the current API; GA status was not stated on the page when checked.
- **New type name:** `ReviewV2` for incompatible changes; let old runs finish. Continue-as-new is a natural upgrade point.
- Short-lived workflows (under a day): drain the old worker before deploying and skip versioning.

## 16. Activity idempotency

Activities are at-least-once. Derive keys from stable ids: `f"{info.workflow_id}:{info.workflow_run_id}:{info.activity_id}"` (use the run id only if repeats across runs are acceptable) or the business key. Check-before-act, upsert, or pass the key as the provider's idempotency header (Stripe, Resend and similar support one).

```python
@activity.defn
async def send_offer_email(args: dict) -> None:
    key = f"offer:{args['candidate_id']}"
    if await sent_log.exists(key):
        return
    await mailer.send(args, idempotency_key=key)
    await sent_log.add(key)
```

Real emails or payments from a workflow still need the owner's yes at design time; tests use fakes.

## 17. Nexus

Service contracts across teams or namespaces: callers see operations, not your workflow ids or task queues. GA. **When:** another team consumes your capability. **When not:** one team, one namespace (plain workflows and activities). Python support exists; read https://docs.temporal.io/nexus/choosing-an-approach.md and the Python Nexus page before designing, as the API surface was not verified here. Standalone Nexus operations are Public Preview.

## 18. Claim check for large payloads

Payload limit is 2 MB per payload (fixed on Cloud). Keep documents, transcripts, audio and embeddings out of history.

```python
@activity.defn
async def store_doc(doc: bytes) -> str:
    key = f"docs/{sha256(doc).hexdigest()}"      # deterministic key = idempotent
    await blob.put(key, doc)
    return key                                    # workflow passes the key onward
```

Alternatives: **External Storage** (Public Preview) offloads payloads above a threshold (default 256 KiB) to S3 or a custom driver; Temporal never deletes the blobs, so set a lifecycle rule longer than retention. Encrypt sensitive payloads with a `PayloadCodec`.

## 19. Testing

See `references/testing-and-determinism.md`: `WorkflowEnvironment.start_time_skipping()`, `ActivityEnvironment`, `Replayer`, `max_cached_workflows=0`.

## 20. Determinism and the sandbox

See `references/testing-and-determinism.md`. In short: no I/O, no `datetime.now()`, `random`, `uuid4()` in workflows; use `workflow.now()`, `workflow.random()`, `workflow.uuid4()`; import third-party and activity modules under `workflow.unsafe.imports_passed_through()`.

## 21. Durable AI agent loop

**When:** an LLM agent runs more than a minute, calls side-effecting tools, or waits on a human. **When not:** a single structured call.

Hand-rolled shape: each LLM call is an activity (provider `max_retries=0`, explicit timeout, non-retryable for auth, quota, invalid request); each tool call is an activity; loop state lives in the workflow; continue-as-new when history grows; approvals arrive by signal or update with a timeout; output validated with Pydantic in the activity.

With Pydantic AI, prefer `TemporalDurability` and let it generate the activities:

```python
agent = Agent(model, name="reviewer", output_type=Verdict,
              capabilities=[TemporalDurability(),
                            HandleDeferredToolCalls(handler=wait_for_manager)])

@workflow.defn
class ReviewAgent(PydanticAIWorkflow):
    __pydantic_ai_agents__ = [agent]
    def __init__(self): self.answers: dict[str, bool] = {}

    @workflow.signal
    def answer(self, tool_call_id: str, ok: bool) -> None: self.answers[tool_call_id] = ok

    @workflow.run
    async def run(self, doc_id: str) -> Verdict:
        return (await agent.run(f"Review {doc_id}")).output
```

`wait_for_manager` would `await workflow.wait_condition(..., timeout=timedelta(days=3))` on `self.answers` and return `requests.build_results(approvals=...)`; the handler must be reachable from the workflow instance (a closure or a module-level registry keyed by workflow id; confirm the pattern in the Pydantic AI Temporal docs). Cookbook: https://docs.temporal.io/ai/cookbook/llms.txt.

## 22. Standalone activities and other primitives

- **Standalone Activities** (GA in 1.33): run one activity with Temporal's retries and timeouts without writing a workflow. Good for a single durable job such as "send this report". Read the SDK docs for the client call.
- **Search attributes** for filtering workflows in the UI and API (status, customer id).
- **Priority and fairness** for noisy-neighbour control on shared task queues.
- **Interceptors and plugins** for tracing, auth context and the Pydantic data converter.
- **Payload codec** for encryption at rest.
