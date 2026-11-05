---
name: running-qa-passes
description: Use when asked to QA, test end to end, smoke test, walk through the app as a user, find bugs before release, or when finishing a feature that users will touch. Produces a severity-ranked list, fixes, E2E re-verification and a smoke-test report. Not for writing the unit and integration test plan (planning-tests) or browser mechanics (design-studio:verifying-ui-in-browser).
---

# Running QA passes

Walk the real product as each kind of user, write down everything wrong, fix it by severity, prove the fixes with automated end-to-end tests, and finish with a report. Never claim done without the report.

## When to use

- "QA it", "test it end to end", "do a smoke test", "check everything works", "I do not want to find a failure later".
- Before a merge to main, a deploy, or a handoff to a client.
- After a large change that touches several screens or flows.

## When not to use

- Deciding which unit, integration and E2E tests to write: `planning-tests`.
- Driving the browser, screenshots, responsive checks: `design-studio:verifying-ui-in-browser`.
- Security issues found on the way: record them, then `reviewing-security`.

## Procedure

### 1. Set up the environment

Start the app the way a user gets it: real local Postgres, seeded with realistic data (never the owner's personal data), mock LLM and mock voice, email captured not sent. Do not touch production. Record the commit hash and the commands used.

**Done when:** the app is running, the URL is known, and the seed data covers every persona.

### 2. List personas and journeys

Derive personas from the product: each role (for example HR admin, hiring manager, candidate, anonymous visitor), plus the hostile user and the first-time user. For each persona write 3 to 8 journeys from start to finish, including the unhappy paths: invalid input, expired link, no permission, empty state, slow network, double submit, back button, refresh mid-flow, phone-size screen.

**Done when:** a persona-by-journey list exists and every route in the app appears in at least one journey.

### 3. Walk it

Run `qa-auditor` for a broad walk, or do it yourself. Execute each journey in a real browser (see `design-studio:verifying-ui-in-browser`) and for each step check: it works, the copy is right, loading and empty and error states exist, the console is clean, the network has no failing calls, text is not truncated without "show more", it is usable on phone, tablet and desktop. Record every defect at once with steps to reproduce, expected and actual, and evidence (screenshot path, console line, response).

**Done when:** every journey has a pass or a logged defect, and none was skipped.

### 4. Rank by severity

Use the rubric:

| Severity | Meaning | Action |
|---|---|---|
| S1 Blocker | Data loss, security hole, a core journey cannot complete, wrong money or wrong decision about a person | Fix now; stop the release |
| S2 Major | Core journey works badly or only with a workaround; wrong output that a user may trust | Fix before release |
| S3 Minor | Cosmetic or secondary flow; clear workaround | Fix if cheap, else list |
| S4 Polish | Copy, spacing, nice-to-have | List in NEXT_STEPS.md |

Order inside a severity by how many users meet it.

**Done when:** every defect has a severity, and the list is sorted.

### 5. Fix loop

For each S1 and S2 (and cheap S3): write a failing test that reproduces it first (`planning-tests`, red loop), fix, see it pass, commit at a meaningful point. For pure visual tweaks where the owner said no test is needed, fix and verify by screenshot instead. Keep a changelog of fixes mapped to defect numbers.

**Done when:** each fixed defect has a failing-then-passing test or a screenshot pair, and no S1 or S2 is open.

### 6. Re-verify

Re-run the full E2E suite (mock LLM, mock voice) and re-walk the journeys that had defects, plus the main journey of every persona. If any new defect appears, return to step 4. Do not stop at "the fix looks right".

**Done when:** the E2E command output is green and shown, and the re-walk logged no new S1 or S2.

### 7. Report

Copy `assets/smoke-test-report.html` and fill it: scope, environment, personas, results per journey, defects found and fixed (with severity), defects left open and why, test command output, and a go or no-go line. Write HTML when the report will be shared with anyone; markdown is acceptable for internal notes. State what was not tested.

**Done when:** the report file exists, its numbers match the test output, and open items are named.

## Quick reference

| Check on every screen | Look for |
|---|---|
| States | loading, empty, error, success, disabled |
| Input | too long, empty, special characters, paste, double submit |
| Navigation | back, refresh, deep link, expired session |
| Layout | 375, 768 and 1280 px; no horizontal scroll; no clipped text |
| Console and network | zero errors, no 4xx/5xx you did not expect |
| Access | each route as the wrong role and logged out |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "Unit tests pass, so it works" | Walk the product. Unit tests do not see the broken button. |
| "I only changed one screen" | Re-walk the journeys that cross it. |
| "The fix is obvious, no re-test" | Re-verify; fixes break neighbours. |
| "Report later" | The report is the deliverable. Write it from the real output now. |

## Verification

- [ ] Every persona and every route walked, including unhappy paths.
- [ ] Defects sorted by severity with repro steps and evidence.
- [ ] No open S1 or S2; each fix has a test or a screenshot.
- [ ] Full E2E run green, output shown.
- [ ] Smoke-test report written; untested areas listed.

## References

| File | Load when |
|---|---|
| assets/smoke-test-report.html | writing the final report |
| assets/defect-template.md | logging a defect |
