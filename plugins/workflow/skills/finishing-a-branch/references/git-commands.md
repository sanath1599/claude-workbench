# Git commands for finishing

## Where am I

```
git status --short
git branch --show-current
git log --oneline origin/main..HEAD        # commits ahead of the base
git worktree list
git rev-parse --git-dir --git-common-dir   # different paths means a linked worktree
git rev-parse --show-superproject-working-tree   # prints a path inside a submodule
```

A linked worktree and a submodule both show different git dirs; the last command tells them apart.

## Bring the base in

```
git fetch origin
git rebase origin/main        # or: git merge origin/main, per the repo's history style
# rerun the tests here
git push --force-with-lease   # only for your own feature branch after a rebase
```

## Open and merge a PR with gh

```
gh pr create --base main --fill
gh pr checks --watch
gh pr merge --squash --delete-branch   # or --merge / --rebase per repo style
```

If the PR body needs attribution lines, follow workbench:committing-and-pushing.

## Clean up

```
git checkout main && git pull
git branch -d feature-x                 # -D only after explicit confirmation
git worktree remove ../repo-feature-x   # only worktrees you created
git worktree prune
git remote prune origin
```

## Detached HEAD in a managed worktree

```
git switch -c feature-x                 # name it before pushing
git push -u origin feature-x
```
