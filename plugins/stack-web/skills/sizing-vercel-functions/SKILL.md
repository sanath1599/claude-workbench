---
name: sizing-vercel-functions
description: Use when picking a runtime or limits for a Vercel Function, hitting 413 or 504 errors, deciding whether to keep `runtime = 'edge'`, streaming or SSE questions, caching responses, or running work after the response. Not for deploy and env steps, which is deploying-on-vercel, nor for jobs that outlive a request, which is choosing-background-work-on-vercel.
---

# Sizing Vercel Functions

Vercel Functions run on Fluid Compute: warm instances shared across concurrent requests, billed for active CPU rather than wall-clock time. Most advice remembered from before 2025 is wrong. Check the numbers below against the live limits page before promising anything to the owner.

## When to use

- A route returns `413 FUNCTION_PAYLOAD_TOO_LARGE` or `504 FUNCTION_INVOCATION_TIMEOUT`.
- Someone proposes `export const runtime = 'edge'` to get streaming, low latency or cheaper runs.
- A Python or Node bundle fails with "exceeded the unzipped maximum size".
- Work must continue after the response is sent, or a response should be cached by tag.

## When not to use

- First deploy, env vars, domains: `stack-web:deploying-on-vercel`, `stack-web:adding-subdomains`.
- Anything that must survive a crash or run for hours: `stack-web:choosing-background-work-on-vercel`.
- Next.js 16 file conventions (`proxy.ts`, params): `stack-web:working-in-nextjs-16`.

## Procedure

1. **Stay on Node.js.** Omit the `runtime` export. Edge buys nothing on Fluid Compute: same regions, same pricing, smaller API surface (no `fs`, no native modules), a 25 s time to first byte, and a 1 to 4 MB gzipped code cap. Next.js 16.3 and later ignore `runtime = 'edge'` anyway. Remove it when you touch the file.
   **Done when:** no route in the diff sets `runtime = 'edge'`, and any stated reason for Edge has been answered with the table below.
2. **Set duration deliberately.** Default is 300 s on every plan. Hobby cannot go above 300 s. Pro goes to 800 s with `export const maxDuration = 800`. Above 800 s up to 1800 s is a beta, per function only, not a project default. Past that, use Workflow. Python and other non-Next frameworks set it in `vercel.json` under `functions`, keyed on the entrypoint file.
   **Done when:** the number is justified by a measured run, not guessed.
3. **Respect payload and bundle limits.** Request and response bodies cap at 4.5 MB. Send uploads straight from the browser to Vercel Blob (see `stack-web:storing-data-on-vercel`) and stream large responses. Bundle limit is 250 MB uncompressed (500 MB for Python); 5 GB with the "large functions" beta. Trim first: exclude tests and fixtures, move build-only packages to devDependencies. Next.js uses `outputFileTracingExcludes`, not `excludeFiles`.
4. **Stream, do not buffer.** Return a `ReadableStream` or `StreamingResponse`. SSE and AI token streaming work on Node.js with no config. For long handlers send a heartbeat chunk, because HTTP/1.1 clients and proxies drop idle connections.
5. **Run post-response work with `waitUntil` or `after`.** `waitUntil` takes a promise, not a callback; passing a function does nothing and fails silently. Next.js: `after()` from `next/server`. Anything not wrapped is lost if the client disconnects and cancellation is on.
6. **Pin the region next to the database.** One region (`iad1` by default) beats global execution when every request queries Postgres. Hobby has a single region, Pro up to three.
7. **Cache with tags.** `getCache()` from `@vercel/functions` gives a per-region key-value cache with `ttl` and `tags`. `invalidateByTag` serves stale while refreshing; `dangerouslyDeleteByTag` blocks the next request, so avoid it on hot keys. Read `x-vercel-cache` (`HIT`, `MISS`, `STALE`, `PRERENDER`, `BYPASS`) before changing anything.
8. **Do not benchmark a preview.** Bytecode caching applies to production only.

## Quick reference

| Reason given for Edge | Answer |
|---|---|
| Streaming or SSE | Works on Node.js, zero config |
| Latency | Fluid pre-warms; DB round trips dominate |
| Auth, redirects, A/B tests | Routing Middleware (full Node.js), or `proxy.ts` in Next.js 16 |
| Cost | Same active-CPU pricing |
| Cold starts | Fluid reuses instances |

| Limit | Value |
|---|---|
| Body | 4.5 MB |
| Duration | 300 s default; Hobby max 300; Pro 800; beta 1800 |
| Memory | 2 GB / 1 vCPU; Pro can pick 4 GB / 2 vCPU in the dashboard, not in `vercel.json` |
| Bundle | 250 MB; Python 500 MB; beta 5 GB |
| SIGTERM cleanup | 500 ms |
| Python | 3.12, 3.13, 3.14 |

## Rationalizations

| Excuse | Instead |
|---|---|
| "Edge is faster" | Measure on Node.js with the region pinned first. |
| "It timed out, raise maxDuration to the max" | Find the slow call; if it is genuinely long, stream or move it to a workflow. |
| "Post it to a queue from the handler for a 200 ms task" | `waitUntil` is enough. |

## Verification

- [ ] No `runtime = 'edge'` left unless a tested reason is written down.
- [ ] `maxDuration`, region and payload path chosen from measurements.
- [ ] `waitUntil` receives a promise.
- [ ] Limits re-checked at https://vercel.com/docs/functions/limitations.

## Versions

- @vercel/functions 3.10.6 (verified 2026-11-05, https://registry.npmjs.org/@vercel/functions/latest)
- Node.js 24 LTS is the function default; Node.js 20 is deprecated from 2026-10-01 (verified 2026-11-05, https://vercel.com/docs/functions/runtimes/node-js)
