---
name: finishing-a-branch
description: Use when the work on a branch is built and checked and the next step is integrating it: merge, open a PR, keep it, or discard it, and clean up the worktree. Triggers on "wrap this up", "push the code, create a PR and merge it", "we're done, ship the branch". Not for the production deploy itself (workbench:shipping-to-production) or commit rules (workbench:committing-and-pushing).
---

# Finishing a branch

Confirm the work is green, confirm the base, then take the integration path the owner's setup implies, and leave no loose ends: no stray worktree, no unmerged cloud branch, no unreported follow-up.

## When to use

- A plan is executed and reviewed (executing-plans) and the branch must land.
- The owner says to push, open a PR, merge, or wrap up.
- A parallel session or a cloud run finished and its branch needs integrating.

## When not to use

- Commit message and co-author rules, secret scans: workbench:committing-and-pushing.
- Anything that deploys to production or migrates a shared database: workbench:shipping-to-production, which needs the owner's go.
- Landing a cloud session's work in detail: kickoff:landing-cloud-work.

## Procedure

1. **Verify.** Run the full test suite, the build and the type-check now (verifying-before-done). If anything fails, fix it before going on; no menu on a red branch. Confirm the review pass happened (reviewing-code-before-merge) or that the owner skipped it.

   **Done when:** command output shows green in this run.

2. **Read the situation.** Run `git status`, `git branch --show-current`, `git log --oneline origin/main..HEAD`, and check whether this is a linked worktree (`git rev-parse --git-dir` differs from `--git-common-dir`) or a detached HEAD. Uncommitted work is committed first or reported. Work still sitting on other branches, open PRs or cloud runs for the same project is listed.

   **Done when:** you know the branch, the base, the commits ahead, and whether it is a worktree.

3. **Confirm the base.** The base is the branch this work forked from: the plan, the upstream, or the owner's words. If it is unclear, say your best guess and ask in one line. Merging into the wrong base is the expensive mistake here.

   **Done when:** the base branch is named.

4. **Take the owner's usual path.** Default for this owner: push the branch, open a PR to the base, and merge it yourself once checks pass, when the project's rules allow it. Respect project overrides in `.claude/workbench.json` or CLAUDE.md (for example "do not push" or "ask before push"). Choose by situation:

   | Situation | Path |
   |---|---|
   | Normal feature branch, owner said merge | Push, open PR, wait for checks, merge, delete the remote branch |
   | Project says ask before pushing or merging | Present the options in one question with the recommended one first |
   | Repo has no remote | Merge locally into the base, rerun the tests on the merged result |
   | Work is exploratory | Keep the branch, push it, record where it is |
   | Owner asks to discard | Show what will be lost (commits and files) and get a typed confirmation; never delete otherwise |
   | Detached HEAD in a managed worktree | Create a named branch at finish time, then push |

   Never merge when checks are red. Never force-push the base. If the base moved, rebase or merge it in and rerun the checks.

   **Done when:** the chosen path is complete, with the PR URL or the merge commit as evidence.

5. **Check after merge.** Pull the base, rerun the tests on it, and confirm the CI run on the base is green. If auto-deploy is wired to the base branch, name that in the report; the production go is a separate decision (workbench:shipping-to-production).

   **Done when:** the merged base builds and tests green.

6. **Clean up.** Remove the worktree only if you created it and the branch is merged or kept elsewhere (`git worktree remove`, then `git worktree prune`). Delete the local branch after merge. Leave a worktree you did not create. Stop dev servers and background agents you started. Disable any one-time schedules that you used so they cannot fire twice. Never delete files, repos or artifacts the owner did not ask you to.

   **Done when:** `git worktree list` and `git branch` show only what should remain.

7. **Report and note follow-ups.** Give: what landed (PR link, commit), evidence (test counts, CI link), what is parked in NEXT_STEPS.md, and the owner-only steps as `! <command>` lines. If the README or the spec changed meaning, update it in the same PR.

   **Done when:** the final message has a link or hash and no unexplained leftovers.

## Quick reference

| Question | Answer |
|---|---|
| Merge with a red check? | No. |
| Delete a branch with unmerged commits? | Only on explicit confirmation. |
| Who authors the commits? | Per the repo rules; see workbench:committing-and-pushing. |
| Squash or merge commit? | Follow the repo's history style; squash when the commits are noisy. |
| Cloud branch also exists? | Land it or close it; report which. |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "Tests passed an hour ago" | Run them on the final state. |
| "The base is obviously main" | Confirm; forks of forks exist. |
| "Leave the worktree, the owner may want it" | Remove the ones you made once merged; list the others. |
| "Merge now, check CI later" | Wait for the run, then merge. |

## Verification

- [ ] Tests and build were green in this run, and on the merged base.
- [ ] The base branch was confirmed.
- [ ] The report links the PR or merge commit.
- [ ] No worktree, branch or schedule is left that should not remain.
- [ ] Nothing was deployed or migrated in production without the owner's go.

## References

| File | Load when |
|---|---|
| references/git-commands.md | checking worktree state, rebasing onto a moved base, or cleaning up |
