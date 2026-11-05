---
name: answering-pr-reviews
description: Use when asked to review a pull request, respond to PR review comments, "address all the comments", "do the same for all comments on the PR", or run a code review before merge or deploy. Not for writing the PR description or committing (superpowers:finishing-a-development-branch) or a security audit (reviewing-security).
---

# Answering PR reviews

Every review comment gets a fix or a justification, nothing is posted unverified, and a code review runs before merge or deploy. The record lives in `pr_N_review.md`.

## When to use

- "Review PR 42", "go through the comments on this PR", "reply to the reviewer".
- Before merging or deploying: run a review and act on it.
- A reviewer's suggestion seems wrong or unclear and needs checking.

## When not to use

- Finishing and integrating a branch: `superpowers:finishing-a-development-branch`.
- A security-specific audit: `reviewing-security`.

## Procedure

### Mode A: reviewing a PR (you are the reviewer)

1. Fetch the PR with `gh pr view N --json title,body,files,baseRefName,headRefName,isDraft,state` and `gh pr diff N`. Skip closed or draft PRs unless asked.
2. Read the diff in context: the changed files in full where the change is not obvious, the tests, and the project's CLAUDE.md rules.
3. Run the repo's checks on the PR branch (tests, type check, lint, build). Report failures with output.
4. List candidate findings: bugs, rule violations, missing tests, risky migrations, security issues. Include file and line, why it matters, and a suggested fix.
5. Validate each candidate with a second pass: re-read the code, try to disprove it (is it handled elsewhere, is the path reachable, does a test cover it). Drop what does not survive. Run reviews on `sonnet`. For a whole-branch review, follow `workflow:reviewing-code-before-merge`: focused reviewers in parallel, an independent verifier for each finding, a false-positive filter and a counts line. Use this mode only for the `pr_N_review.md` write-up and the reply to the author.
6. Write `pr_N_review.md` using `assets/pr-review-template.md`. Post comments to GitHub only when the owner says to, and only validated findings.

**Done when:** `pr_N_review.md` exists with only validated findings, each with file, line and a fix suggestion.

### Mode B: answering comments (you are the author)

1. Pull every comment: `gh api repos/{owner}/{repo}/pulls/N/comments --paginate` and `gh pr view N --comments` for review summaries. List them all with ids, including resolved ones you still need to acknowledge. Read the whole set before changing anything. If any item is unclear, ask about the unclear ones first, because related items often depend on each other; do not implement the clear ones and ask about the rest later.
2. For each comment, restate the requirement in your own words and check it against the code, then decide before editing. Do not open a reply with praise or "you are right"; say what you changed or why you did not.
   - Correct and clear: fix it.
   - Correct but already handled elsewhere: point to where, with the line.
   - Unclear: verify what the reviewer means from the code before acting; ask in the reply only if still ambiguous.
   - Asks for a feature nothing uses: search the code for real callers first, and propose removing it instead of building it.
   - Wrong, or trading something worse: defend it with evidence (test, benchmark, doc link, constraint) in a polite, specific reply. Defend where needed; do not accept a suggestion that breaks behaviour just to close a thread.
3. Make the fixes with tests where behaviour changes; run the full checks. For a large review, state the round's constraint up front ("no breaking changes"), and put anything that would change business behaviour under "decision needed" with a proposal. Call out any change to an endpoint's contract explicitly.
4. Record each comment in `pr_N_review.md`: comment id, summary, decision (fixed, justified, deferred with issue), commit hash or reasoning. For a large review make it an audit table, one row per thread: final status (fixed, removed, justified, decision needed, n/a), the change, and why it is non-breaking. Verify each row against the current code, not against the earlier reply.
5. Run a code review of the final diff (the `code-review` skill, on sonnet) before asking for merge or deploy. Fix what it validates.
6. Reply on GitHub only when asked, one reply per comment: what changed and where, or why not.

**Done when:** every comment id appears in `pr_N_review.md` with a decision, checks are green and shown, and the final code review ran.

## Quick reference

| Reviewer says | Do |
|---|---|
| "Rename X" | Do it unless it breaks a public contract; reply with the commit |
| "Why not Y?" | Answer with the trade-off; change only if Y is better for a stated reason |
| "This is a bug" | Reproduce with a failing test first; fix; reply with the test name |
| Vague "clean this up" | Ask what outcome they want, or pick the smallest change and say what you did |
| Suggestion that conflicts with an earlier decision | Link the ADR or decision and defend |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "Resolve it, it is minor" | Every comment still gets a recorded answer. |
| "The reviewer is senior, just do it" | Verify first. Wrong suggestions applied blindly become bugs. |
| "Post all findings, let them sort it out" | Unverified comments waste the author's time. Validate first. |
| "Merge now, review after" | Review before merge or deploy. |

## Verification

- [ ] Every comment is in `pr_N_review.md` with a decision and evidence.
- [ ] Fixes have tests where behaviour changed; checks green with output shown.
- [ ] Final code review run; validated findings addressed.
- [ ] Nothing posted to GitHub unless asked.
- [ ] After merging two branches that touched the same area: the app boots (import every module once), CI paths still resolve, and any changed test expectation is explained. A module deleted on one branch can come back from the other.

## References

| File | Load when |
|---|---|
| assets/pr-review-template.md | writing `pr_N_review.md` |
