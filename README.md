# starter-pack

A personal Claude Code plugin marketplace that makes every session work the way its owner wants without being re-told. It holds:

- house rules distilled from about 2,800 prompts and 56 answered decisions across 60 projects;
- guard hooks that enforce the mechanical rules;
- a project kickoff that prepares cloud handoffs;
- 84 skills of our own for a TypeScript + Python agentic stack, design, engineering, SRE, documents and demos, plus 16 bundled third-party skills (graphify, MulmoTerminal, REA) kept in sync with upstream.

Everything is written in our own words. Ideas came from studying the well-known marketplaces and from the owner's own projects; no text was copied. See `docs/research/marketplace-notes.md` and `docs/installed-audit.md`.

## Install

```bash
gh auth setup-git                                         # the repo is private; lets git use your gh login
claude plugin marketplace add sanath1599/claude-workbench
claude plugin install workbench@starter-pack          # then any of the plugins below
```

Or switch over in one go, uninstalling the third-party plugins this replaces (dry run first):

```bash
bash scripts/migrate-from-third-party.sh            # shows what it would do
bash scripts/migrate-from-third-party.sh --apply
```

Then start a new session and run `/workbench:setup`. It asks for your email, domain, accounts and stack choices, writes `~/.claude/workbench/profile.json`, and can render a personalised copy of the whole marketplace. Turn on auto-update for `starter-pack` in `/plugin`, under Marketplaces, so the daily maintenance PRs reach you once merged.

## Plugins

| Plugin | What it gives you | Skills |
|---|---|---|
| **workbench** | Always on: house rules, profile, guard hooks, session-start dependency review, guided setup, `update-skill`, `ask-the-owner`, `creating-skills`, plus commits, secrets, production gates, delegation and deliverables | 11 |
| **workflow** | Process tuned to the owner: shaping work, implementation plans, execution with batched reviews, systematic debugging, test-first, verification before done, pre-merge review, simplification, finishing a branch, parallel sessions. Agents: code-reviewer, code-simplifier, plan-critic | 10 |
| **kickoff** | Starting a project (the cloud-handoff question comes first), choosing the stack, the design spec, the cloud kit and handoff, landing cloud work, cloud routines, keeping context across sessions | 7 |
| **stack-web** | Vite + TanStack, Vercel (deploys, functions, storage, background work, protection), subdomains on Cloudflare, Resend (outbound and inbound), auth, maps, content pipelines, browser performance, API testing, Next.js 16 | 16 |
| **stack-python** | Pydantic AI patterns, Temporal patterns, Postgres, Qdrant, FastAPI, reliable LLM calls, LiveKit voice agents | 7 |
| **design-studio** | HTML preview before building, no AI slop, browser verification at four widths, type and colour (curated data and a search script), motion and 3D, charts, single-file HTML, guided demo decks, showcase READMEs. Agent: design-critic | 9 |
| **engineering-craft** | System design with ADRs, distributed-systems hardening, contract-first APIs, LLM features and evals, MCP servers, QA passes, security review, test planning, PR review replies. Agents: qa-auditor, security-reviewer, finding-verifier | 9 |
| **ops-and-sre** | CI with pinned actions, safe releases and migrations, incidents with a live timeline, SLOs and burn rate, instrumentation, runbooks, VPS and Azure deploys. Agent: runbook-cold-reader | 8 |
| **docs-and-data** | Word, Excel (live formulas), PowerPoint, PDF, tabular analysis, in-depth research with citations | 6 |
| **interactive-demos** | Repository to click-through demo through the antm connector (Animated Technical Interactive) | 1 |
| **stack-connectors** | MCP servers: Vercel, Cloudflare API and docs, Resend, Logfire, Temporal docs, Context7, Prisma, Chrome DevTools | 0 |
| **toolbelt** | Bundled from upstream (MIT, licences in `plugins/toolbelt/licenses/`), refreshed by `scripts/sync-vendored.mjs` and the daily job: graphify (knowledge graphs; the CLI is installed by setup), the 14 MulmoTerminal skills, reverse-engineer-anything with the REA MCP server | 16 |

## What runs automatically

