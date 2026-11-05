# <Project name>

<One sentence: what this is and who it is for.>

## Start here
- Requirements: `docs/requirements/original-brief.md` (verbatim brief).
- Design, amendments, environment findings and decisions: `docs/specs/<date>-<topic>-design.md`. Amendments there override the brief.
- Visual reference (once approved): `design/preview/<name>-ui-preview.html`.
- Cloud sessions: read `docs/handoff/` first.

## Rules
- Never print, log, commit or paste secrets. `.env*` files except `.env.example` are git-ignored; the owner's `.env` must not be overwritten.
- Tests must not hit real LLM, voice, email or payment providers unless the test is an opt-in integration check guarded by env vars. Use the mock switches (`LLM_PROVIDER=mock`, ...).
- Toasts use `sileo`. Icons use Lucide. No emojis in the UI.
- Production deploys, remote database migrations, DNS changes and paid resources need the owner's yes. They are owner-machine tasks, not cloud-session tasks (see the design spec, "Owner-machine work").
- <Framework-specific rules, e.g. "Read node_modules/next/dist/docs/ before using a Next.js API.">

## Commands
- `<install>`
- `<dev server>` — port <n>
- `<typecheck>` / `<lint>`
- `<unit + integration tests>`
- `<e2e tests>` (mock LLM and services)
- `<db up / migrate / seed>`

## Local services
- Postgres: Docker container `<name>_db` bound to `127.0.0.1:<port>` (ports already used on this machine: <list>). Without Docker (for example in a cloud session), run `service postgresql start` and point `DATABASE_URL` at it.

## Infrastructure (only when `iacSync` is true in `.claude/workbench.json`)
- Cloud: <azure|aws|gcp>, subscription/account/project: <name>. Every CLI command names it explicitly.
- Infrastructure code lives in `infra/` (<Terraform|Bicep>). Deploy scripts: `scripts/deploy-<env>.sh` (CLI, no secrets printed).
- After every completed round of `az`/`aws`/`gcloud` changes, update `infra/` (Terraform or Bicep), validate with `terraform validate && terraform plan` or `az bicep build`, and record the round in `infra/CHANGES.md`.
- Do not apply to production without the owner's yes. Use the IaC to create the next environment (dev, then staging, then prod).

## Knowledge graph (graphify)
- The graph lives in `graphify-out/`. Read `graphify-out/GRAPH_REPORT.md` before searching the codebase. Ask it questions with `graphify query "<question>"`.
- After every release, starting with the first, update the graph and commit it with the release: run `graphify update .` (code; no tokens). When docs, specs or images changed, also run `/graphify . --update`. Then run `git add graphify-out/GRAPH_REPORT.md graphify-out/graph.json`.
- The git hooks (`graphify hook install`) keep the code graph current between releases.
