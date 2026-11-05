---
name: verifying-before-done
description: Use when about to say work is done, fixed, passing, deployed, sent or ready, before committing, opening a PR or reporting back, and whenever a subagent reports success. Not for UI-specific browser checks (design-studio:verifying-ui-in-browser) or pre-deploy gates (workbench:shipping-to-production).
---

# Verifying before done

No claim of success without output from a command run in this same turn. Say what was checked, show what came back, and name what was not checked.

## When to use

- Before any sentence like "done", "fixed", "works", "tests pass", "deployed", "email sent".
- Before a commit, push, PR or final report.
- When a subagent or cloud run says it succeeded.

## When not to use

- Browser and responsive checks for UI: design-studio:verifying-ui-in-browser (use it in addition for UI work).
- The go/no-go gate for production changes: workbench:shipping-to-production.
- Judging code quality: reviewing-code-before-merge.

## Procedure

1. **Name the claim.** Write the one sentence you are about to say, for example "the invite flow works" or "the build is clean".

   **Done when:** the claim is a concrete sentence.

2. **Pick the command that would prove it, and one that would disprove it.** Use the table below. The command must exercise the real thing: the test suite for logic, the build for compilation, the running app for behaviour, the live URL for a deploy.

   | Claim | Evidence required | Not enough |
   |---|---|---|
   | Tests pass | Full test command output with counts and exit code | An earlier run, "should pass" |
   | Build works | Build command, exit 0 | Lint or type-check alone |
   | Bug fixed | The original reproduction now passes | Code changed |
   | Feature works | Run it: request, page, or script with real output | Unit tests only, when the feature has a UI or API |
   | Deployed | Deployment id, URL fetched with expected status and content | "Push succeeded" |
   | Email or SMS sent | Provider response id or inbox check (and the owner's go beforehand) | The send call returned |
   | Subagent finished | Its diff exists and its command reruns green | Its report |
   | Requirements met | A line-by-line checklist against the spec | Tests passing |

   **Done when:** you have the exact command and know what output would mean failure.

3. **Run it fresh.** Run the full command in this turn, not a subset, unless a subset is what the claim covers. Read all of the output: failures, warnings, skipped counts, exit code.

   **Done when:** output is in front of you.

4. **Compare output to claim.** If the output contradicts the claim, report the real state with the evidence and keep working. If a check cannot be run here (no credentials, no network, the owner's machine), say that plainly and give the exact command for the owner as `! <command>`.

   **Done when:** the claim is confirmed, corrected, or marked unverified with a reason.

5. **Report in this shape.** Status first, then evidence, then gaps.

   ```
   Status: <done | partly done | blocked>
   Verified: <command> -> <result (counts, exit code, URL status)>
   Not verified: <what and why, and the command the owner can run>
   ```

   Keep the tone factual. No celebration words before the evidence. Do not hide a failing check because the rest passed.

   **Done when:** the report contains at least one real command and its result.

6. **Re-verify after any edit.** Changing a file after a green run voids the run. Rerun before the final claim.

## Quick reference

| Temptation | Do |
|---|---|
| "Should work now" | Run it |
| "Agent said it passed" | Check the diff, rerun |
| "Linter is clean, so the build is fine" | Run the build |
| "It is only a comment change" | Still run the suite once before commit |
| Check is slow | Run it in the background and wait for it; do not skip it |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "I am confident" | Confidence is not output. |
| "Partial check is enough" | State exactly what the partial check covers and no more. |
| "The owner is waiting" | A wrong "done" costs them more than a minute of checks. |
| "Same code as before" | Run it; environments drift. |

## Verification

- [ ] Every claim in the final message maps to a command run in this turn.
- [ ] Failures, warnings and skips in the output were read, not skimmed.
- [ ] Unverified items are listed with the reason and the owner's command.
- [ ] No deploy, send or launch is claimed without a URL, id or response.

## References

| File | Load when |
|---|---|
| references/evidence-by-work-type.md | choosing evidence for a kind of work not in the table |
