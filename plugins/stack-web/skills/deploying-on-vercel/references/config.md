# Vercel config snippets

Confirm key names against https://vercel.com/docs/project-configuration before use. Use `vercel.json` or `vercel.ts`, not both.

## Vite SPA

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Filesystem matches (built assets) win over the rewrite. If `cleanUrls` is on, drop `.html` from the destination. Only `VITE_` variables reach the browser.

## TanStack Start with Nitro

```ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({ plugins: [tanstackStart(), nitro(), viteReact()] });
```

Runs as Vercel Functions. Docs: https://vercel.com/docs/frameworks/full-stack/tanstack-start

## FastAPI

```
backend/
  pyproject.toml     # requires-python = ">=3.12"
  app.py             # app = FastAPI()
```

Custom entry: `[tool.vercel] entrypoint = "backend.server:app"`. Per-function duration in `vercel.json`: `"functions": { "app.py": { "maxDuration": 60 } }` (key is the resolved entry file). Local run: `vercel dev`. Lifespan shutdown work gets about 500 ms after SIGTERM. A built SPA can be served by the CDN through `app.frontend("/", directory="dist")`; API routes win over it.

## Vercel Services (beta)

```json
{
  "services": {
    "web": { "root": "frontend/" },
    "api": { "root": "backend/", "entrypoint": "main:app" }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": { "service": "api" } },
    { "source": "/(.*)", "destination": { "service": "web" } }
  ]
}
```

Services are private unless a top-level rewrite targets them. With `services` present, per-service build settings move into each service. Whether the `/api` prefix is stripped before FastAPI sees it was not verified: test it on a preview and mount routes accordingly. The older `experimentalServices` key is superseded.

## Release steps in the build

Point `buildCommand` at a small script (`node scripts/vercel-build.mjs`). It runs optional release steps (migrate, content release) only when `VERCEL_ENV === "production"` and the step was asked for: `--build-env RUN_X=true` on a CLI deploy, or a literal token such as `[migrate]` in `VERCEL_GIT_COMMIT_MESSAGE` for a Git-triggered deploy. On previews print a warning and skip. Never store the flag as a project env var, or every later build repeats it. A failing step must fail the build, so the previous deployment keeps serving. Any pusher to the production branch can fire the token, so keep that branch behind branch protection or the owner's merge.

## Private app behind a shared password

- Rewrite every path except `robots.txt` to one function (`/((?!robots\\.txt$).*)` to `/api/index?path=/$1`) and ship the built HTML inside the function bundle as a JS module string, so no public file exists to fetch directly.
- The cookie value is `HMAC(password, "<app>:v1")`, not the password: `HttpOnly; Secure; SameSite=Lax`, 30 days. Changing the password signs everyone out. Compare SHA-256 digests with `timingSafeEqual`, and delay a wrong attempt by about 800 ms.
- Send `X-Robots-Tag: noindex` and `Cache-Control: private, no-store` on the HTML. Signed approval links are the only unauthenticated routes and carry their own HMAC.
- Fail closed: with the password variable unset, answer 503, never open. One shared password means no per-user identity; use `stack-web:adding-auth` when an audit trail matters.

## Local server and function share code

Keep shared modules in one folder and have a build script copy them (and data as `export const X = <json>` modules) into the deploy project's `lib/`. Head each output `// generated: do not edit`, git-ignore them, and make the deploy script rebuild, copy, then run `vercel deploy --prod`, in that order. When inlining files with `String.replace`, pass a function replacer (`.replace(token, () => text)`): replacement strings treat `$&` and `$1` specially and corrupt minified JS.

## Limits

| Limit | Value |
|---|---|
| Request/response body | 4.5 MB |
| Duration | 300 s default; Hobby max 300 s; Pro/Enterprise up to 800 s |
| Bundle | 500 MB uncompressed (Python), 250 MB others |
| Memory | 2 GB default |
| File descriptors | 1,024 |

## CLI quick commands

```bash
timeout 600 vercel deploy --yes </dev/null            # preview
timeout 600 vercel deploy --prod --yes </dev/null     # production: owner's yes first
vercel env ls </dev/null
vercel env add API_KEY production --sensitive --yes < ./secret.txt
vercel inspect <url> --wait --timeout 5m </dev/null   # exit 124 on timeout
```
