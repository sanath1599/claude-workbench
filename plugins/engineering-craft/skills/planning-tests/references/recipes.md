# Recipes

## Postgres per-test isolation (pytest)

Run one local Postgres (Docker, non-default port, for example 5434). Create the schema once per session, then wrap each test in a transaction that is rolled back.

```python
@pytest.fixture
async def conn(pool):
    async with pool.acquire() as c:
        tx = c.transaction()
        await tx.start()
        try:
            yield c
        finally:
            await tx.rollback()
```

Tests that exercise commit behaviour or concurrency need their own database or schema and a cleanup step instead.

## Fake provider with failure modes

```python
class FakeLlm:
    def __init__(self, responses=None, mode="ok"):
        self.responses, self.mode, self.calls = list(responses or []), mode, []

    async def complete(self, prompt: str, schema: dict):
        self.calls.append(prompt)
        if self.mode == "timeout":
            raise TimeoutError
        if self.mode == "malformed":
            return "not json"
        return self.responses.pop(0)
```

Assert on `calls` to check that untrusted content was delimited and that the schema was embedded.

## Temporal: time skipping and replay

Read the current Python SDK testing docs first. Shape:

```python
async with await WorkflowEnvironment.start_time_skipping() as env:
    async with Worker(env.client, task_queue="t", workflows=[Onboarding], activities=[fake_send]):
        handle = await env.client.start_workflow(Onboarding.run, args, id="wf-1", task_queue="t")
        await env.sleep(timedelta(days=7))     # skips instantly
        assert await handle.result() == "done"
```

Replay: save a workflow history JSON from a real run, then replay it with the SDK `Replayer` against the current workflow class; a non-determinism error means the change is not backwards compatible.

## Playwright with mocks

Serve the app with env that points the LLM and voice clients at local fakes (or route `**/api/llm/**` in the test). Use roles and labels for locators, `expect(...).toBeVisible()` for waits, one browser context per persona, and `storageState` for pre-authenticated personas. Capture traces on first retry.

## Webhook tests

Build a signed request in the test with the same helper the provider documents, then assert: valid signature accepted, tampered body rejected, old timestamp rejected, replayed event id a no-op.
