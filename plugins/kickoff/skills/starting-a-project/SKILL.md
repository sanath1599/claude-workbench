---
name: starting-a-project
description: Use when the owner starts a new project or repo, pastes a large brief to build from, or asks to set a project up properly (git, GitHub remote, CLAUDE.md, env, database, tests), including turning a prototype folder into a real project. Not for adding one feature to an established repo.
---

# Starting a project

For the guided flow with an intake page and a UI sample, use `/workbench:new`; this skill is the underlying setup procedure.

A new project gets the same base every time: decisions recorded, a private GitHub repo, a CLAUDE.md that a fresh session (local or cloud) can work from, secrets kept out, a local database, test runners that pass, and, once the base is in, a graphify map. The first question is always whether the project may ever be handed to a cloud session, because the answer changes what gets prepared.

## When to use
- A new folder or repo, a brief pasted to build from, or "set this up properly".

## When not to use
- A feature in an existing project. Use the relevant stack skill.

## Procedure

1. **Ask once** (one AskUserQuestion call; skip any question the brief already answers):
   1. *Cloud handoff:* "Might you hand this project to a Claude Code cloud session at some point?"
      - Yes: prepare the cloud kit now (recommended when the build is long or should keep running while your laptop is off).
      - Maybe: create the GitHub repo now and add the kit when needed.
      - No: local only.
   2. *Repo:* the owner `{{wb.github_owner}}` or an org (`{{wb.github_orgs}}`), {{wb.default_repo_visibility}}.
   3. *Commits:* per verified increment on a feature branch, with the co-author trailer (recommended); on request only; or a branch per commit. Recommend no trailer when Vercel Hobby will deploy the repo.
   4. *Production deploys:* only on an explicit yes (recommended), or auto-deploy from main.
   **Done when:** the answers are written to `.claude/workbench.json` (template: `assets/workbench.json`).

2. **Keep the brief.** Save the pasted brief verbatim to `docs/requirements/original-brief.md`. Later amendments go in the design spec, and the spec wins.

3. **Choose the stack** with kickoff:choosing-the-stack, then write the design spec with kickoff:writing-the-design-spec. Include an "Environment findings" section verified on this machine (CLIs logged in, keys present by name, ports free), and an "Owner-machine work" section.

4. **Scaffold:**
   - `git init -b main`. Copy `assets/gitignore` to `.gitignore` (env files, caches, build output, graphify working files) and merge it with any framework default.
   - `.env.example` with every variable name and a placeholder. The owner fills `.env`; never write their values.
   - `CLAUDE.md` from `assets/CLAUDE.md`: Start here, Rules, Commands, Local services. Keep it short and specific.
   - Local Postgres when needed: a Docker container bound to `127.0.0.1` on a free port. Check `docker ps --format '{{.Ports}}'` and `lsof -iTCP -sTCP:LISTEN` first; never reuse another project's port. Record the port in CLAUDE.md.
   - Package manager init ({{wb.package_manager}}; `uv init` for Python), the test runners, and one passing smoke test per runner.
   - Mock switches for every external service (for example `LLM_PROVIDER=mock`, `EMAIL_MODE=mock`, `VOICE_MODE=mock`), refused when `NODE_ENV=production`. Tests and cloud sessions without keys run on these.

5. **Create the remote and push:**
   ```bash
   gh repo create <owner>/<name> --private --source . --remote origin
   git add -A && git commit -m "Scaffold <name>: brief, design, CLAUDE.md, env template"
   git push -u origin main
   ```
   The secret-scan hook checks the push.

6. **Cloud kit** (if the answer was yes): run the *prepare* phase of kickoff:handing-off-to-cloud. Don't launch anything.

7. **UI gate.** If the product has a UI, run design-studio:previewing-ui-before-building before building screens.

8. **Prove the bootstrap** by running it: install, typecheck, tests, database up and migrated, dev server answering. Fix anything that fails now, while it's cheap.
   **Done when:** each command ran and its output was shown.

9. **Graph it.** First check `.claude/workbench.json`: if `graphify` is false, skip this step. If the `graphify` command is missing, install it with `pipx install graphifyy`. After the base setup is committed, run `graphify update .` (code-only, no tokens), then `graphify claude install` and `graphify hook install`. These edit `CLAUDE.md` and `.claude/settings.json`, so review the diff and commit the changes. Commit `graphify-out/GRAPH_REPORT.md` and `graph.json`. If the repo has substantial docs, specs or images, ask the owner whether to also run `/graphify .` for the semantic pass. For a repo with more than about 200 code files, tell the owner which subfolder you chose.
   Then add the "Knowledge graph" section from `assets/CLAUDE.md` to the project CLAUDE.md, so every later session updates the graph after each release, starting from the first one.
   **Done when:** `graphify-out/graph.json` exists, the hooks and the CLAUDE.md section are committed, or the owner chose to skip it.

10. **Report** in at most 8 lines: repo URL, stack, what was verified, the cloud kit status, and the owner's next steps as `! commands`.

## Verification
- [ ] `.claude/workbench.json` records the four answers.
- [ ] The repo is pushed; `git status` is clean; no secrets were committed.
- [ ] Every bootstrap command ran green, with output shown.
- [ ] `graphify-out/GRAPH_REPORT.md` and `graph.json` exist and the hooks are installed (or `graphify` is false in `.claude/workbench.json`, or the owner chose to skip it).

## References
| File | Load when |
|---|---|
| `assets/CLAUDE.md` | writing the project CLAUDE.md |
| `assets/gitignore` | creating .gitignore |
| `assets/workbench.json` | recording the policy answers |
