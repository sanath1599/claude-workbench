---
name: building-tanstack-frontends
description: Use when starting or extending a new frontend, dashboard or web UI, or when the owner mentions TanStack Router, Query, Form or Table, Vite, a router/loader/search-param question, or toasts and icons in a new app. Not for existing Next.js apps, which is working-in-nextjs-16, nor for deploy steps, which is deploying-on-vercel.
---

# Building TanStack frontends

New frontends are TypeScript + Vite + TanStack (Router, Query, Form, Table), with `sileo` toasts and Lucide icons. Next.js is for existing projects only. Read the current docs before using an API; the TanStack libraries change fast.

## When to use

- "Start a new dashboard / admin / internal tool / frontend."
- Adding routes, data loading, forms, tables or search-param state to a Vite + TanStack app.
- Deciding between a Vite SPA and TanStack Start.

## When not to use

- The repo already has `next` in `package.json`: use `stack-web:working-in-nextjs-16`.
- Shipping or configuring Vercel: `stack-web:deploying-on-vercel`.
- Login, sessions, route guards: `stack-web:adding-auth`.
- Visual design: get the approved single-file HTML mockup first (house rules), then build.

## Procedure

1. **Choose SPA or Start.** Default to a Vite SPA when the backend is separate (FastAPI) and the app sits behind a login: no SEO need, simplest deploy. Choose TanStack Start only for SSR or SEO pages, streamed HTML, or TypeScript server functions acting as a backend-for-frontend. Say the choice and the reason in one line.
   **Done when:** the choice is written in the README or CLAUDE.md.
2. **Scaffold.** Run `npx @tanstack/cli create --router-only` for an SPA (file-based routing, TypeScript). Omit `--router-only` for Start. Use npm (`{{wb.package_manager}}`) and keep the lockfile. Do not commit a stray `.npmrc` or `.env.production.local`; both have broken Vercel builds.
   **Done when:** `npm run dev` serves a page and `npm run build` passes.
3. **Plugin order.** In `vite.config.ts` the router plugin goes before the React plugin, or route generation breaks. Details in `references/setup.md`. Exclude `src/routeTree.gen.ts` from lint and format.
4. **Router context carries the QueryClient.** Create the `QueryClient` inside the `createRouter` factory (never at module scope, which leaks state between requests in Start), pass it as `context`, and type it with `createRootRouteWithContext`.
5. **Data loading pattern.** Define `queryOptions` once per resource. The route `loader` calls `context.queryClient.ensureQueryData(opts)`; the component reads with `useSuspenseQuery(opts)`. Mutations call `invalidateQueries`, not manual refetches. Add a `pendingComponent` and an `errorComponent`.
6. **Search params are state.** Put filters, sort, page and tab in the URL with `validateSearch`. Zod v4 schemas work directly (Standard Schema); Zod v3 needs `@tanstack/zod-adapter`. Use `.catch()` for a silent fallback on bad input and `.default()` when you want the error component.
7. **Forms and tables.** TanStack Form with a Zod validator on the field or form; TanStack Table v9 for any grid, with column definitions outside the component. Every list needs loading, empty and error states. No text is cut off without a "show more"; the layout works on phone, iPad and desktop.
8. **Toasts, icons, tokens.** Mount one sileo `<Toaster>` in `__root.tsx`; call `sileo.success/error/promise` from handlers. Icons come from `lucide-react`; no emojis in the UI. Keep colours, radii, spacing and fonts as CSS variables in one `src/styles/tokens.css`, with a light default and a dark override. Snippets in `references/setup.md`.
9. **Env.** Only `VITE_`-prefixed variables reach the browser, and they are public. Never put a secret behind `VITE_`. Commit `.env.example`, never `.env`.
10. **Devtools.** Router and Query devtools in the root route; they strip themselves from production builds.
11. **Test.** Vitest (with Testing Library) for components and pure logic; Playwright for flows against a mocked API. Tests never call real LLM, email or voice providers.
    **Done when:** `npm run build`, `npx vitest run` and `npx playwright test` pass, and a browser check of the main route at phone width shows no horizontal scroll.

## Quick reference

| Need | Use |
|---|---|
| New SPA | `npx @tanstack/cli create --router-only` |
| Server data in a route | `loader` + `ensureQueryData`, component `useSuspenseQuery` |
| URL state | `validateSearch` with Zod v4 |
| Toast | `sileo` (never sonner) |
| Icons | `lucide-react` |
| Auth-gated app with Python API | Vite SPA + FastAPI |
| SSR, SEO, BFF | TanStack Start (with Nitro on Vercel) |

## Verification

- Router plugin precedes the React plugin; `routeTree.gen.ts` is generated and ignored by lint.
- QueryClient is created per router, not at module scope.
- No secret in any `VITE_` variable.
- Loading, empty and error states exist for every data view.
- One Toaster, sileo only; Lucide only.

## References

| File | Load when |
|---|---|
| references/setup.md | writing vite config, root route, query options, search params, form, table, Toaster, tokens |

## Versions

- @tanstack/react-router 1.170.46 (verified 2026-11-05, https://www.npmjs.com/package/@tanstack/react-router)
- @tanstack/router-plugin 1.168.48 (verified 2026-11-05, https://www.npmjs.com/package/@tanstack/router-plugin)
- @tanstack/react-query 5.106.1 (verified 2026-11-05, https://www.npmjs.com/package/@tanstack/react-query)
- @tanstack/react-start 1.169.4, stable, needs vite 8 or newer (verified 2026-11-05, https://tanstack.com/start/latest/docs/framework/react/overview)
- @tanstack/react-form 1.33.5 (verified 2026-11-05, https://www.npmjs.com/package/@tanstack/react-form)
- @tanstack/react-table 9.3.1 (verified 2026-11-05, https://www.npmjs.com/package/@tanstack/react-table)
- vite 8.3.6, typescript 7.0.2, zod 4.6.7 (verified 2026-11-05, https://registry.npmjs.org)
- sileo 0.1.6, lucide-react 1.69.0 (verified 2026-11-05, https://registry.npmjs.org)
