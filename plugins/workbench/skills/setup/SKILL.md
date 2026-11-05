---
name: setup
description: Use when the owner (or someone new) runs /workbench:setup, asks to personalise or re-personalise the workbench, set their email, domain or accounts, or the session notes say the profile is not personalised yet.
disable-model-invocation: true
argument-hint: "[--refresh | --profile-only]"
---

# Guided setup

A short interview that writes the person's profile and renders a personalised copy of this marketplace, with their email, domain, accounts and stack choices filled in. Then it installs that copy. Ask everything in at most three AskUserQuestion rounds, prefilled with what can be detected, so the whole run takes about three minutes.

## When to use
- First run on a machine, a new teammate adopting the workbench, or a change of email, domain, host or stack defaults.
- `--refresh`: re-render after the marketplace has been updated. It keeps the existing profile and asks nothing.
- `--profile-only`: write the profile without rendering a package. The GitHub-installed plugins resolve `{{wb.*}}` tokens from the profile at runtime and keep auto-updating.

## When not to use
- To change one rule or skill: use workbench:update-skill.
- To set up a project: use kickoff:starting-a-project.

## Procedure

1. **Detect.** Run `node scripts/detect.mjs` from this skill's directory. It prints JSON: git name and email, GitHub login and orgs, timezone, existing profile, Vercel login, and where the marketplace source lives.
   **Done when:** you have the JSON. Missing values are fine.

2. **Round 1, identity** (one AskUserQuestion call, up to 4 questions; put detected values first as options, and "Other" lets them type):
   - Name and contact email (used as the default alert and approver address).
   - Git author email for repos that Vercel deploys (Vercel Hobby rejects commits by other authors). This is often a personal address, which can differ from the work email in git config.
   - GitHub account for new repos, and the orgs to know about.
   - Default visibility for new repos (private recommended).

3. **Round 2, infrastructure:**
   - Base domain for subdomains and email senders, and its DNS provider (Cloudflare, Vercel DNS, Route 53, other).
   - Hosting: Vercel first (recommended), the person's own VPS (ask for its ssh aliases), or both.
   - Email provider (Resend recommended) and the default sender address on the domain (for example `notifications@<domain>`).
   - Timezone (detected).

4. **Round 3, stack and guardrails.** Offer the current defaults as the recommended option for each:
   - Frontend: TypeScript + Vite + TanStack, or Next.js, or other.
   - Backend and agents: Python + Pydantic AI, with Temporal for long-running work. Data: Postgres, plus Qdrant for vectors.
   - Subagent default model (sonnet recommended; haiku for mechanical work; opus when warranted). Package manager (npm recommended).
   - Plugins to install (multiSelect): workbench, workflow, kickoff, stack-web, stack-python, design-studio, engineering-craft, ops-and-sre, docs-and-data, interactive-demos, stack-connectors, toolbelt (graphify, MulmoTerminal, REA). Also companion plugins from the official catalog, listed in `references/companions.md`.

5. **Write the profile.** Build the JSON (same keys as `../../profile.defaults.json`, with `"personalised": true`) and show it as a short table. If `~/.claude/workbench/profile.json` exists, show only what changes. Then write it to `~/.claude/workbench/profile.json`. Never put secrets in the profile.
   **Done when:** the file exists and parses.

6. **Render** (skip for `--profile-only`):
   ```bash
   node scripts/render-package.mjs --profile ~/.claude/workbench/profile.json --out ~/.claude/workbench/package --plugins <comma list>
   claude plugin validate ~/.claude/workbench/package
   ```
   The renderer copies the marketplace and fills in every `{{wb.*}}` token in the skills and docs. It names the marketplace `<github-login>-workbench` and stamps the profile into the copy.
   **Done when:** validation passes. Show the summary line the renderer prints.

7. **Install.** Ask once, then run:
   ```bash
   claude plugin marketplace add ~/.claude/workbench/package
   claude plugin install <plugin>@<github-login>-workbench   # for each chosen plugin
   claude plugin install <companion>@claude-plugins-official # for each chosen companion
   ```
   If the same plugins are also installed from the GitHub marketplace, offer to disable those copies so skills don't appear twice. Tell them to run `/reload-plugins` or start a new session.

8. **System tools.** Install graphify for the whole machine, so every project can build its knowledge graph:
   ```bash
   command -v pipx >/dev/null || brew install pipx        # or: python3 -m pip install --user pipx
   pipx install graphifyy || pipx upgrade graphifyy        # the CLI (`graphify`); uv users: uv tool install graphifyy
   graphify --help >/dev/null && echo "graphify ready"
   ```
   The graphify skill itself comes from the `toolbelt` plugin. Don't also run `graphify install --platform claude`: it would put a second copy in `~/.claude/skills/`. If an older copy is there, move it to `~/.claude/skills-backup/<date>/`.
   **Done when:** `graphify --help` runs and `toolbelt` is installed.

9. **Finish.** List what was written and installed, in three lines. Then: "Re-run `/workbench:setup --refresh` after marketplace updates. Edit `~/.claude/workbench/profile.json` any time."

## Quick reference

| File | Purpose |
|---|---|
| `~/.claude/workbench/profile.json` | the person's values; read by the SessionStart hook |
| `~/.claude/workbench/package/` | the rendered, personalised marketplace |
| `scripts/detect.mjs` | read-only detection, prints JSON |
| `scripts/render-package.mjs` | copy and render; `--help` for flags |

## Verification
- [ ] Profile written, and only after the person saw it.
- [ ] `claude plugin validate` passed on the rendered package.
- [ ] Nothing installed without the person's yes.
- [ ] No secret was asked for or written anywhere.

## References
| File | Load when |
|---|---|
| `references/companions.md` | offering companion plugins in round 3 |
