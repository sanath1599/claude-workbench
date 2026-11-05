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
