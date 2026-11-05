---
name: storing-data-on-vercel
description: Use when an app on Vercel needs file uploads, config or feature flags read at the edge, a Postgres or Redis, or someone mentions @vercel/postgres, @vercel/kv or Edge Config. Not for schema design, which is stack-python modeling-data-in-postgres, nor for vector search, which is searching-with-qdrant.
---

# Storing data on Vercel

Vercel offers first-party Blob and Global Config only. Databases come from the Marketplace. Files that belong to a person are private.

## When to use

- User uploads, generated PDFs, resumes, exports.
- A read-mostly value (maintenance flag, redirect list) that must be instant.
- Provisioning Postgres or Redis for a Vercel project.
- Old code imports `@vercel/postgres`, `@vercel/kv` or `@vercel/edge-config`.

## When not to use

- Data modelling and migrations: `stack-python:modeling-data-in-postgres`.
- Embeddings and similarity search: `stack-python:searching-with-qdrant`.
- Env handling in general: `stack-web:deploying-on-vercel`.

## Procedure

1. **Pick the store.** Files: Blob. Instant config: Global Config. Relational: Neon Postgres via Marketplace. Cache or counters: Upstash Redis via Marketplace. `@vercel/postgres` and `@vercel/kv` are sunset; replace them with `@neondatabase/serverless` and `@upstash/redis`.
2. **State the cost and get a yes** before provisioning anything. Prefer free tiers. Provision with `vercel integration add neon` so environment variables are injected, then `vercel env pull .env.local`. If you provision outside Vercel, add the variables yourself.
   **Done when:** `vercel env ls` lists the new variable names (never print values).
3. **Blob access.** Create private stores with `vercel blob create-store <name> --access private`. Upload and read with `access: 'private'`; connected projects use short-lived OIDC credentials. Serve private files through an authenticated route, not a public URL. Public access suits only genuinely public assets.
4. **Large uploads go browser to Blob.** Use `upload()` from `@vercel/blob/client` with a token route; a function body is capped at 4.5 MB.
5. **Global Config is not a database.** Reads are fast, writes are slow and rare. It was renamed from Edge Config; `@vercel/global-config` is a drop-in and reads `GLOBAL_CONFIG`, falling back to `EDGE_CONFIG`.
6. **Initialise database clients lazily.** `neon(process.env.DATABASE_URL!)` at module top level crashes `next build` before the variable exists. Wrap it in a getter. Do not wrap the client in a `Proxy`; auth libraries inspect the adapter and break.
7. **Scripts do not read `.env.local`.** Only Next.js does. Run `dotenv -e .env.local -- <command>` for migration and seed scripts.
8. **Existing Prisma apps** keep the `PrismaPg` adapter per `stack-web:working-in-nextjs-16`; the Neon driver choice is for new code.

## Quick reference

| Need | Package | Note |
|---|---|---|
| Files | `@vercel/blob` | private by default for user data |
| Edge config | `@vercel/global-config` | read-heavy only |
| Postgres | `@neondatabase/serverless` | Marketplace, free tier |
| Redis | `@upstash/redis` | `Redis.fromEnv()` |

## Verification

- [ ] User files are private and served through a checked route.
- [ ] No sunset package imported.
- [ ] Build passes with the database variable unset.
- [ ] Cost stated and approved before provisioning.

## Versions

- @vercel/blob 2.8.2 (verified 2026-11-05, https://registry.npmjs.org/@vercel/blob/latest)
- @vercel/global-config 1.5.1 (verified 2026-11-05, https://registry.npmjs.org/@vercel/global-config/latest)
- @neondatabase/serverless 1.2.0 (verified 2026-11-05, https://registry.npmjs.org/@neondatabase/serverless/latest)
