---
name: working-in-nextjs-16
description: Use when editing a project that already uses Next.js (package.json has next), especially Next.js 16 with Prisma 7, proxy.ts, async params, or the sileo toaster. Not for new projects, which use building-tanstack-frontends, nor for Vercel deploy steps, which is deploying-on-vercel.
---

# Working in Next.js 16

Existing projects stay on Next.js 16. New projects do not use Next.js. This version has breaking changes from what you remember, so read the bundled docs before using any API.

## When to use

- The repo has `next` in `package.json` or an `app/` directory.
- Errors about `middleware`, `params`, caching or the Prisma client in such a repo.

## When not to use

- Starting a new frontend: `stack-web:building-tanstack-frontends`.
- Rewriting an existing Next app to Vite unless the owner asks.

## Procedure

1. **Read the docs for the API you will touch** in `node_modules/next/dist/docs/` (resolved from the repo that has `next` installed). Heed deprecation notices. Also follow the repo's `AGENTS.md` and `CLAUDE.md`.
   **Done when:** you can name the doc file you read for each API used.
2. **Know the changes that bite.**
   - `proxy.ts` replaces `middleware.ts`; export a `proxy` function and a `config.matcher`. Treat it as an optimistic redirect only; authorise in the data layer on every request.
   - `params` and `searchParams` are Promises: `const { id } = await params`.
   - Cache Components are disabled unless the project chose them; do not enable them as a side effect.
   - Server-only modules start with `import "server-only"`; Client Components cannot import them.
   - Route handlers and server actions are public endpoints: validate input with Zod and check auth in each.
3. **Prisma 7.** The client is generated to `src/generated/prisma` (git-ignored); import from `@/generated/prisma/client`; always construct it with the `PrismaPg` adapter. Run `npx prisma generate` after every schema change and before build (`prisma generate && next build`). Local migrations with `prisma migrate dev`; production with `prisma migrate deploy` from the owner's machine, never against production from a dev command. Prisma's npm `latest` can be a prerelease (8.0.0-rc at the last check); stay on the stable 7.x line unless asked (`npm view prisma dist-tags`).
4. **Conventions.** Toasts use `sileo` (never sonner), mounted once in the root layout and called from Client Components. Icons from Lucide. Secrets stay out of the repo, logs and `NEXT_PUBLIC_` variables. Never overwrite the owner's `.env`. Read config through one server-only module whose helper treats an empty string as unset (fallbacks use `||`, not `??`), lazily, so `next build` needs no secrets. Details in `references/runtime-notes.md`.
5. **Verify.** Run `npm run build`, the project's typecheck and `npx vitest run`. If the repo has E2E, run it against mocks.
   **Done when:** build and tests pass with the output shown.
6. **Deploy and email** follow `stack-web:deploying-on-vercel` and `stack-web:sending-email-with-resend`; production steps need the owner's yes.

## Quick reference

| Topic | Rule |
|---|---|
| Middleware | `proxy.ts` |
| Params | `await params` |
| Prisma client | `@/generated/prisma/client` + `PrismaPg` |
| After schema edit | `npx prisma generate` |
| Toasts | sileo |
| Docs | `node_modules/next/dist/docs/` |
| Config fallbacks | `||` or an empty-as-unset helper, never `??` |
| Seeds and scripts | `tsx --conditions=react-server`; alias `server-only` in Vitest |
| Behind a TLS proxy | rewrite to sign-in, cookie `Secure` from the public URL |
| Dev returns 500 in a cloud session | `NODE_ENV=development`; do not `build` while dev runs |

## Verification

- Docs consulted for each non-trivial API.
- No `middleware.ts` added; no sonner; no committed generated client.
- Build and tests green.

## References

| File | Load when |
|---|---|
| references/runtime-notes.md | writing the env module, running seeds or tests outside Next, meeting the three kinds of middleware, sitting behind nginx, or a dev server misbehaving in a cloud session |

## Versions

- next 16.4.5 (verified 2026-11-05, https://registry.npmjs.org/next/latest)
- prisma: `latest` tag was 8.0.0-rc.30, stable `prev` tag 7.10.1 (verified 2026-11-05, https://registry.npmjs.org/prisma)
- sileo 0.1.6 (verified 2026-11-05, https://registry.npmjs.org/sileo/latest)
