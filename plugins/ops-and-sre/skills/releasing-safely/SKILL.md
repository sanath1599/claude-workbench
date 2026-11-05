---
name: releasing-safely
description: Use when about to deploy, ship, release or promote to production, run a production migration, change DNS or infrastructure, roll back, or add a feature flag. Triggers on "deploy this", "push to prod", "run the migration", "prod is missing a column". Not for CI setup (setting-up-ci) or VPS mechanics (deploying-to-a-vps).
---

# Releasing safely

A release is a series of reversible steps, each with evidence. Nothing reaches production without the owner's yes for that action, and nothing is called deployed until the new version is seen serving.

## When to use

- Any request to deploy, release, promote, roll back, migrate a production database, change DNS, or create a paid resource.
- A schema change that has to reach several environments.
- A workflow or worker code change in a Temporal project.

## When not to use

- Pipeline authoring: `ops-and-sre:setting-up-ci`.
- Copying files to the VPS, nginx, pm2: `ops-and-sre:deploying-to-a-vps`.
- Something is already broken in production: `ops-and-sre:handling-incidents`.

## Procedure

1. **Read the policy.** Open `.claude/workbench.json` and read `productionDeploys`. If it permits auto-deploy on merge to `main`, a merge is the approval for code only. Infrastructure, DNS, paid resources and production database migrations still need a yes. Without the file, every production action needs a yes. **Done when:** you can say which actions you may do alone.
2. **Run the gate.** All of these, in order, and show the output:
   - Working tree clean; branch pushed; CI green on the exact commit (`gh run list --commit <sha>`).
   - Nothing running that a deploy would interrupt: no build in progress (`vercel ls` or the dashboard, `gh run list --status in_progress`), no long job or Temporal workflow that cannot be replayed, no one else mid-deploy.
   - Migration plan reviewed (steps 4 to 6) and backup taken (step 3).
   - Rollback plan written down (step 8).
   - The literal build the pipeline runs, from a clean checkout, not a faster local subset: incremental TypeScript caches (`tsc -b`) hide errors a clean build reports.
   - Cost stated. Prefer free tiers; say "no new cost" when true.
   **Done when:** every line has evidence or an explicit "not applicable".
