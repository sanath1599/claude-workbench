---
name: keeping-secrets-in-a-vault
description: Use when the owner wants API keys and env files stored, shared, synced or rotated properly instead of pasted into chat or kept as loose .env files, when choosing a secrets manager, setting up SOPS, age or Infisical, onboarding a second machine, or running a rotation. Not for day-one .env hygiene or a leaked key, which is workbench:handling-secrets.
---

# Keeping secrets in a vault

A vault makes pasting keys into chat unnecessary. Values live encrypted in one place, reach processes through `exec-env` or a pipe, and reach platforms through a script that prints names only. Claude never needs to see a value.

## When to use
- Choosing where long-lived secrets live, or replacing a pile of `.env` files.
- A project has several environments, a second machine, a team, or CI that needs secrets.
- Rotating keys on a schedule, or after a leak (together with workbench:handling-secrets).

## When not to use
- A new project that only needs `.env` and `.env.example` layout: workbench:handling-secrets.
- Designing login or sessions: stack-web:adding-auth.
- Provisioning the cloud account itself: ops-and-sre:provisioning-on-hyperscalers.

## Choosing a store

Licences and status below were checked on 2026-11-05 against each repository; re-check before recommending.

| Option | Licence | Shape | Pick when |
|---|---|---|---|
| SOPS + age | MPL-2.0 / BSD-3-Clause | Encrypted files committed to git; no server | Default for a solo owner or small team, up to a few environments |
| Infisical | MIT outside `ee/` (enterprise features are separately licensed) | Self-hostable server, web UI, CLI (`infisical run`), integrations for Vercel, GitHub Actions, Kubernetes | A team, many environments, audit trail, per-person access, rotation UI |
| OpenBao | MPL-2.0 (Linux Foundation fork of Vault) | Server with dynamic secrets, leases, PKI, policies | Enterprise needs: short-lived database or cloud credentials |
| Key Vault, Secrets Manager, Secret Manager | Cloud services | Native to Azure, AWS, GCP | The workload already runs there and the client wants it in their tenant |
| Bitwarden Secrets Manager, 1Password | Not fully open source | Hosted | Only if the client mandates one; do not recommend as the open-source option |

Default to SOPS + age. Move to Infisical when a second person needs their own access or when more than about three environments make file juggling painful. Recommend; do not ask the owner to pick from the table.

## Rules that hold in every procedure
- Never run `sops -d`, `sops decrypt` or `infisical export` with output going to the terminal. Use `exec-env`, `--output <file>`, or a pipe into a consumer.
- A generated plaintext file is git-ignored, created with `umask 077`, and deleted after use unless a tool insists on it.
- The age private key file lives outside every repo. Its path goes in the owner profile and in `SOPS_AGE_KEY_FILE`, never in the repo.
- Encrypted files may be committed. Plaintext `.env*` (except `.env.example`) may not, and an existing `.env` is never overwritten.
- Anything that changes a platform (Vercel production, GitHub secrets, LiveKit, cloud stores) needs the owner's yes and runs as `! node scripts/vault-env.mjs ... --apply`.

## Procedure

1. **Bootstrap SOPS + age.**
   - Install: `brew install sops age` (or the release binaries).
   - Make the key outside the repo: `mkdir -p ~/.config/sops/age && umask 077 && age-keygen -o ~/.config/sops/age/keys.txt`. The public key (`age1...`) is not secret; read it with `age-keygen -y ~/.config/sops/age/keys.txt`. Add `export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt` to the shell profile.
   - Use one key per trust boundary: a dev key (every machine), a prod key (owner only), optionally a CI key. Create each with its own `age-keygen -o`.
   - Write `.sops.yaml` at the repo root, one rule per environment:
     ```yaml
     creation_rules:
       - path_regex: secrets/dev\.env$
         age: age1<dev-public-key>
       - path_regex: secrets/prod\.env$
         age: age1<prod-public-key>,age1<ci-public-key>
     ```
   - Create `secrets/dev.env` and `secrets/prod.env` from `.env.example` names, then encrypt in place: `sops encrypt -i secrets/dev.env`. Add `.env`, `.env.*` and `!.env.example` to `.gitignore`.
   - **Done when:** `node scripts/vault-env.mjs check` reports every tool and rule as ok, and `grep -c 'ENC\[' secrets/dev.env` is greater than zero.

2. **Use it daily without printing values.**
   - Run commands with secrets in their environment only: `sops exec-env secrets/dev.env 'npm run dev'`.
   - A tool that needs a file path: `sops exec-file --no-fifo secrets/dev.env 'tool --env-file {}'`.
   - A tool that insists on `.env`: `umask 077; sops decrypt --output-type dotenv --output .env.local secrets/dev.env` (use `.env` only when it does not exist yet). Delete it when done if the tool allows.
   - Hook behaviour: the guard blocks `cat .env` and similar, and the scanner flags tracked plaintext env files, but encrypted `secrets/*.env` files pass because their values are `ENC[...]`. The hooks cannot stop a `sops decrypt` that prints to the terminal, so that rule is yours.
   - **Done when:** the dev server starts through `exec-env` and no value appeared in output.

