#!/usr/bin/env bash
# Validate a maintenance PR branch (checked out at HEAD) and approve it when everything passes.
#   PR=<number> GH_TOKEN=... bash maintenance/validate-pr.sh
# Approves only when: tests pass, strict plugin validation passes, no secrets in the diff, and no protected
# paths changed (workflows, guard scripts, licences), which always need a human. GitHub does not let an
# account approve its own PR, so a PR opened by the same bot gets a COMMENT review plus the `validated` label.
set -uo pipefail
: "${PR:?set PR to the pull request number}"
git fetch -q origin main
fail() { gh pr review "$PR" --comment --body "Automated validation failed: $1. Not approved." >/dev/null; gh pr edit "$PR" --remove-label validated >/dev/null 2>&1; echo "FAILED: $1"; exit 1; }

npm test >/tmp/wb-test.log 2>&1 || fail "npm test (see the workflow log)"
claude plugin validate . >/dev/null 2>&1 || fail "marketplace validation"
for p in plugins/*; do claude plugin validate "$p" --strict >/dev/null 2>&1 || fail "strict validation of $p"; done
node plugins/workbench/scripts/secret-scan.mjs --range origin/main..HEAD >/dev/null || fail "possible secret in the diff"
protected=$(git diff --name-only origin/main...HEAD | grep -E '^\.github/workflows/|^plugins/workbench/scripts/(guard-|secret-scan)|(^|/)LICENSE|^plugins/toolbelt/licenses/' || true)
if [ -n "$protected" ]; then
  gh pr review "$PR" --comment --body "Validation passed, but protected files changed, so this needs a human review: $(echo $protected | tr '\n' ' ')" >/dev/null
  echo "PROTECTED: $protected"; exit 0
fi

body="Automated validation passed: unit and structure tests, strict validation of every plugin, secret scan of the diff, no protected files changed."
gh pr edit "$PR" --add-label validated >/dev/null 2>&1 || true
if gh pr review "$PR" --approve --body "$body" >/dev/null 2>&1; then echo "APPROVED"; else gh pr review "$PR" --comment --body "$body (GitHub does not allow this account to approve its own PR; labelled validated instead.)" >/dev/null; echo "VALIDATED (self-authored, labelled)"; fi
