# Rotation playbook

## Inventory
Keep `docs/secrets-inventory.md` with one row per secret and no values: name, provider, where it is used (vault file, platforms), who can rotate it, created date, next rotation date. Generate the name list with `node scripts/vault-env.mjs diff-keys`.

## Order of operations
1. **Create** the new key at the provider. Keep the old one active.
2. **Update the vault:** `sops secrets/prod.env`, replace the value in the editor.
3. **Sync:** dry-run, then `--apply` for each platform (SKILL.md step 4).
4. **Redeploy** everything that reads the key; restart long-running workers and agents too.
5. **Verify** with a real call using the new key (a health endpoint or a provider status call), never by printing it.
6. **Revoke** the old key at the provider. Check provider logs for use of the old key after revocation.
7. **Record** the date in the inventory.

## Cadence
- Immediately: any key seen in chat, logs, a screenshot or git history.
- Every 90 days: production keys with broad scope.
- On departure: everything a leaving person could read.

## Leak response
Follow workbench:handling-secrets step 5. The vault does not change the order: rotate first, rewrite history only with the owner's yes, then confirm no copies remain in CI logs or cached builds.
