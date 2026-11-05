# Infisical: self-host and CI

Read the current self-hosting docs at https://infisical.com/docs/self-hosting/overview before running anything; the compose file and variable names change between releases.

## Self-host quickstart (docker compose)
1. Fetch the compose file from the Infisical repository's documented self-host path into a new directory outside any project repo, and pin the image tag to a release (see the server version in SKILL.md), never `latest`.
2. Create its env file without printing values. Generate each secret straight into the file: `umask 077; { printf 'ENCRYPTION_KEY='; openssl rand -hex 16; printf 'AUTH_SECRET='; openssl rand -base64 32; } > .env`. Add the database and Redis settings the docs list. Back this file up like an age key: losing `ENCRYPTION_KEY` makes stored secrets unrecoverable.
3. `docker compose up -d`, open the UI on the bound port, create the first admin, then put the instance behind HTTPS on `{{wb.domain}}` before any real use. Never expose the plain port.
4. Back up Postgres on a schedule and test one restore.

## Daily use
- `infisical login --domain https://<your-instance>`, then `infisical init` in the repo (writes `.infisical.json`, which holds project ids, no secrets; commit it).
- `infisical run --env=dev -- npm run dev` injects variables into one process.
- Import an existing file once: `infisical secrets set --file secrets/dev.env --env=dev` is not guaranteed in every version; check `infisical secrets --help` first, or use the web import.

## CI with a machine identity
- Create a machine identity in the Infisical UI with Universal Auth, give it read access to one project and one environment, and store its client id and secret as CI secrets.
- In the job, exchange them for a token and run the command: `INFISICAL_TOKEN=$(infisical login --method=universal-auth --client-id="$INFISICAL_CLIENT_ID" --client-secret="$INFISICAL_CLIENT_SECRET" --silent --plain) infisical run --env=prod --projectId="$INFISICAL_PROJECT_ID" -- <cmd>`.
- For Vercel and GitHub Actions, prefer the native Infisical integrations (set up in the UI) over copying values; they keep platforms in sync on every change.
- Rotate the identity's client secret on the same schedule as other keys.
