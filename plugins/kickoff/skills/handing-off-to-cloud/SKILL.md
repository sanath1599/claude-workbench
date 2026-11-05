---
name: handing-off-to-cloud
description: Use when the owner wants work to continue in a Claude Code cloud session (claude.ai/code), says "hand this off", "move it to the cloud", "keep working while my laptop is off", or answered yes to the cloud question at kickoff. Also when making a repo cloud-ready or creating a cloud environment. Not for scheduled recurring runs (kickoff:running-cloud-routines) or bringing cloud work back (kickoff:landing-cloud-work).
---

# Handing off to a cloud session

A cloud session gets only what is pushed to GitHub. It has no `~/.claude`, so no plugins, personal skills or profile. It has no laptop services, it usually reaches the internet over HTTPS only, and the owner may be offline. A good handoff therefore puts everything the session needs into the repo: rules, skills, mocks, a local database, verified environment facts, a brief, and a list of what it must not do. Then it launches and proves the session started.

## When to use
- Moving a build or a long task to the cloud, or preparing a repo so it can be moved quickly later.

## When not to use
- Recurring scheduled work: kickoff:running-cloud-routines.
- Pulling finished cloud work back: kickoff:landing-cloud-work.
- Parallel subagents inside this session: workbench:delegating-to-subagents. Never use the Agent tool's `isolation: "remote"` for a handoff; it once ran on the laptop instead.

## Phase 1: Prepare (once per project, about 15 minutes)

1. **GitHub.** The repo has a GitHub remote and the Claude GitHub App can read it. Either the owner installed the app from claude.ai/code, or ran `/web-setup` once. You can't check the app from the CLI, so ask once and record the answer in `.claude/workbench.json` as `"cloudHandoff": "yes"`.
2. **Measure what the cloud can't.** In a local session, verify the facts the cloud session would otherwise guess: which model ids work on the owner's plan (some return 402), which sending domain is verified, SDK behaviour read from the installed source, ports in use. Write each as a dated line in the spec's "Environment findings" ("verified 2026-11-04 on the owner's machine"), and put SDK notes in `docs/notes/<sdk>-notes.md`.
3. **Owner-machine list.** End the design spec with a numbered "Work that must happen on the owner's machine" section: provisioning, `vercel link` and env vars, production migrations and seed, worker or agent deploys, webhook registration, real-provider smoke tests. Mirror it in CLAUDE.md as one rule ("do not deploy to production, provision paid resources or deploy workers from a cloud session").
4. **Runs with no keys.**
   - Every external service has a mock switch. The switch throws at startup in production, unless `E2E_ALLOW_MOCKS=1` is set and the host is not a deployment platform.
   - The cloud session gets its own Postgres: `service postgresql start` in the sandbox (PostgreSQL 16 is preinstalled).
   - Production database URLs live in a separate git-ignored file (for example `.env.deploy.local`) that dev tooling never loads.
5. **Vendor the cloud kit:**
   ```bash
   node scripts/vendor-cloud-kit.mjs --repo <repo path>            # picks skills from the repo's dependencies
   node scripts/vendor-cloud-kit.mjs --repo <repo path> --dry-run  # preview first
   ```
   This writes:
   - `.claude/rules/workbench.md`: the house rules, rendered with the profile.
   - `.claude/skills/<name>/`: the matching workbench skills, rendered.
   - `.claude/hooks/workbench/`: the secret-scan and guard hooks, active only when `CLAUDE_CODE_REMOTE=true`.
   - `.claude/hooks/cloud-setup.sh`: dependency install and Postgres start on SessionStart.
   - `docs/cloud/ENVIRONMENT.md`: the environment to create.
   Review `cloud-setup.sh` for this project's needs (database name, extra services), then commit.
