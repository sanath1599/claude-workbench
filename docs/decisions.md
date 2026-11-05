# Workbench design decisions

Each line records a decision and the reason behind it.

| # | Decision | Why |
|---|---|---|
| 1 | Private GitHub repo under `sanath1599`, with a PolyForm Noncommercial licence | It describes the owner's workflow and project patterns. The owner's stated licensing preference is "anything but commercial use, with attribution". |
| 2 | Eleven focused plugins instead of one large one | Install only what a machine needs, and keep skill listings small to limit trigger collisions (a lesson from the survey). |
| 3 | Hooks enforce mechanical rules; skills carry judgment | A regex can enforce "sileo, not sonner", "no secrets in a push" or "no emojis in UI" every time. Prose can't. |
| 4 | Owner values as `{{wb.*}}` tokens, resolved at runtime from `~/.claude/workbench/profile.json` and renderable by `/workbench:setup` | One source works both installed from GitHub (with auto-updates) and as a personalised copy for someone else. |
| 5 | A cloud kit vendored into each repo (`.claude/rules`, `.claude/skills`, guard hooks active only when `CLAUDE_CODE_REMOTE=true`) | Cloud sessions don't install plugins and can't see `~/.claude`. Only repo files reach them. |
| 6 | The handoff launches with `claude --cloud` or a one-time routine, never `Agent` with `isolation: "remote"`, and must show evidence that it started | The remote-isolation agent once ran locally, and an unverified launch frustrated the owner. |
| 7 | Production, infrastructure, DNS, real sends and paid resources need a yes per action; `productionDeploys: auto-on-main` relaxes only deploys | The owner allows code freely but approves infrastructure one change at a time. Some projects auto-deploy on main. |
| 8 | The co-author trailer is a per-project setting, asked once | Most repos keep it, while Vercel Hobby repos must be authored by the owner alone. |
| 9 | Subagents default to sonnet, haiku for mechanical work, opus when warranted | The owner's rule as of 2026-11-05. It replaced the earlier "never opus". |
| 10 | Dependency review at session start, with every decision recorded in `docs/dependency-decisions.md` | The owner's rule. Recording declines stops the hook from asking again. |
| 11 | Daily maintenance as a GitHub Action: a deterministic collector, then a Claude (sonnet) PR, with a Resend email for high and critical advisories | It needs no laptop, keeps a reviewable PR trail and costs nothing when nothing changed. |
| 12 | Connectors bundled as remote OAuth MCP URLs or pinned `npx` packages; no secrets in `.mcp.json` | This replaces the third-party plugins that shipped them. The pins are bumped by the daily job. |
| 13 | Our own `workflow` plugin replaces superpowers | It keeps the discipline (plans, debugging, verification, reviews) and drops the "invoke at 1%" pressure and heavy questioning, which fight the owner's act-first style. |
| 14 | `remember` is replaced by built-in memory, `docs/handoff/NOW.md` (shown at session start) and update-skill | The repo-based status reaches cloud sessions and teammates. What's lost is automatic per-session logging. |
| 15 | The third-party graphify skill stays, and kickoff calls it after the base setup | The graphify CLI alone builds only the code graph. Extracting docs, papers and images needs the skill. |
| 16 | MulmoTerminal skills stay | They are rewritten by the app and drive its own features. |
| 17 | Evals follow the documented `claude plugin eval` schema, enforced by `tests/evals.test.mjs` | Unknown keys are run errors, and the first drafts used invented fields. |
