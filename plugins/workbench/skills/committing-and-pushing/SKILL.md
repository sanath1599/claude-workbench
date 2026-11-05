---
name: committing-and-pushing
description: Use when about to commit, push, branch, open or merge a PR, or when unsure whether to commit at all, which branch to use, or whether to add a co-author trailer. Also when a push or deploy is rejected because of the commit author. Not for answering review comments, which is engineering-craft:answering-pr-reviews.
---

# Committing and pushing

Each project's git policy lives in `.claude/workbench.json`, and that file wins. Without it, use the defaults below. The guard hook secret-scans every commit and push, so never route around it.

## When to use
- Any `git commit`, `git push`, branch creation, `gh pr create` or merge.
- A Vercel deploy refuses a commit ("commit author ... not a member", "Git author must have access").

## When not to use
- Replying to PR feedback: engineering-craft:answering-pr-reviews.

## Procedure

1. **Read the policy.** Check `.claude/workbench.json` for these keys:

   | Key | Values | Meaning |
   |---|---|---|
   | `commits` | `per-increment` / `on-request` / `ask` | commit at each verified increment, only when told, or ask once |
   | `branchPolicy` | `feature-branch` / `branch-per-commit` / `main` | where commits go |
   | `coAuthorTrailer` | `true` / `false` / `ask` | add or omit the `Co-Authored-By: Claude` trailer |

   If the file is missing, or a value is `ask`, ask once with AskUserQuestion. Recommend `per-increment` + `feature-branch` + trailer `true`, unless Vercel Hobby deploys this repo, in which case recommend trailer `false`. Write the answer into `.claude/workbench.json` so nobody asks again.
   **Done when:** the policy is known.

2. **Before committing:**
   - Commit or stash pending work before switching branches. Never discard uncommitted work you didn't create.
   - Check `git status` for files you didn't touch. Another session may be working in the same repo; don't commit its files.
   - Never commit `.env*` (except `.env.example`), keys, `graphify-out/` caches or build output.

3. **The commit itself:**
   - Message: a short imperative summary, optionally prefixed by area the way the owner's history does ("QA: …", "Docs: …", "UI review: …"), plus a body when the why isn't obvious.
   - Trailer: follow `coAuthorTrailer`. When it is `false`, omit every AI attribution, even if a harness template suggests one; the owner's project setting wins.
   - Author: for repos that Vercel deploys on the Hobby plan, the author must be `{{wb.git_author_email}}`. Set it per repo: `git config user.email "{{wb.git_author_email}}"`. Vercel rejects commits by other authors (Hobby has no team seats).
   - Never use `--no-verify` or disable hooks to get past a check. Fix the cause.

4. **Pushing:** push before deploying, and before handing off to a cloud session (a cloud session sees only what is pushed). Ask the owner before any force push (the hook enforces this). The hook scans what the push would publish; if it blocks, remove the secret, rewrite the local commit, and tell the owner the secret needs rotating if it was ever pushed anywhere.

5. **PRs and merges:**
   - Run a code review (the `code-review` skill or engineering-craft) before merging or deploying.
   - "Push, create a PR to main and merge it" means do all three, then report the PR URL and merge commit.
   - Cloud sessions work on a feature branch and never merge to main; the local session merges after re-running the checks (kickoff:landing-cloud-work).

## Quick reference

| Situation | Do |
|---|---|
| No policy file | ask once, write `.claude/workbench.json` |
| Vercel Hobby repo | author `{{wb.git_author_email}}`, no co-author trailer |
| Owner said "only commit when I ask" | `commits: on-request`; stop after tests pass |
| Owner said "every commit on its own branch" | `branchPolicy: branch-per-commit`; `git switch -c <change-name>` before each commit |
| Secret-scan block | remove the secret, never bypass; rotation if it ever left the machine |

## Verification
- [ ] The policy came from the file or from a one-time answer that is now saved.
- [ ] `git status` is clean except for intentional leftovers you named.
- [ ] The push succeeded; the branch and commit hash are reported.
