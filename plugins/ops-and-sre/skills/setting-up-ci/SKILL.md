---
name: setting-up-ci
description: Use when adding or fixing GitHub Actions CI for a TypeScript or Python repo, pinning actions, adding a Postgres service container, wiring Playwright with mocks, or asking whether CI should deploy. Not for deploying or migrating, which is releasing-safely.
---

# Setting up CI

CI proves a change is safe to merge. It does not ship. A green run on a pull request is the gate, and the owner's rules about production stay outside the workflow.

## When to use

- A repo has no `.github/workflows/`, or CI is red, slow or flaky.
- Adding a job (Python, Playwright, secret scan) or pinning actions.
- The owner asks "should CI deploy this?".

## When not to use

- Releasing, migrations, rollback: `ops-and-sre:releasing-safely`.
- Writing the app's tests themselves: the stack plugins.

## Procedure

1. **Read the repo.** Find the package manager and lockfile, scripts in `package.json` (`typecheck`, `lint`, `test`), the Python directory and `uv.lock`, whether a Prisma schema or Alembic config exists, whether Playwright is configured, and `.claude/workbench.json`. Run each check locally first so the workflow only automates commands that already pass. **Done when:** you can list the exact command for every job.
2. **Copy `assets/ci.yml`** to `.github/workflows/ci.yml` and delete jobs the repo does not need. Keep its structure:
   - Triggers `pull_request` and `push` to `main`; `permissions: contents: read` at the top, widened per job only when needed.
   - A `concurrency` group per ref that cancels superseded runs on branches but never on `main`.
   - `timeout-minutes` on every job.
   - Node job: `npm ci`, `prisma generate`, typecheck, lint, `vitest run`, Playwright. Python job: `uv sync --locked`, ruff, `pytest`.
   - Cache through the setup actions (`cache: npm`, `enable-cache: true` keyed on `uv.lock`) and cache the Playwright browsers on the lockfile hash.
   - **Done when:** the file contains only commands from step 1.
3. **Postgres service container on a fixed port.** Map the host port to the one local Docker and `.env.example` use (the template uses 5434), set a health check, and put a throwaway `DATABASE_URL` in the job `env`. Apply migrations with the same command production uses (`prisma migrate deploy`), never `db push`, so CI catches migration gaps. **Done when:** a test that reads the database passes in CI.
4. **Mock every external provider.** Playwright and unit tests run with mock LLM, LiveKit and email modes. No test calls Ollama, an LLM API, LiveKit or Resend unless it is an opt-in integration job guarded by an env var and a secret. **Done when:** a grep of the workflow shows no real provider keys on the default path.
5. **Pin actions to full commit SHAs.** Resolve each tag with `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha`, write `uses: owner/repo@<40-hex> # vX.Y.Z`. Never use a tag or branch for third-party actions. Dependabot or the weekly maintenance job bumps them. **Done when:** every `uses:` line is 40 hex characters or a local path.
6. **Lint the workflows.** Keep the `actionlint` job and run `actionlint` locally before pushing (`brew install actionlint`, or the download script in the template). **Done when:** `actionlint` exits 0.
7. **Secret scan.** Keep the gitleaks job with `fetch-depth: 0`. For an organization-owned repo it needs a free `GITLEAKS_LICENSE` secret; ask the owner to add it, never create it yourself. **Done when:** the job is green on the PR.
8. **Previews and production.** Previews come from Vercel's Git integration, so CI has no preview step and no Vercel token. Production: read `productionDeploys` in `.claude/workbench.json`. If it is `auto`, Vercel deploys `main` on merge and CI only gates the merge (branch protection with required checks). Otherwise CI contains no deploy job, and a production deploy waits for the owner's yes (`ops-and-sre:releasing-safely`). **Done when:** you can state which of the two cases applies and the workflow matches.
9. **Push on a branch and read the run.** Use `gh run watch` and report the run URL and the conclusion of each job. **Done when:** all jobs are green, or each red job has a cause and a fix.

## Quick reference

| Concern | Rule |
|---|---|
| Action refs | full SHA plus `# vX.Y.Z` comment |
| Token | `contents: read` default |
| Concurrency | cancel on branches, never on `main` |
| DB | service container, fixed port, `migrate deploy` |
| Providers | mocked by default |
| Deploy | none in CI unless `productionDeploys` allows it elsewhere |
| Secrets | secrets context only; never echo, never in artifacts |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "Tags are fine, they're from GitHub" | Tags move. Pin the SHA. |
| "I'll add the deploy step so it's one click" | Deploys need the owner's yes. Keep CI read-only. |
| "`db push` is faster in CI" | It hides drift. Use `migrate deploy`. |
| "Skip the secret scan on a private repo" | Private repos leak too. Keep it. |
| "Call the real LLM once to be sure" | Put it in an opt-in job, not the default path. |

## Verification

- [ ] `actionlint` clean; every third-party `uses:` pinned to a SHA
- [ ] Concurrency group, timeouts and least-privilege permissions present
- [ ] Migrations applied with the production command
- [ ] No deploy job, or the project explicitly opted in
- [ ] Latest run URL and per-job results reported

## Versions

- actions/checkout 7.0.1 (verified 2026-11-05, https://github.com/actions/checkout/releases)
- actions/setup-node 7.1.0 (verified 2026-11-05, https://github.com/actions/setup-node/releases)
- actions/cache 6.1.0 (verified 2026-11-05, https://github.com/actions/cache/releases)
- actions/upload-artifact 7.0.2 (verified 2026-11-05, https://github.com/actions/upload-artifact/releases)
- astral-sh/setup-uv 10.3.3 (verified 2026-11-05, https://github.com/astral-sh/setup-uv/releases)
- gitleaks/gitleaks-action 3.0.0 (verified 2026-11-05, https://github.com/gitleaks/gitleaks-action/releases)
- rhysd/actionlint 1.7.12 (verified 2026-11-05, https://github.com/rhysd/actionlint/releases)
- Re-resolve the SHAs when bumping; the template's comments name the tag each SHA came from.

## References

| File | Load when |
|---|---|
| assets/ci.yml | creating or repairing a workflow |
