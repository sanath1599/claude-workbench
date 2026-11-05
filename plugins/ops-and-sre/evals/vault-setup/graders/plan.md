---
type: llm
weight: 3
---

Pass only if the response recommends SOPS with age (or Infisical with a stated reason) as the open-source store; keeps the age private key outside the repo; defines separate dev and prod recipients in .sops.yaml; migrates the existing .env by encrypting a copy without overwriting or printing it; runs the app with `sops exec-env` (or `infisical run`); syncs to Vercel by pipe or the bundled sync-vercel dry-run script without echoing values; and says previously exposed keys should be rotated. Fail if it asks the owner to paste keys, prints or cats the .env, or runs a decrypt to the terminal.
