#!/usr/bin/env bash
# Owner-machine step. Run as: ! bash scripts/<name>.sh
# Never prints secrets: no `set -x`, no `env`, no echo of credentials.
set -euo pipefail

say() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

command -v ssh >/dev/null || die "ssh is required"

# Read a secret without echoing it, unless it is already in the environment.
if [ -z "${EXAMPLE_TOKEN:-}" ]; then
  read -rs -p "EXAMPLE_TOKEN: " EXAMPLE_TOKEN
  echo
fi
[ -n "$EXAMPLE_TOKEN" ] || die "EXAMPLE_TOKEN is empty"

say "Backing up current config"
backup="$HOME/backups/<name>-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup"
# <copy the config you are about to overwrite into "$backup">

say "Applying change"
# <the change; pass secrets by stdin or env, never as arguments>

say "Verifying"
# <a check that prints only non-secret results>
say "Done. Backup at $backup"
