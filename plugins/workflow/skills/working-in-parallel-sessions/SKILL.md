---
name: working-in-parallel-sessions
description: Use when other Claude sessions, background agents, worktrees, cron jobs or cloud runs may be active in the same repo, when starting feature work that needs isolation, when a resumed conversation might duplicate a scheduled job, or when unexpected files or commits appear. Not for briefing subagents (workbench:delegating-to-subagents) or cloud routines (kickoff:running-cloud-routines).
---

# Working in parallel sessions

Before starting, find out who else is working here. Isolate your changes, never touch what you did not create, and never leave a second copy of a scheduled job running.

## When to use

- Starting a feature, a plan execution or a long task in a repo you share with other sessions, agents or the owner's own edits.
- Dispatching parallel agents that write files.
- Creating, resuming or restarting a cron, loop or scheduled task.
- The tree has changes you did not make, or a branch moved under you.

## When not to use

- Writing briefs and choosing models for agents: workbench:delegating-to-subagents.
- Creating or inspecting cloud routines: kickoff:running-cloud-routines.
- Landing a finished cloud session's branch: kickoff:landing-cloud-work.

## Procedure

1. **Look before you start.** Run these and read the output.

   ```
   git status --short
   git branch --show-current
   git worktree list
   git log --oneline -5 --all --since="6 hours ago"
   ```

   Also list running agents and background tasks (the `ListAgents` tool when you have it, otherwise the session's task list) and the scheduled jobs (`CronList` or the scheduler's list). Changes in the tree that you did not make belong to someone else: another session, an agent, or the owner.

   **Done when:** you can say which branches, worktrees, agents and schedules exist and which are yours.

2. **Isolate.** If you are already in a linked worktree (git dir differs from the common dir, and you are not in a submodule), stay in it. Otherwise, when the work is more than a few minutes, will run alongside other work, or the tree is dirty with others' changes, create a worktree on a new branch. Use the native tool (`EnterWorktree`) when you have one; fall back to `git worktree add ../<repo>-<topic> -b <branch>`. Install dependencies, run the baseline checks, and record failures that were there before you.

   Small edits in a clean, solitary checkout need no worktree. Work on a feature branch, never on main, unless the owner said so.

   **Done when:** your edits land on your own branch in a place no other session writes to.

3. **Claim your files.** For parallel agents, give each an explicit list of files it owns and tell it not to edit others. Two writers on one file is a conflict you create on purpose. Shared files (lockfiles, generated code, index files, migrations) go to one agent or are done by you after the others finish. Each agent commits only its own files.

   **Done when:** no file appears in two ownership lists.

4. **Leave others' work alone.** Do not reset, checkout, stash, clean or reformat changes you did not make. If they block you, work around them in your worktree, or ask the owner in one line. If a peer session committed to your branch, rebase onto it rather than overwriting. Never `git add -A` in a shared tree; add your paths.

   **Done when:** `git diff` of your commits contains only files you intended.

5. **Check for duplicate schedulers before creating one.** A session-level cron fires only while that session is open and expires after about a week. A conversation resumed or forked from the same history can hold its own copy of the same cron, so two copies fire and publish twice. Before creating a recurring job:
   - list the existing jobs in this session and look for the same prompt or purpose;
   - check cloud routines and other schedulers for the same job;
   - give each job a name containing its purpose and, in its prompt, a first step that checks whether the work was already done (for example whether the article, PR or message already exists) and exits if so.

   If you find a duplicate, keep one and delete the other, and say which. When you resume a conversation that had crons, list them and remove the extras before doing anything else.

   **Done when:** exactly one job exists per purpose, and its prompt is idempotent.

6. **Sweep stranded work.** Before saying a task is complete, list branches, open PRs and background runs from this project that belong to the same task (`git branch -a --no-merged main`, `gh pr list`, agent list). Finish, land or close them, or report them by name. Stop background agents you started that are no longer needed.

   **Done when:** nothing of yours is left running or unlanded without being listed in the report.

7. **Hand over what you cannot see.** If another session might continue this work, leave a short note (branch, what is done, what is next, commands to resume) where the repo keeps such notes, such as NEXT_STEPS.md or the project's session-handoff file (kickoff:keeping-context-across-sessions).

## Quick reference

| Finding | Action |
|---|---|
| Dirty tree you did not make | Do not touch; use a worktree |
| Already in a linked worktree | Do not create another |
| Peer session on same branch | Make your own branch or coordinate with the owner |
| Two crons with the same prompt | Keep one, delete the other, report |
| Agent still running after you stopped | Stop it explicitly |
| Branch left by a cloud run | Land or close it, report |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "I'll just stash their changes" | Stashing hides someone's work. Use a worktree. |
| "Two agents can share this file, they edit different parts" | Merge conflicts and overwrites follow. One owner per file. |
| "The cron probably is not duplicated" | List it. It takes one call. |
| "Cleaning up other branches is helpful" | Report them; delete only what you created. |

## Verification

- [ ] Worktrees, branches, agents and schedules were listed before starting.
- [ ] Your edits are on your own branch, not main and not someone else's.
- [ ] No file has two writers; your commits contain only your files.
- [ ] One scheduled job per purpose, each idempotent.
- [ ] Leftover branches, runs and agents are landed, stopped or named in the report.

## References

| File | Load when |
|---|---|
| references/worktree-recipes.md | creating or removing a worktree by hand, or sharing dependencies between worktrees |
