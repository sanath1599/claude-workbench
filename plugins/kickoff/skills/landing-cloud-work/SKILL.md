---
name: landing-cloud-work
description: Use when a cloud session (claude.ai/code) has finished or stopped and its work must come back to the laptop. Triggers include "cloud has finished, resume here", teleporting a session, merging a claude/* branch, or sweeping up branches and PRs that cloud runs left behind. Not for starting a handoff, which is kickoff:handing-off-to-cloud.
---

# Landing cloud work

Cloud sessions build on mocks and can't do owner-machine steps. Landing means bringing the branch home, re-proving it locally, merging it under the owner's identity, and walking the owner-machine checklist one approved step at a time.

## When to use
- A cloud session finished, stalled, or left a PR or branch.

## When not to use
- Launching or briefing a session: kickoff:handing-off-to-cloud.

## Procedure

1. **Bring it home.** Either `claude --teleport <session-id>` (needs a clean tree, the same checkout and the same claude.ai account; it carries the conversation), or `git fetch origin && git switch <branch>`. Read the session's report: the PR description, `docs/handoff/*-report.md`, or its last message.
   **Done when:** you have the branch locally and know what it claims.

2. **Re-prove it locally:** install, typecheck, lint, unit and integration tests against the local database, E2E, build. The cloud ran on mocks, so add the checks it couldn't run: real-key smoke tests that are safe (no real sends), migrations on a fresh local database. Write down every difference from what the report claimed.

3. **Review** with a pre-merge code review (workflow:reviewing-code-before-merge or the `code-review` skill). Fix findings on the branch.

4. **Merge under the owner's identity.** The merge commit is what deploys. On Vercel Hobby it must be authored by `{{wb.git_author_email}}`, or the deploy is blocked. Use a merge commit (`git merge --no-ff <branch>`) and push only if the project's policy allows it, or once the owner says yes (the push to main may deploy).

5. **Owner checklist, in order**, from the spec's "Owner-machine work":
   1. additive migrations on production;
   2. environment variables;
   3. deploy;
   4. worker or agent deploys;
   5. webhook registration;
   6. smoke tests.
   Each step gets a yes (workbench:shipping-to-production). Steps the classifier blocks become `! bash scripts/<step>.sh`, with scripts that print no secrets. Record each result in `DEPLOYMENT.md` as a dated status line. Keep a line for what nobody has verified yet (for example "real voice call not verified") until a person has done it.

6. **Sweep.** List leftover cloud branches and PRs (`gh pr list --search "head:claude/"`, `git branch -r | grep claude/`). Merge, close or keep each one with the owner, and delete merged branches.

7. **Report:** what landed, the verification evidence, what is still waiting on the owner, and the leftovers you closed.

## Verification
- [ ] Local checks green, with output shown; differences from the cloud report listed.
- [ ] Merge commit authored by the owner identity where Vercel requires it.
- [ ] Every owner step was approved, done and recorded, or is still listed as pending.
