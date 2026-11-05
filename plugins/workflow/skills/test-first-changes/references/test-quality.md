# Test quality

A good test is small, names one behaviour, and fails for exactly one reason.

| Quality | Check |
|---|---|
| Names behaviour | `rejects an expired invite` rather than `test1` or `works` |
| One reason to fail | One main assertion; several asserts only when they describe one outcome |
| Real paths | Calls the real function with real data shapes; the mock sits at the network, clock, filesystem or provider edge |
| Independent | Runs alone and in any order; creates and removes its own data |
| Deterministic | Time, randomness and ids are injected or pinned; waits are on conditions |
| Readable failure | The failure message tells which input produced which wrong output |

## Smells

- Asserting that a mock was called, when the observable result is available.
- Test-only methods added to production classes.
- Copying the implementation's logic into the test to compute the expected value.
- Snapshot of a huge object nobody reads.
- A mock whose shape was guessed instead of taken from the real response.

## Mocking the owner's usual edges

LLM providers, LiveKit and voice, Resend and email, payment providers, and the clock are always faked in tests. A recorded real response, trimmed and checked in, is a better fake than an invented one. An opt-in integration test is allowed only when an env variable guards it and the default run skips it.
