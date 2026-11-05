---
name: deploying-on-vercel
description: Use when deploying, previewing, configuring env vars or fixing a build on Vercel, adding a vercel.json, hosting FastAPI or TanStack Start there, or deciding whether something belongs on Vercel at all. Not for custom domains and DNS, which is adding-subdomains, nor for VPS hosting, which is ops-and-sre:deploying-to-a-vps.
---

# Deploying on Vercel

Vercel hosts everything it can: SPAs, TanStack Start, Next.js, FastAPI. Production deploys, env changes and spending need the owner's yes every time. Read the current docs for any config key before relying on it.

## When to use

- First deploy of a Vite SPA, TanStack Start app, Next.js app or FastAPI service.
- `vercel env` work, preview versus production, build failures, blocked deploys.
- "Can this run on Vercel?"

## When not to use

- Attaching `<name>.{{wb.domain}}`: `stack-web:adding-subdomains`.
- Temporal workers, long-lived sockets, anything that must stay up beyond function limits: `ops-and-sre:deploying-to-a-vps`.

## Procedure

1. **Decide the fit.** Stay on Vercel if the work is request/response within limits: 4.5 MB request or response body, 300 s default function duration (Hobby max 300 s, Pro up to 800 s). Do not put on Vercel: Temporal workers, WebSocket servers that must hold connections long term, background loops, GPU or large-binary jobs, or a Python bundle near 500 MB uncompressed. Send those to the VPS skill.
   **Done when:** the target is named per component.
2. **Pick the shape.**
   - Vite SPA: zero-config build; add the SPA rewrite in `references/config.md`. Without it deep links return 404.
   - TanStack Start: add `nitro` and put `nitro()` in the Vite plugins; no `vercel.json` needed.
   - FastAPI: expose `app` from `app.py`, `index.py`, `server.py` or `main.py` (also under `src/` or `app/`), or set `[tool.vercel] entrypoint` in `pyproject.toml`. The whole app is one function. Pin Python through `requires-python`.
   - TS frontend + Python backend in one repo: **Vercel Services is beta**. Use it only if the owner accepts beta; the safe alternative is two Vercel projects (frontend, api) joined by a rewrite or CORS. Re-read https://vercel.com/docs/services before use.
   - Use `vercel.json` or `vercel.ts`, never both.
3. **Check for build breakers.** A stray `.npmrc` or `.env.production.local` has broken builds here before: look for them, and delete or ignore them only with the owner's agreement. Use npm. Pin `engines.node`.
4. **Commit author.** On Hobby, Vercel blocks deploys whose commit author is not linked to the owner's account. Set `git config user.email {{wb.git_author_email}}` in repos Vercel deploys, including merge commits.
5. **Env vars, non-interactive, no echo.**
   - Add: `vercel env add NAME production --sensitive --yes < secret-file` (stdin from a file, never `echo "$SECRET" |` into shell history or logs). Use `--value` only for non-secrets.
   - Scope preview variables with a git branch when they differ.
   - `vercel env ls`, `vercel env pull .env.local` (merges, keeps local-only keys), `vercel env rm NAME production --yes`.
   - Secret values cannot be read back; never print them.
6. **Run the CLI safely from an agent.** Always `</dev/null`, a `timeout`, `--yes`, and auth by `VERCEL_TOKEN` in the environment (not `--token`, which shows in process lists) or an already linked project (`VERCEL_ORG_ID` + `VERCEL_PROJECT_ID` skip `vercel link`). Example: `timeout 600 vercel deploy --yes </dev/null`.
   **Done when:** the command exits 0 and prints a deployment URL.
7. **Preview first.** `vercel deploy` makes a preview; pushes to feature branches do too. Test the preview without side effects: mock or test recipients for email, test data, no real sends.
8. **Production gate.** Stop and ask the owner before `vercel deploy --prod`, a push to the production branch that auto-deploys, a production env change, or a production database migration. State the cost (prefer free tiers), what changes, and the rollback (`vercel rollback`, previous deployment). Check first for builds in progress. Run migrations from the owner's machine before the deploy that needs them.
9. **Confirm what is live.** After `vercel deploy`, the domain can briefly serve the previous deployment. Expose a version marker (commit SHA at `/api/health` or a meta tag), poll until it matches, and only then run any request with side effects.
   **Done when:** the live URL returns the new marker and a smoke request passes.
10. **Private files.** Use private Vercel Blob (`access: "private"`) for uploads and serve through an authenticated route. Do not rely on unguessable public URLs for user documents.

## Quick reference

| Topic | Rule |
|---|---|
| Body limit | 4.5 MB, then 413 |
| Default duration | 300 s; raise per function with `maxDuration` |
| Cron on Hobby | daily only |
| SPA deep links | rewrite `/(.*)` to `/index.html` |
| Start | `nitro` plugin |
| FastAPI | `app` object in a known entry file |
| Services | beta |
| Hobby commits | author `{{wb.git_author_email}}` |
| CLI in agents | `</dev/null`, `timeout`, `--yes`, `VERCEL_TOKEN` |

## Verification

- Deployment URL and version marker shown, not assumed.
- No secret printed in logs or the diff; `.env*` git-ignored except `.env.example`.
- Preview tested before any production step; production step had the owner's yes.
- Nothing long-running left on Vercel that belongs on the VPS.

## References

| File | Load when |
|---|---|
| references/config.md | writing vercel.json, Start/Nitro config, FastAPI layout, Services config, limits |

## Versions

- vercel CLI 65.11.0 (verified 2026-11-05, https://registry.npmjs.org/vercel/latest)
- @tanstack/react-start 1.169.4 with nitro 3.0.261103-rc, a release candidate; Nitro is required by Start on Vercel (verified 2026-11-05, https://vercel.com/docs/frameworks/full-stack/tanstack-start)
- Function limits: 4.5 MB body, 300 s default, Pro up to 800 s, Python bundle 500 MB (verified 2026-11-05, https://vercel.com/docs/functions/limitations)
- FastAPI on Vercel; Python 3.12 default, 3.13 and 3.14 available (verified 2026-11-05, https://vercel.com/docs/frameworks/backend/fastapi)
- Vercel Services, beta (verified 2026-11-05, https://vercel.com/docs/services)
- Vercel env CLI (verified 2026-11-05, https://vercel.com/docs/cli/env)
