---
name: using-cloudflare-beyond-dns
description: Use when the owner asks for a Cloudflare Worker, R2 bucket, Turnstile on a form, a Tunnel to a server, Wrangler commands, or an API token with the right scope. Not for subdomain DNS records pointing at Vercel or the VPS, which is adding-subdomains, nor for app hosting by default, which is deploying-on-vercel.
---

# Using Cloudflare beyond DNS

Cloudflare is the DNS provider and stays DNS-only for Vercel hosts. Reach for its other products only where Vercel has no good answer: cheap object storage, bot checks, a tunnel to the owner's server, small edge handlers.

## When to use

- "Put the files in R2", "add Turnstile to the signup form", "expose the VPS service without opening ports".
- Writing or deploying a Worker, or running `wrangler`.
- Creating a Cloudflare API token or choosing the Cloudflare MCP server.

## When not to use

- A CNAME or A record for an app: `stack-web:adding-subdomains` (it owns the cf-dns script).
- Hosting a TanStack or Next.js app: Vercel first, `stack-web:deploying-on-vercel`.
- Vercel's own firewall: `stack-web:protecting-and-promoting-on-vercel`.

## Procedure

1. **Confirm Cloudflare is the right place.** Default to Vercel for apps and Vercel Blob for files. Use Cloudflare when: egress-heavy storage (R2 has no egress fee), a Turnstile widget, Tunnel for a server behind NAT, or a Worker that must run next to Cloudflare services. State the cost and get a yes before creating any paid resource.
   **Done when:** the reason Vercel does not fit is one sentence.
2. **Scope tokens narrowly.** Create custom tokens in the dashboard, one per job, limited to one zone or account: DNS edit for records, Account Turnstile Edit for widgets, Workers and R2 edit for deploys. Keep the token in an environment variable or a user-only file; never paste it in chat or pass it as a command argument. Check it with `GET /user/tokens/verify`.
3. **Workers.** Prefer a Workers project with static assets for new sites that must live on Cloudflare; Pages is legacy. Use `wrangler.jsonc`, set `compatibility_date` to today for new Workers, enable observability, and generate binding types with `wrangler types` rather than hand-writing `Env`.
4. **Wrangler safety.** Use the project's local Wrangler through a package script. Know whether a command targets local or remote data. `wrangler secret put` deploys immediately; use `wrangler versions secret` to stage. Dashboard edits get overwritten by the next deploy, so reconcile config first. A rollback restores code only, not data in bound resources. Run `wrangler deploy --dry-run` before the real deploy and ask before deploying.
5. **Worker code rules.** Stream large bodies instead of `await response.text()`. Attach background promises to `ctx.waitUntil(...)` and call it as a method, never destructured. No module-level mutable request state. Use `crypto.randomUUID()` for tokens, not `Math.random()`. Compare secrets with a constant-time check. Do not call the REST API for something a binding does.
6. **R2.** Access it from a Worker binding, or from other code through the S3-compatible endpoint with an R2 token. Keep user files private and sign short-lived URLs.
7. **Turnstile.** Create the widget with the sitekey for each hostname you serve (include `localhost` for development), render it client-side, and validate the token on the server through Siteverify; require `success` and the expected action, and treat a missing token as failure. Never trust the client alone.
8. **Tunnel.** `cloudflared` publishes a service on the VPS at a hostname without an open inbound port. Put the hostname behind Cloudflare Access if it is not public. Coordinate with `ops-and-sre:deploying-to-a-vps`, which defaults to nginx and certbot.
9. **MCP.** The Cloudflare API server (`https://mcp.cloudflare.com/mcp`) can reach the whole API with OAuth or a scoped token; the docs server (`https://docs.mcp.cloudflare.com/mcp`) needs no account. Prefer a scoped `curl` or script for DNS changes because it is auditable.

## Quick reference

| Need | Product |
|---|---|
| Objects, no egress fee | R2 |
| Small stateless handler | Workers |
| Per-room or per-entity coordination | Durable Objects |
| Bot check on a form | Turnstile |
| Reach a server behind NAT | Tunnel |
| Internal app login | Access |

## Verification

- [ ] Token scope matches one job and is not printed anywhere.
- [ ] `wrangler deploy --dry-run` passed before any deploy; the owner approved the deploy.
- [ ] Turnstile validated server-side with a failing and a passing token.
- [ ] Cost stated for each new resource.

## Versions

- wrangler 4.157.0 (verified 2026-11-05, https://registry.npmjs.org/wrangler/latest)
- Read the current docs at https://developers.cloudflare.com/workers/ before using a Workers API.
