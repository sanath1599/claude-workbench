---
name: planning-tests
description: Use when deciding what tests to write or where they go, fixing a bug, tests are flaky or slow, a test needs sleeps, Temporal workflows need testing, or something must be mocked. Also before adding a test that touches an LLM, voice or email provider. Not for walking the product as a user (running-qa-passes) or framework test syntax.
---

# Planning tests

Pick the cheapest test that would catch the failure, reproduce bugs red before fixing them, wait on conditions instead of time, and keep real providers out of the default run.

## When to use

- New feature or refactor: which tests, at which layer.
- A bug report: before touching code.
- Flaky tests, `sleep` in tests, slow suites.
- Testing Temporal workflows, webhooks, queues or LLM features.

## When not to use

- Exploratory product walks and the smoke report: `running-qa-passes`.
- Designing the failure handling that tests will verify: `hardening-distributed-systems`.
- Browser mechanics and screenshots: `design-studio:verifying-ui-in-browser`.

## Procedure

### 1. Place each behaviour at a layer

| Layer | Covers | Tools in this stack | Providers |
|---|---|---|---|
| Unit | Pure logic: scoring caps, parsing, state machines, validators | pytest, Vitest | none |
| Integration | Code with its real database: queries, migrations, transactions, API routes via client | pytest or Vitest against a real local Postgres (Docker, non-default port) | LLM, voice, email faked |
| Contract | Server matches OpenAPI; client matches server | generated client, `oasdiff` (`designing-apis`) | faked |
| Workflow | Temporal workflows and activities | Temporal test environment with time-skipping; replay of recorded histories | activities stubbed |
| E2E | Real user journeys through the real UI | Playwright with mock LLM and mock voice | all mocked |
| Opt-in live | One smoke check per real provider | guarded by an env var, skipped by default | real |

Test the behaviour at the lowest layer that can fail for that reason. A scoring cap is a unit test. A unique constraint is an integration test. A signup journey is E2E. Integration tests use a real Postgres, not an in-memory fake, because constraints, transactions and SQL dialect are what break.

**Done when:** each new behaviour is listed with its layer.

### 2. Bugs: red loop first

Before any fix, build one command that fails because of the bug, deterministically. Run it and show the failure. Order of attempts: a failing unit test; an integration test with the exact data; a replayed request or recorded workflow history; a Playwright script; a script that loops until it fails with a seed printed. Only then change code. After the fix the same command passes. Keep the test.

**Done when:** the failing output was shown before the fix and the passing output after.

### 3. Wait on conditions, never on time

Replace `sleep(2)` and fixed timeouts with a poll on the thing you need: a row exists, an element is visible, a message arrived, a workflow state changed.

```python
async def wait_for(predicate, timeout=5.0, interval=0.05):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if (value := await predicate()):
            return value
        await asyncio.sleep(interval)
    raise TimeoutError("condition not met")
```

In Playwright use web-first assertions (`await expect(locator).toBeVisible()`), not `waitForTimeout`. Inject clocks for code that depends on time (`now` as a parameter, fake timers), and seed randomness.

**Done when:** no `sleep` remains in tests without a comment explaining it.

### 4. Temporal tests

Use the test environment with time skipping so a 7-day timer runs instantly. Test: the happy path, each activity failing with a retryable and a non-retryable error, a signal arriving early/late/twice, cancellation, and compensation order. Add a replay test that loads a saved history and replays it against the current workflow code, to catch non-determinism before deploy. Stub activities; test activities separately as ordinary functions. Details of the API: `stack-python:orchestrating-with-temporal`.

**Done when:** a workflow change cannot ship without a passing replay test.

### 5. Mocks policy

- Never call a real LLM, voice or email provider from the default test run, CI or E2E. Use recorded responses, a fake server or an injected stub that implements the same interface.
- Mock at the boundary you own (an `LlmClient` protocol, an `EmailSender` protocol), not deep inside a library.
- Do not mock the database for integration tests. Do not mock the code under test.
- A fake must be able to fail: give it modes for timeout, 500, malformed output and duplicate delivery.
- Opt-in live checks: put them in a separate marker or folder, skip unless the env var is set (for example `RUN_LIVE_LLM=1` plus the provider key), keep them to one cheap call, and never run them in CI by default.

```python
live = pytest.mark.skipif(not os.getenv("RUN_LIVE_LLM"), reason="opt-in: set RUN_LIVE_LLM=1")

@live
def test_real_model_returns_valid_judgement(): ...
```

**Done when:** the default test command passes with no network access to providers and no provider keys set.

### 6. Check the tests themselves

For critical logic, remove or break the code under test and confirm a test fails (a manual mutation, or a mutation-testing tool). A test that passes with the logic deleted is decoration. Where the owner asks for TDD, write the test first and show it red. Where the owner says no tests are needed (for example a purely visual tweak), do not add any and verify by screenshot instead.

**Done when:** each critical test was seen to fail without its logic.

## Quick reference

| Smell | Fix |
|---|---|
| Test passes alone, fails in the suite | Shared state: isolate per test with transactions or fresh schemas |
| Flaky E2E | Replace waits with assertions on visible state; stub time and network |
| Slow integration suite | Reuse one database, truncate per test; run migrations once |
| Test needs a real key | It belongs in the opt-in tier |
| Mocks everywhere, bugs in production | Move the test down to a real database or up to E2E |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "I will write the test after the fix" | Then you never saw it fail. Reproduce first. |
| "A short sleep is fine" | It is a flaky test on a slower machine. Wait on a condition. |
| "SQLite is close enough" | Constraints, JSONB, locks and types differ. Use real Postgres. |
| "Just one real LLM call in CI" | Costs money, flakes, and leaks data. Opt-in only. |

## Verification

- [ ] Every new behaviour has a test at the lowest useful layer.
- [ ] Bug fixes show red before green.
- [ ] No unexplained sleeps; no provider calls in the default run.
- [ ] Workflow changes covered by time-skipping and replay tests.
- [ ] Integration tests ran against real local Postgres.

## References

| File | Load when |
|---|---|
| references/recipes.md | writing a Postgres fixture, a fake provider, a Temporal test or a Playwright mock |
