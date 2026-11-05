#!/usr/bin/env bash
# SessionStart setup for Claude Code cloud sessions. Does nothing on a laptop.
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0
log() { echo "[cloud-setup] $*" >&2; }

# JavaScript dependencies (respect the lockfile the repo has)
if [ -f package-lock.json ]; then npm ci --no-audit --no-fund >/dev/null 2>&1 || log "npm ci failed"
elif [ -f yarn.lock ]; then yarn install --frozen-lockfile >/dev/null 2>&1 || log "yarn install failed"
elif [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile >/dev/null 2>&1 || log "pnpm install failed"; fi

# Python dependencies in any folder with uv.lock (root, agent/, api/, backend/)
for d in . agent api backend worker; do
  if [ -f "$d/uv.lock" ]; then (cd "$d" && uv sync -q >/dev/null 2>&1) || log "uv sync failed in $d"; fi
done

# Local Postgres (preinstalled in the cloud image). Hosted databases are usually unreachable from here.
DB_NAME="${CLOUD_DB_NAME:-app_dev}"
if command -v psql >/dev/null 2>&1; then
  service postgresql start >/dev/null 2>&1 || true
  su postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='app'\"" 2>/dev/null | grep -q 1 \
    || su postgres -c "psql -c \"CREATE ROLE app LOGIN PASSWORD 'app' CREATEDB\"" >/dev/null 2>&1
  su postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\"" 2>/dev/null | grep -q 1 \
    || su postgres -c "createdb -O app ${DB_NAME}" >/dev/null 2>&1
fi

# Local env with mocks when the environment provides no keys (never overwrite an existing file)
if [ ! -f .env.local ] && [ -f .env.cloud.example ]; then cp .env.cloud.example .env.local; fi

# Project-specific steps (migrations against the LOCAL database, seed, codegen):
# npx prisma migrate deploy && npx prisma db seed
exit 0