6. **Create the environment.** This can only be done in the claude.ai/code web UI; the CLI can't create environments. Give the owner the values from `docs/cloud/ENVIRONMENT.md`:
   - name: the project name;
   - network: Trusted plus a custom list of the API hosts the app calls;
   - environment variables: names only, with values pasted by the owner;
   - the setup script.
   Generate the paste file without printing values: `node scripts/make-cloud-env.mjs --from-example` writes a git-ignored `.env.cloud`, which the owner copies with `! pbcopy < .env.cloud`. Prefer the environment's network secrets for API keys where the plan offers them. If browser tools are available and the owner agrees, fill the dialog for them. The owner then makes it the default in a Claude Code session with `/remote-env`.
7. **Check readiness:** `node scripts/cloud-ready-check.mjs --repo <repo path>`. Fix every FAIL.
   **Done when:** the check is green and committed.

## Phase 2: Brief (every handoff)

1. Write `docs/handoff/<YYYY-MM-DD>-<slug>.md` from `assets/handoff-brief.md`. Fill in:
   - goal;
   - a read-first list;
   - the current state, with how it was verified;
   - ordered tasks, each with done-when;
   - hard limits: no production, no merging to main, no remote migrations, no secrets, no deploy CLIs;
   - the working branch;
   - commit cadence: small commits, pushed often;
   - verification commands;
   - the report it must leave.
   Tell it the owner may be offline: make the call, record the decision, keep going.
2. Commit and push the brief and every file it references. Uncommitted or unpushed work does not reach the cloud.
   **Done when:** `git status` is clean and `git rev-list --count @{u}..HEAD` prints 0.

## Phase 3: Launch and prove it

1. Ask once: "Launch a cloud session on environment `<name>`, branch `<branch>`, brief `<path>`?"
2. Launch with the CLI from the repo (claude.ai login required):
   ```bash
   timeout 120 claude --cloud "Read docs/handoff/<file>.md and carry it out. Work on branch <branch>." </dev/null
   ```
   If it needs a terminal, give the owner `! claude --cloud "<same prompt>"`. For a delayed or unattended start, use a one-time routine instead (kickoff:running-cloud-routines). Restrict its connectors, and disable it after the run.
3. **Prove it started.** Capture the session URL or id from the output. Within a few minutes confirm activity: the branch exists or moved (`git ls-remote origin <branch>`), a draft PR appeared (`gh pr list --head <branch>`), or the session answers `claude -p "Reply with your current step" --cloud <id> --output-format json`. Report the evidence. If you have none yet, say "launched, not yet confirmed" and check again; never claim more.
   **Done when:** the owner has the URL and one piece of evidence.

## Quick reference

| Cloud session has | Doesn't have |
|---|---|
| The pushed repo, its `CLAUDE.md`, `.claude/rules`, `.claude/skills`, `.claude/settings.json` hooks, `.mcp.json` | `~/.claude` (plugins, personal skills, profile), unpushed commits, `.env` |
| Ubuntu with Node, Python and uv, Docker, PostgreSQL 16, Redis | the owner's logged-in CLIs (vercel, lk, az, gh as the owner) |
| HTTPS to allowlisted hosts | raw TCP to hosted databases on 5432 (assume it is blocked) |

## Verification
- [ ] Readiness check green; kit and brief pushed.
- [ ] The brief lists the hard limits and the owner-machine steps.
- [ ] The owner has the session URL and evidence that it started.

## References
| File | Load when |
|---|---|
| `assets/handoff-brief.md` | writing the brief |
| `assets/ENVIRONMENT.md` | creating the cloud environment |
| `assets/cloud-setup.sh` | adjusting SessionStart setup |

## Versions
- Claude Code 2.1.318 CLI flags `--cloud`, `--teleport`, `/remote-env`, `/web-setup` (verified 2026-11-05, https://code.claude.com/docs/en/claude-code-on-the-web.md)
- Cloud image: Ubuntu 24.04, PostgreSQL 16, Redis 7 (verified 2026-11-05, https://code.claude.com/docs/en/cloud-environments.md)
