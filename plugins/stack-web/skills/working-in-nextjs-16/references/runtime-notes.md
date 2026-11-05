# Next.js 16 runtime notes

Detail behind the rules in `SKILL.md`. Read the bundled docs in `node_modules/next/dist/docs/` first; these notes cover what the docs leave to you.

## Config through one server-only module

Read every setting through one module that starts with `import "server-only"` and exposes a helper that trims and treats an empty string as unset:

```ts
const str = (name: string) => process.env[name]?.trim() || undefined;
export const unpooledUrl = () => str("DATABASE_URL_UNPOOLED") || str("DATABASE_URL");
```

- Use `||` or the helper for fallbacks, never `??`: platforms and `.env` files often define a variable as an empty string, and `??` then keeps the empty value.
- Read lazily inside functions, so `next build` needs no secrets or database. The same rule applies to `prisma.config.ts`.
- A missing required value throws a `ConfigError`; the API wrapper maps it to 503 "not configured" with no variable names in the body.

## Running server-only code outside Next

- `import "server-only"` throws outside Next. Run seeds and smoke scripts with `tsx --conditions=react-server`.
- In Vitest, alias `server-only` to an empty module so server code imports directly.
- Write route handlers as plain `(req: Request) => Response` functions that read cookies from the `Request`, not `next/headers`, so tests call them without a Next runtime.

## Three things called middleware

Vercel Routing Middleware (platform level, any framework, runs before the cache), Next.js 16 `proxy.ts` (Node.js only, network boundary) and plain Functions. In Next.js 16 do the real authorization check in the route or server action too; `proxy.ts` is an early filter. `NextRequest.geo` and `.ip` are gone: use `geolocation()` and `ipAddress()` from `@vercel/functions`.

## Behind a TLS-terminating proxy

`request.url` shows the internal host and scheme. In `proxy.ts` show the sign-in page with `NextResponse.rewrite` instead of a redirect, and set the cookie `Secure` flag from the configured public URL (`AUTH_URL` starts with `https://`) or `X-Forwarded-Proto`. Forward `Host` and `X-Forwarded-Proto` in the nginx location block.

## Dev server in cloud and devcontainer sessions

- 500s from `next dev`: check `echo $NODE_ENV`. A global `production` makes dev look for build output; start with `NODE_ENV=development`.
- `next build` overwrites `.next` and corrupts a running dev server: stop dev first, restart after.
- Wrap any component using `useSearchParams` in `Suspense`, or the login page fails to prerender.
