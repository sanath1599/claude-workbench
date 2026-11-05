---
name: debugging-systematically
description: Use when something is broken or surprising: a failing test, an error or stack trace, wrong output, a flaky run, "it works locally but not in prod", a regression, or a slow path. Also when a first fix did not work. Not for a live production outage (ops-and-sre:handling-incidents) or for choosing which tests to write (engineering-craft:planning-tests).
---

# Debugging systematically

Find the cause before touching the code. A fix without a located cause is a guess, and a second guess on top of a first one is how bugs multiply.

## When to use

- Any failure whose cause is not already obvious from the message.
- A previous fix did not work, or the same bug came back.
- Intermittent failures, performance regressions, build or deploy failures.

## When not to use

- Production is down and users are affected: ops-and-sre:handling-incidents first (mitigate, then come back here for the root cause).
- The error message names the exact line and the fix is mechanical, such as a typo: fix it and run the check.
- Designing the permanent test layout: engineering-craft:planning-tests.

## Procedure

1. **Build the red loop.** Make one command that fails because of the bug, quickly and the same way every time. Prefer, in order: a failing unit test; an integration test with the exact data; a replayed request, log line or recorded workflow history; a browser script; a loop that runs until it fails and prints its seed. Run it and show the failing output. If the failure is flaky, raise the rate (more iterations, fixed seed, narrower timing) until it fails on demand. If you cannot reproduce it, say so and gather more data (logs, versions, the exact inputs) instead of guessing.

   **Done when:** a command exists, its failing output is on screen, and you know how long it takes.

2. **Read the evidence.** Read the whole error and stack trace, not the first line. Check what changed: `git log`, `git diff`, dependency bumps, config and environment differences, the time it started. Write one sentence stating expected versus actual behaviour.

   **Done when:** you can state the symptom, the first bad commit or change if one exists, and what has been ruled out.

3. **Narrow it.** Pick the cheapest narrowing move for the situation.

   | Situation | Move |
   |---|---|
   | Regression with a known good commit | `git bisect run <red loop>` |
   | Many components in a chain | Log or print what enters and leaves each boundary, run once, find the first wrong value |
   | Big input | Shrink the input until removing anything makes it pass |
   | Works elsewhere | Diff the working and failing environments or inputs |
   | Value is wrong deep in the stack | Trace backwards to where it first became wrong; fix there, not at the symptom |

   Remove temporary instrumentation afterwards.

   **Done when:** the failure is pinned to one component, one function or one input.

4. **State hypotheses and test them one at a time.** Write down each hypothesis as "X is the cause because Y; if true, Z will happen". Design an observation that can disprove it, change one thing, run the red loop. If it is disproved, record that and move on. If three hypotheses fail, stop and question the model of the system: re-read the code path from the entry point, or look for a working example elsewhere in the repo and diff against it. Do not stack fixes.

   **Done when:** one hypothesis is confirmed by an observation, not by the fix happening to work.

5. **State the root cause.** One or two sentences: what is wrong, why it produced this symptom, and why it was not caught. Check for siblings: the same mistake in other places.

   **Done when:** the cause is written in the reply or the commit message.

6. **Fix once, at the cause.** Make the smallest change that removes the cause. Keep the red loop as a regression test (see test-first-changes) unless the owner said tests are not wanted for this. Add a guard where the bad value entered if the system allows invalid states to travel far. Run the red loop (now green), then the wider suite.

   **Done when:** the red loop passes, the suite passes, and nothing unrelated changed.

7. **Report with evidence** (verifying-before-done): the cause, the fix, the before and after output, and any sibling risks you did not touch. If the investigation shows there was no deterministic cause (timing, external service), say so, add handling and logging, and name what you will watch.

## Quick reference

| Symptom | First move |
|---|---|
| Test fails after a change | Read the diff, rerun that test alone |
| Flaky test | Loop it with a seed; look for shared state, time, order, network |
| "Works locally" | Compare env vars, versions, data, build mode |
| Slow | Measure first (profile or timing logs); do not optimise by eye |
| UI wrong | Reproduce in the browser, read console and network, check computed state |
| Third failed fix | Stop. Re-read the path from the entry point. |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "I can see the problem, just fix it" | Show the red loop fail first; it takes a minute and proves you are fixing the right thing. |
| "Try this and see" | A try is a hypothesis. Write the prediction first. |
| "It passes now, so it is fixed" | Passing after a guess proves nothing. Confirm the cause. |
| "Add a retry or a sleep" | That hides the cause. Wait on a condition; find the race. |
| "Fix a few other things while here" | One cause, one change. Park the rest. |

## Verification

- [ ] The failing output was shown before any fix.
- [ ] The root cause is stated, and a failed hypothesis is not presented as the cause.
- [ ] The same command passes after the fix, and the wider suite was run.
- [ ] Temporary logging and scripts are gone.
- [ ] Sibling occurrences were checked.

## References

| File | Load when |
|---|---|
| references/instrumenting.md | adding temporary probes across components, bisecting, or hunting a flaky test |
