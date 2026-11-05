# Testing and determinism (Temporal Python SDK)

Verified against docs and release notes on 2026-11-05 (temporalio 1.35.0). Official reference: https://docs.temporal.io/develop/python/testing-suite and the `temporalio/skill-temporal-developer` repo.

## Determinism rules

Workflow code is replayed from history after any worker restart, so it must make the same decisions every time.

Do not, inside a workflow:
- do network, file or database I/O, or call an LLM;
- read the clock (`datetime.now()`, `time.time()`), use `random`, `uuid.uuid4()`, or iterate a `set` where order matters;
- use threads or `asyncio` primitives that depend on real time (`asyncio.sleep` is patched to the workflow timer and is fine; `time.sleep` is not);
- change the order or number of commands (activities, timers, child workflows) of released code without patching or versioning.

Use `workflow.now()`, `workflow.random()` (or `workflow.new_random("name")`), `workflow.uuid4()` / `workflow.uuid7()`, `workflow.sleep()`, and `workflow.logger` (replay-aware).

## The sandbox

The Python SDK runs workflow code in a sandbox that reloads modules per workflow run and blocks non-deterministic stdlib calls. Symptoms: `RestrictedWorkflowAccessError`, very slow worker start, odd import errors.

```python
@workflow.defn
class W: ...

with workflow.unsafe.imports_passed_through():
    from myapp.activities import fetch           # activity module
    import pydantic                               # heavy third-party modules
```

- Put imports that must not be re-executed under `imports_passed_through()` (activities, Pydantic, anything with import-time I/O).
- Whole-module passthrough at worker level: `SandboxedWorkflowRunner(restrictions=SandboxRestrictions.default.with_passthrough_modules("myapp"))`.
- Tiny escape hatch: `with workflow.unsafe.sandbox_unrestricted(): ...`. Use rarely and never for I/O.
- Keep workflow modules small and free of import-time side effects. Do not share mutable module globals.
- Pydantic models as workflow and activity arguments: use `temporalio.contrib.pydantic.pydantic_data_converter` (the `PydanticAIPlugin` sets this for you).

## Time-skipping environment

```python
import pytest
from datetime import timedelta
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

@pytest.mark.asyncio
async def test_approval_times_out():
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="t", workflows=[DocReview],
                          activities=[notify_manager, remind_manager, escalate]):
            result = await env.client.execute_workflow(
                DocReview.run, "doc-1", id="review-doc-1", task_queue="t")
            assert result == "escalated"        # three one-day waits finished instantly
```

- `start_time_skipping()` downloads a test server on first use (needs network once; cache it in CI) and advances time while `execute_workflow` is awaited. Timers over days finish at once.
- To control time manually: `await env.sleep(timedelta(days=2))` between a signal and an assertion.
- `WorkflowEnvironment.start_local()` runs a real dev server with no time skipping; use it for tests that must not skip.
- Experimental in 1.35: per-workflow time skipping (`start_time_skipping_v2`, `TimeSkipper`) lets one workflow skip while others run in real time. Treat as unstable.
- Replace real activities with fakes of the same name and signature: `@activity.defn(name="notify_manager") async def fake(...)`.

## Activity tests

```python
from temporalio.testing import ActivityEnvironment

async def test_import_rows_resumes():
    env = ActivityEnvironment()
    env.info = replace(env.info, heartbeat_details=[5])   # simulate a retry
    assert await env.run(import_rows, "job-1") == 10
```

`env.on_heartbeat = lambda *d: seen.append(d)` records heartbeats. Test idempotency by calling the activity twice with the same input.

## Replay tests

Replay checks that new code still accepts histories of runs that already exist.

```python
from temporalio.client import WorkflowHistory
from temporalio.worker import Replayer

async def test_replay_history():
    history = WorkflowHistory.from_json("review-doc-1", open("tests/histories/review.json").read())
    await Replayer(workflows=[DocReview]).replay_workflow(history)
```

- Capture histories with `temporal workflow show --output json --workflow-id <id>` from a staging namespace, or from `handle.fetch_history()` in a test. Redact any personal data before committing; histories contain payloads.
- Run replay tests in CI against every committed history before any deploy.
- `Worker(..., max_cached_workflows=0)` forces replay on every task during normal tests, which exposes hidden nondeterminism early.
- `workflow_failure_exception_types=[workflow.NondeterminismError]` makes a nondeterminism fail the workflow in tests instead of retrying forever.

## What tests must not do

- Connect to Temporal Cloud or a shared namespace. Use the in-process environment or a local dev server; read the address from a test-only variable.
- Call real LLM, email or voice providers. Use the mock provider (`LLM_PROVIDER=mock`) or fake activities.
- Share workflow ids across tests; generate unique ids per test.

## Debugging checklist

1. `NondeterminismError`: diff the new workflow against the history's command order; add `patched()` or version the type.
2. Workflow stuck: check the worker is polling the right task queue and that the workflow code did not raise a non-workflow exception (those fail the task and retry).
3. Activity retried unexpectedly: look at the retry policy, `non_retryable_error_types`, and timeouts (start_to_close vs heartbeat).
4. Payload too large: store the data elsewhere and pass an id.