3. **Migrate an existing plaintext `.env`.** Owner-run, never echo.
   - Encrypt a copy, leaving `.env` untouched: `sops encrypt --filename-override secrets/dev.env --input-type dotenv --output-type dotenv .env > secrets/dev.env`.
   - Compare names: `node scripts/vault-env.mjs diff-keys --file secrets/dev.env --example .env.example`.
   - Run the app once through `exec-env`. Keep the old `.env` for a week, then archive it outside the repo. Do not delete it unprompted.
   - Every key that ever sat in chat or git history goes on the rotation list (step 6).
   - **Done when:** `diff-keys` shows no missing names and the app runs from the vault.

4. **Sync to platforms by pipe.** The script is dry-run until `--apply`:
   - GitHub Actions: `node scripts/vault-env.mjs sync-github --repo {{wb.github_owner}}/<repo> --file secrets/prod.env [--env production] [--apply]`.
   - Vercel: `node scripts/vault-env.mjs sync-vercel --env production --file secrets/prod.env [--apply]`. See stack-web:deploying-on-vercel.
   - LiveKit agent: `umask 077; sops decrypt --output-type dotenv secrets/prod.env | grep -E '^(LIVEKIT_[A-Z_]+|OPENAI_API_KEY)=' > .livekit.secrets`, then `lk agent update-secrets --secrets-file .livekit.secrets`, then `rm .livekit.secrets`.
   - Cloud session environment: generate a git-ignored `.env.cloud` with only the variables the cloud needs (same pipe with `grep -E`), hand over `! pbcopy < .env.cloud`, then delete it. See kickoff:handing-off-to-cloud.
   - Hyperscalers: read each CLI's help for the stdin or file option and never pass a value as an argument. GCP: `gcloud secrets versions add NAME --data-file=-`. AWS: `aws secretsmanager put-secret-value --secret-id NAME --secret-string file://<path>`. Azure: `az keyvault secret set --vault-name <vault> --name NAME --file <path>`. See ops-and-sre:provisioning-on-hyperscalers.
   - **Done when:** the dry-run lists the intended names, the applied run reports every name as set, and the platform's own list command shows them.

5. **Infisical, when a server is warranted.** Self-host steps and CI identities are in `references/infisical.md`. Daily use is `infisical run --env=dev -- <cmd>`. CI authenticates with a machine identity scoped to one project and environment, never a personal login.
   - **Done when:** `infisical run --env=dev -- node -e "process.exit(process.env.EXAMPLE_NAME ? 0 : 1)"` exits 0, with `EXAMPLE_NAME` replaced by a real variable name.

6. **Rotate.** Playbook in `references/rotation.md`: inventory with owner and expiry, create the new key, update the vault, sync, redeploy, verify with a real call, revoke the old key, record the date. For a leak, run workbench:handling-secrets first: rotate before rewriting history.
   - **Done when:** the old key is revoked at the provider and a smoke test passes with the new one.

7. **Back up the key and add a machine.**
   - Back up each age private key in two places that are not the repo and not chat: a password manager entry and an offline copy. Losing the key means the encrypted files are unrecoverable.
   - New machine: install sops and age, copy the dev key over a trusted channel (the password manager, not messaging), set `SOPS_AGE_KEY_FILE`, clone, run `check`.
   - Adding or removing a recipient: edit `.sops.yaml`, then `sops updatekeys secrets/dev.env`. Removing a recipient does not protect old git history, so rotate the values too.
   - **Done when:** the second machine runs `sops exec-env` successfully and `check` passes.

## Quick reference

| Task | Command |
|---|---|
| Health check | `node scripts/vault-env.mjs check` |
| Missing or extra names | `node scripts/vault-env.mjs diff-keys --file secrets/dev.env` |
| Edit values | `sops secrets/dev.env` (opens the editor; values stay out of chat) |
| Run with secrets | `sops exec-env secrets/dev.env '<cmd>'` |
| Add a recipient | edit `.sops.yaml`, `sops updatekeys <file>` |

## Rationalizations

| Excuse | Instead |
|---|---|
| "Just paste the key, it is faster." | Tell the owner the variable name; they run `sops secrets/dev.env`. |
| "I will `sops -d` once to check a value." | Check names with `diff-keys`; test the value with a real call. |
| "Commit the age key so CI works." | CI gets its own key as a platform secret. |
| "One key for dev and prod." | Separate recipients; prod stays owner-only. |

## Verification
- [ ] No value appeared in output, files tracked by git, or commits.
- [ ] The age private key is outside the repo and backed up in two places.
- [ ] `check` passes and `diff-keys` shows no missing names.
- [ ] Every platform sync was a dry run first and applied with the owner's yes.
- [ ] Previously exposed keys are on the rotation list.

## References

| File | Load when |
|---|---|
| references/infisical.md | self-hosting Infisical or giving CI a machine identity |
| references/rotation.md | rotating keys or planning a rotation schedule |

## Versions
- sops 3.13.3 (verified 2026-11-05, https://github.com/getsops/sops/releases)
- age 1.3.2 (verified 2026-11-05, https://github.com/FiloSottile/age/releases)
- infisical CLI 0.44.15 (verified 2026-11-05, https://github.com/Infisical/cli/releases)
- infisical server 0.167.6 (verified 2026-11-05, https://github.com/Infisical/infisical/releases)
- openbao 2.7.2 (verified 2026-11-05, https://github.com/openbao/openbao/releases)
