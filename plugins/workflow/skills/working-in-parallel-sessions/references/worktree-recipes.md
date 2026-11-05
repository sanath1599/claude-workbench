# Worktree recipes

## Create by hand

```
git fetch origin
git worktree add ../myrepo-invite-flow -b feat/invite-flow origin/main
cd ../myrepo-invite-flow
```

Keep worktrees outside the repo directory, or inside a directory that is git-ignored. If you use a project-local directory such as `.worktrees/`, check `git check-ignore .worktrees` first and add it to `.gitignore` if it is not ignored.

## Set up

- Install dependencies with the repo's lockfile manager (npm, yarn, uv). Do not switch package managers.
- Copy untracked local config by name, such as `.env.local`, from the main checkout; never print or commit it, and never overwrite an existing `.env`.
- If the app listens on a port, give each worktree its own, so two dev servers do not fight over 3000. Local Postgres containers on a project-specific port are shared by all worktrees; use a separate database name per worktree when tests mutate data.
- Run the baseline test command and write down failures that exist before you change anything.

## Remove

```
git worktree remove ../myrepo-invite-flow     # refuses if the tree is dirty; do not force without reading what is lost
git worktree prune
git branch -d feat/invite-flow                # after it is merged
```

## Duplicate scheduler check

1. List session crons (`CronList`), cloud routines, and any launchd or crontab entries for the project.
2. Match by purpose, not by id.
3. Keep the one that fits the owner's chosen scheduler (for example an in-session cron when the session stays open; a cloud routine when the laptop may be off).
4. For one-time routines, disable the routine after the run starts, and confirm a single run exists in the run list.