| When | What | Where |
|---|---|---|
| Session start | House rules, owner profile and this project's git, cloud and deploy policy; notes for cloud sessions | `workbench/scripts/session-context.mjs` |
| Session start | Watched dependencies with newer releases and no recorded decision ("review the changelogs; record adopt or decline with the reason") | `workbench/scripts/check-updates.mjs` |
| Session start | `docs/handoff/NOW.md`, where the last session left off | `kickoff/scripts/show-now.mjs` |
| Every prompt | A pasted credential triggers "don't echo, suggest rotation"; "from now on…" triggers update-skill | `workbench/scripts/guard-prompt.mjs` |
| Every Bash call | Blocks commits or pushes with secrets, sonner or other toast installs, pnpm in npm repos, printing `.env`. Asks before production deploys, public repos, force pushes, remote restarts, DNS writes, real emails and destructive migrations | `workbench/scripts/guard-bash.mjs` |
| Every write | Blocks sonner imports, emojis in UI files and literal secrets; asks before overwriting an existing `.env` | `workbench/scripts/guard-write.mjs` |
| Daily, 07:00 Dubai | Versions, OSV advisories, links, MCP endpoints, stale facts and Claude Code releases are checked; Claude (sonnet) updates the skills in a PR; high or critical vulnerabilities are emailed | `.github/workflows/daily-maintenance.yml`, `maintenance/` |

## Common flows

- **Guided new project:** `/workbench:new <brief>`. A local browser studio shows a pre-filled intake page, then design directions and a one-page sample, and talks back to the Claude Code session. After you approve the sample it creates the repo, writes the spec and a plan you approve, then builds here or hands off to the cloud. Reference products you name are studied with reverse-engineer-anything for patterns only.
- **New project:** "start a new project from this brief". kickoff:starting-a-project asks about cloud handoff, repo, commits and deploys in one batch. It then sets up the repo, CLAUDE.md, env template, local database, tests and remote, and runs graphify once the base is in. It also writes a CLAUDE.md rule to update the graph after every release, starting with the first.
- **Hand off to the cloud:** `node <kickoff>/skills/handing-off-to-cloud/scripts/vendor-cloud-kit.mjs --repo .` copies the rules, the matching skills and the guard hooks into the repo, because cloud sessions don't load plugins. Then come the environment doc, `cloud-ready-check.mjs`, a brief in `docs/handoff/`, and `claude --cloud "Read docs/handoff/<file> and carry it out"`, with proof that it started.
- **Teach it something:** say "from now on…" or "this is useful: …". workbench:update-skill finds the closest skill (`node scripts/find-skill.mjs`), integrates the learning, validates, bumps the version and pushes.
- **Ask on the owner's behalf:** `/workbench:ask-the-owner <question>` answers from the rules, `docs/preferences.md` and the persona, with a source and a confidence level.

## Repository layout

```
.claude-plugin/marketplace.json   the catalogue
plugins/<plugin>/                 skills/, agents/, hooks/, scripts/, evals/, .mcp.json
docs/authoring.md                 how every skill is written (read before changing anything)
docs/preferences.md               the owner's preferences, with strength and provenance
docs/installed-audit.md           verdict on each of the 280 previously installed skills, agents, hooks and MCPs
docs/decisions.md                 why the workbench is built the way it is
docs/learnings.md                 dated log of what was learned and where it went
maintenance/                      the daily job: collector, notifier, Claude prompt, tracked packages
scripts/                          find-skill, bump-version, migrate-from-third-party
tests/                            node:test suites for hooks, scripts, structure and the eval schema
```

## Development

```bash
npm test                                            # all unit and structure tests
claude plugin validate . && for p in plugins/*; do claude plugin validate "$p" --strict; done
claude plugin eval plugins/<plugin> --runs 2 --model sonnet --no-publish   # behaviour evals (uses your plan)
node scripts/bump-version.mjs <plugin> patch|minor|major
node maintenance/collect.mjs --skip-links           # what the daily job would see
```

CI runs the tests, a secret scan and strict validation on every push.

## License

[PolyForm Noncommercial 1.0.0](LICENSE). Free to use and adapt for noncommercial purposes, keeping the Required Notice. Commercial use needs the owner's permission.
