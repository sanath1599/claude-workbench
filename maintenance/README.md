# Maintenance

The skills cite package versions, APIs, endpoints and docs that keep moving. A daily GitHub Action keeps them current, and you review its PR.

## What runs every day (07:00 Dubai, `.github/workflows/daily-maintenance.yml`)

1. **`maintenance/collect.mjs`** is deterministic and needs no LLM or secrets. It checks:
   - the latest stable version of every package in `tracked-packages.d/*.json` on npm, PyPI or GitHub releases;
   - OSV.dev advisories for both the documented and the latest version;
   - every link in the skills (404, 410 or 5xx counts as broken);
   - every remote MCP endpoint in a `.mcp.json`;
   - "verified YYYY-MM-DD" facts older than 60 days;
   - new Claude Code releases.
   It writes `maintenance/out/report.{json,md}`.
2. **When something needs attention**, Claude runs on **sonnet**, with WebSearch and WebFetch and your **OAuth token**, following `maintenance/PROMPT.md`. It:
   - reads the changelogs;
   - updates the Versions blocks, the instructions and the pinned versions;
   - writes `docs/upgrade-notes/<date>.md`, recording the nice-to-have features and what wasn't adopted and why;
   - bumps plugin versions;
   - runs the tests and validation;
   - opens a PR from `maintenance/<date>`.
3. **High or critical vulnerabilities** are emailed through the Resend API to `ALERT_EMAIL` (default owner@example.com).

Nothing merges by itself. Once you merge a PR, installed marketplaces pick it up on their next update. Turn on auto-update for this marketplace in `/plugin`, under Marketplaces.

## One-time setup (owner machine)

```bash
claude setup-token                                    # prints a long-lived OAuth token for CI
gh secret set CLAUDE_CODE_OAUTH_TOKEN -R sanath1599/claude-workbench   # paste the token when asked
gh secret set RESEND_API_KEY -R sanath1599/claude-workbench            # paste a Resend key with send access
gh variable set ALERT_FROM -R sanath1599/claude-workbench --body "Workbench <workbench@antm.ai>"   # a sender on a verified domain
gh variable set ALERT_EMAIL -R sanath1599/claude-workbench --body "owner@example.com"
gh label create maintenance -R sanath1599/claude-workbench --color 0E8A16 || true
gh workflow run daily-maintenance.yml -R sanath1599/claude-workbench   # first run by hand
```

Optional: `gh variable set EMAIL_DIGEST --body true` also emails a digest whenever there is anything to review, not only vulnerabilities.

## What else is reviewed, and how

| Area | Check | Updated by |
|---|---|---|
| Package versions and changelogs | npm, PyPI, GitHub releases | daily job, PR |
| Security advisories | OSV.dev for documented and latest versions | daily job; email when high or critical |
| Claude Code releases | npm `@anthropic-ai/claude-code` versus `state.json` | daily job reads the changelog for plugin, hook, skill and eval changes |
| Docs links | HEAD, then GET | daily job fixes moved pages |
| MCP connector endpoints | MCP `initialize` probe | daily job finds replacements or flags them |
| Pinned versions in `.mcp.json` and templates | tracked with `pinnedIn` | daily job bumps them |
| Facts older than 60 days | "verified" dates | daily job re-verifies up to 10 per run |
| Learnings inbox (`docs/learnings.d/`) | files present | daily job folds them into `docs/learnings.md` |
| Plugin structure, eval schema, hooks | `npm test`, `claude plugin validate --strict` | CI on every push |
| Skill behaviour | `claude plugin eval plugins/<p> --runs 2 --model sonnet --no-publish` | run by hand before big changes (it costs usage) |
| GitHub Action pins in templates (`ops-and-sre/skills/setting-up-ci/assets/ci.yml`) | listed in tracked packages as `github` entries | daily job |

## Run it locally

```bash
node maintenance/collect.mjs --skip-links   # quick
node maintenance/collect.mjs                # full, about a minute
```
