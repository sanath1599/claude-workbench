---
name: simplifying-code
description: Use when code that was just written or changed in this session should be tidied for clarity, duplication or nesting without changing behaviour, or the owner says "clean this up", "simplify" or "refactor what we just did". Not for hunting bugs (reviewing-code-before-merge) or for restructuring a whole codebase.
---

# Simplifying code

Make recent changes easier to read and maintain while behaviour stays exactly the same. Prove sameness with the tests, not with confidence.

## When to use

- After a feature works and is committed, before the final review.
- A diff has grown tangled: deep nesting, copy-pasted blocks, one-use helpers, dead code left by iteration.
- The owner asks for a cleanup of recent work.

## When not to use

- A failing or unverified feature: finish it first (verifying-before-done).
- Looking for defects: reviewing-code-before-merge.
- A large redesign or a rename across the repo: that is a project; shape it (shaping-the-work).
- Style the formatter or linter already enforces: run the tool instead.

## Procedure

1. **Fix the scope and the safety net.** The scope is the lines changed in this branch or session: `git diff $(git merge-base origin/main HEAD)..HEAD --stat`. Do not touch other code unless the owner widens it. Run the project tests and record the result. If the changed code has no tests, either add characterising tests first (test-first-changes) or limit yourself to edits that are safe by inspection and say so.

   **Done when:** the scope is a file list and the baseline test run is green.

2. **Read the project's conventions.** CLAUDE.md, AGENTS.md, the linter and formatter config, and the neighbouring files. Your edits follow the repo's patterns, not your preferences. The owner's stack rules apply (for example the toast library, icon set and no emojis in UI).

   **Done when:** you can name two or three conventions your edits must respect.

3. **Find the candidates.** Look for, in this order of payoff:
   - Duplicated blocks that differ in one value: extract once, but only if there are three uses or the copies must stay in sync.
   - Nesting deeper than three levels: use early returns and guard clauses.
   - Conditions that can be named: a well-named boolean or small function.
   - Dead code, unused parameters, leftover debug output, commented-out blocks.
   - Abstractions with one caller and no reason to exist.
   - Comments that restate the code; keep comments that explain why.
   - Nested ternaries and dense one-liners: write them out.
   - Inconsistent names for the same concept in the same diff.

   **Done when:** a short list of candidate edits exists.

4. **Apply in small steps.** One kind of edit at a time. After each step run the tests and the type-check. If a step fails, revert that step and skip it. Never mix cleanup with a behaviour change; if you notice a bug, note it for the owner and leave it.

   Prefer clarity over fewer lines. If a rewrite is shorter but harder to read, do not make it. Do not rename public APIs, exported names, route paths, config keys or database columns.

   **Done when:** each applied edit has a green test run behind it.

5. **Confirm nothing changed in behaviour.** Run the full suite and the build. Compare the final diff against the original: the same inputs must give the same outputs, the same errors, the same side effects, in the same order. For UI, load the page.

   **Done when:** full checks are green in this run and the diff contains no behaviour change.

6. **Commit separately.** Use a message that says it is a cleanup, for example `refactor: simplify invite handler, no behaviour change`, so a revert is clean. Report what you simplified in a few lines and what you deliberately left alone.

For a large diff, hand steps 3 to 5 to the code-simplifier agent (sonnet) with the scope, the conventions and the test command.

## Quick reference

| Smell | Simplification |
|---|---|
| Arrow of nested ifs | Guard clauses, early return |
| Same block three times | One function with a parameter |
| Boolean soup in a condition | Named intermediate values |
| Wrapper that only forwards a call | Delete it |
| Option nobody passes | Remove it |
| Clever one-liner | Plain statements |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "While I am here I will fix this other thing" | Separate commit, separate decision. |
| "Tests are slow, skip them between steps" | Run the fast subset each step, the full suite at the end. |
| "Fewer lines is simpler" | Readable is simpler. |
| "This abstraction might be reused" | Remove it until a second use exists. |

## Verification

- [ ] The scope was the branch's own changes only.
- [ ] Tests and type-check were green before and after, in this run.
- [ ] The diff has no behaviour, API, config-key or schema change.
- [ ] The cleanup is its own commit.
- [ ] Anything suspicious that was noticed but not changed is listed for the owner.

## References

| File | Load when |
|---|---|
| references/safe-moves.md | unsure whether an edit can change behaviour |