3. **Back up before overwriting.** Any cloud config you will replace (Vercel env vars, nginx vhost, systemd unit, DNS records, LiveKit agent settings): export it to a dated file outside the repo first. For a workflow definition, auth config or app-settings block: write it to `backups/<date>-<change>/<name>.before.json` before the PUT, create the new version under a throwaway name and run it once, then promote. Disable rather than delete what you replace (a `FlowState=Disabled` setting), saving the previous values. Backups that hold user data go outside the repo with owner-only permissions. For databases, take a Neon branch or `pg_dump` before a migration. An overwrite once destroyed working config; this step is not optional. **Done when:** the backup path exists and is non-empty.
4. **Ask for the yes.** Send one message: what will change, where, the cost, the backup path, the rollback, the verification you will run. Wait for an explicit yes for each production action. A yes for one deploy is not a yes for the next. **Done when:** the owner's reply names the action.
5. **Roll out dev, then test or staging, then production.** Users must see no downtime. Use preview deployments and a staging database first. For a release that writes data (content release, seed, backfill), rehearse it on a scratch database first: the script refuses any `DATABASE_URL` whose database name lacks "test", and lint, typecheck and tests afterwards run with the database variables unset. **Done when:** the same artifact passed the earlier environment.
6. **Migrate in expand/contract steps.** Release 1 adds (nullable column, new table, new index created concurrently) and ships code that tolerates both shapes. Release 2 backfills and switches reads. Release 3 removes the old shape after nothing uses it. Never rename or drop in the same release as the code change. Catch-up migrations must be idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`). **Done when:** the old code version still runs against the new schema.
7. **Deploy and verify.** After the deploy, confirm the new version is the one serving before any request with side effects: fetch the version marker (a `/api/version` or `/health` endpoint returning the commit SHA, or a response header) and compare it to the commit you shipped; read the deploy logs. For non-web artefacts (agent definitions, workflow definitions, app settings) end the pipeline with a read-back step that fetches what was just deployed and compares version or hash; fail the pipeline if it cannot be read back, and treat a pointer that lags behind as a warning. Then run a production check with no side effects: read-only requests, a test account, email and proposal sending disabled or pointed at a sink. Never send a real email or create a real proposal to test. **Done when:** you can print URL, marker value, commit SHA and a log excerpt.
8. **Keep a rollback ready.** Know the exact command before you deploy: Vercel promote the previous deployment (`vercel rollback` or promote from the dashboard), `git revert` plus redeploy, restore the backed-up config, or flip a feature flag off. Database rollback is a forward fix; expand/contract is what makes that safe. **Done when:** the command is in your gate message.
9. **Update the knowledge graph.** If the repo uses graphify (a `graphify-out/` folder, or a "Knowledge graph" section in CLAUDE.md), run `graphify update .` after the release. Add `/graphify . --update` when docs or images changed. Commit `GRAPH_REPORT.md` and `graph.json` with the release. **Done when:** the graph commit follows the release commit.
10. **Report with evidence.** State what shipped, the URL, the marker, the log lines, and what you did not verify. Never write "deployed" without them.

## Migration drift (Prisma)

Drift happens when dev uses `prisma db push` and production uses `prisma migrate deploy`: columns exist in dev and never reach production. Rules:

- Always create migrations with `prisma migrate dev --name <change>`. Never use `db push` in a project that has a production database.
- Find what production lacks, read-only: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` (Prisma 7 reads the datasource from `prisma.config.ts`; point it at production through the environment on the owner's machine, never print the URL). Check the flags against `npx prisma migrate diff --help` in the installed version.
- Turn the diff into a catch-up migration with idempotent statements, review it, test it on a copy, then the owner runs `npx prisma migrate deploy` via a script (`! bash scripts/migrate-prod.sh`).
- `prisma migrate reset` is forbidden for agents: it drops data. Do not run it on any database, ever; ask the owner.

Alembic equivalent:When production credentials are write-only (Vercel sensitive vars, CI secrets), run the migration where the secret lives: a manual `workflow_dispatch` job that needs a typed confirmation input and a protected `environment` with required reviewers, using the non-pooled connection string, or a one-shot build flag. It runs before the code that needs the schema is promoted. Never `migrate deploy` in the normal build, and never at request time.

Alembic equivalent: `alembic revision --autogenerate -m "<change>"`, read the generated file (autogenerate misses some changes), `alembic upgrade head --sql` to preview, `alembic current` and `alembic heads` on the target to compare, never `alembic downgrade` on production without a yes, and idempotent guards (`op.execute("ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...")`) in catch-up revisions.

## Feature flags

Ship risky behaviour dark behind an env-flag toggle (`FEATURE_X=1`), default off, read at request time. Turn it on in staging, then in production as a separate step that needs its own yes if it changes user-visible behaviour. Remove the flag in a later release. A flag is a rollback that needs no deploy.

Give each independent capability its own flag, read at runtime, so a rollback is a settings change. When off, timers become no-ops and tools answer "not available" instead of erroring. Dev-only surfaces (test API, debug routes) default to the secure setting and 404 unless explicitly enabled; staging and production never set the dev value. Write down which flags each environment has on.

## Temporal worker versioning

Changing workflow code can break running workflows by non-determinism. Before deploying workflow changes: run replay tests against saved histories (`Replayer`), then choose one: use Worker Versioning with pinned workflows so old runs finish on old workers (keep the old worker build running until its versions drain), or patch with `workflow.patched("<id>")` and keep both branches until no old run remains. Restart every worker process, not only the web process. Check the current docs at https://docs.temporal.io/worker-versioning before using the API.

## Quick reference

| Action | Needs owner yes |
|---|---|
| Code change, local commit | no |
| Merge to main with `productionDeploys: auto` | no (code only) |
| Production deploy otherwise | yes, each time |
| Prod migration, DNS, infra, paid resource | yes, always |
| `migrate reset`, `downgrade`, drop | forbidden for agents |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "It's a tiny fix, skip the gate" | Small fixes break production too. Run the gate. |
| "They said deploy earlier" | One yes covers one action. Ask again. |
| "The build finished, so it's live" | Check the marker. Caches and stale aliases lie. |
| "I'll test with one real email" | Use a sink or a test mode. |
| "Just `db push` it to prod" | That is how drift started. Write a migration. |
| "Backup later, it's additive" | Back up first. Additive changes still fail. |

## Verification

- [ ] Policy read; gate output shown; no build or job running
- [ ] Backup path exists; yes quoted; cost stated
- [ ] Migrations idempotent and compatible with the old code
- [ ] Marker equals the shipped SHA; logs read; side-effect-free prod check done
- [ ] Rollback command stated

## Versions

- prisma 8.0.0-rc.30 is the npm latest tag; the project's installed major decides flags (verified 2026-11-05, https://www.npmjs.com/package/prisma)
- alembic 1.20.1 (verified 2026-11-05, https://pypi.org/project/alembic/)
- temporalio 1.35.0 (verified 2026-11-05, https://pypi.org/project/temporalio/)

## References

| File | Load when |
|---|---|
| references/deploy-gate.md | pasting the gate into an approval message |
