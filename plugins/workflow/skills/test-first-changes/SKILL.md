---
name: test-first-changes
description: Use when about to implement a feature, bug fix or behaviour change in code that has or can have automated tests, and before writing the implementation. Also when the owner says "TDD", "write tests first" or "forget the tests". Not for where tests live and what to mock (engineering-craft:planning-tests) or for pure visual tweaks.
---

# Test-first changes

Write the test, watch it fail for the right reason, write the least code that passes, then tidy. The failing run is the proof that the test can catch the bug.

## When to use

- New behaviour, a bug fix, a refactor that needs a safety net.
- The owner asked for tests first, or the project guidance mandates it.

## When not to use

- Deciding the test layer, fixtures and mocks policy: engineering-craft:planning-tests (read it when the test needs data, time, Temporal or a provider).
- Pure visual or copy tweaks, throwaway spikes, generated code and config-only edits, when the owner said tests are not wanted for them. Verify those in the browser instead (design-studio:verifying-ui-in-browser).
- Diagnosing an unknown failure: debugging-systematically builds the red loop, and this skill turns it into the permanent test.

## Procedure

1. **Check the rule in force.** Read the project guidance. The owner's default for code is tests first, run before saying done. "Forget testing" or "no need to test" from the owner, for a stated scope, overrides it for that scope only. Say which applies in one line.

   **Done when:** you know whether this change is test-first, test-after or untested by the owner's choice.

2. **Write one failing test** for the next behaviour: one behaviour per test, a name that states it, real code paths, and mocks only at the edges (no real LLM, voice, email or payment provider; opt-in integration checks are guarded by env vars). For a bug, the test is the reproduction from the red loop.

   **Done when:** the test file is saved.

3. **Run it and read the failure.** It must fail, and for the reason you expect: an assertion on missing behaviour, not an import error or a typo. If it passes at once, the test proves nothing: tighten it or delete it. Show the failing output.

   **Done when:** failing output is on screen and matches the expected reason.

4. **Write the least code that passes.** No extra options, no speculative generality, no other behaviours. Run the test; show it green. Run the neighbouring tests; they stay green.

   **Done when:** the new test and the related suite pass in this run.

5. **Tidy under green.** Remove duplication, improve names, keep the suite green. Do not add behaviour in this step. For deeper cleanup of the whole change, use simplifying-code after the feature works.

   **Done when:** the suite is green after the last edit.

6. **Repeat per behaviour,** committing at green points with the test and the code together. When wiring a whole feature, add one end-to-end or integration check last, with mocks for external services.

7. **Code written before the test.** If you wrote implementation first by mistake and the work is small, move it aside, write the test, watch it fail, restore the code. If the work is large and verified, add the characterising tests now and say plainly that it was test-after.

   **Done when:** every new behaviour has a test that was seen to fail or is labelled as test-after.

## Quick reference

| Situation | Do |
|---|---|
| Bug report | Failing test that reproduces it, then the fix |
| Test passes immediately | It tests existing behaviour; change it |
| Hard to test | The design is too coupled; extract the logic and test that |
| Many mocks needed | Test at a higher layer with fewer mocks |
| Owner: "no tests for this" | Respect it for that scope, verify by running the app |
| Flaky test | Never retry until green; debugging-systematically |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "Too simple to test" | The test is two lines; write it. |
| "I'll add tests after" | After-the-fact tests pass by construction. Write first. |
| "I already tested it by hand" | Hand tests do not run next week. |
| "The test is hard to write" | That is design feedback. Simplify the interface. |
| "Keep my code as reference" | Delete it and start from the test. |

## Verification

- [ ] Each new behaviour has a test that failed before the code and passes now, or is labelled.
- [ ] The failing output was shown for the reason expected.
- [ ] No test hits a real LLM, voice, email or payment provider without an env-guarded opt-in.
- [ ] The wider suite was run after the last change.
- [ ] Skipped tests are skipped only because the owner said so, and the report says it.

## References

| File | Load when |
|---|---|
| references/test-quality.md | the test feels brittle, over-mocked or hard to name |
