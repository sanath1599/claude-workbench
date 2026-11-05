---
name: adding-subdomains
description: Use when an app needs a name under the owner's domain, a custom domain on a Vercel project, a DNS record, a certificate problem, or Resend sending-domain records. Not for Vercel build and env work, which is deploying-on-vercel, nor for the VPS server itself, which is ops-and-sre:deploying-to-a-vps.
---

# Adding subdomains

Every app lives at `<name>.{{wb.domain}}` with DNS on {{wb.dns_provider}}. The record's target comes from Vercel for that project, never from memory. DNS changes need the owner's yes, and the first run is always a dry run.

## When to use

- "Put this on a subdomain", "use app.<domain>", "the cert is not issuing".
- Adding the DNS records Resend asks for on a sending domain.

## When not to use

- Deploy or env problems: `stack-web:deploying-on-vercel`.
- Setting up nginx and certbot on the server: `ops-and-sre:deploying-to-a-vps` (this skill only covers the DNS record).
- Explaining what a CNAME is: just answer.

## Procedure

1. **Pick the name.** Short, lowercase, one label (`status`) or two for a client-scoped app (`careers.acme`). Read `references/subdomains.md` for names already taken.
2. **Check for collisions.** Run `dig +short CNAME <fqdn>`, `dig +short A <fqdn>` and `node scripts/cf-dns.mjs list {{wb.domain}} <name>`. If anything resolves, stop and ask whether to replace it.
   **Done when:** both lookups are empty, or the owner chose to replace.
3. **Add to Vercel** (Vercel targets). `vercel domains add <fqdn> <project> --yes </dev/null` (with `VERCEL_TOKEN`, see `stack-web:deploying-on-vercel`). Then read the exact record: `vercel domains verify <fqdn> --project <project> </dev/null`, or Project Settings, Domains. The CNAME target is project-specific (it looks like `<hash>.vercel-dns-0NN.com`). Never hardcode it, never reuse another project's target. If Vercel says the domain belongs to another account, it asks for a TXT record at `_vercel.<apex>`; add that as a separate record the same way.
4. **Dry run the record.** `node scripts/cf-dns.mjs upsert <fqdn> CNAME <target>`. It prints what would change and writes nothing. Records for Vercel are **DNS-only** (not proxied): Vercel recommends direct connection, and a proxy needs Full (strict) SSL, an open ACME path and no caching of `/.well-known/vercel/*`. Pass `--proxied` only if the owner asks for it.
5. **Ask the owner.** Show the dry-run output (name, type, target, DNS-only) and wait for a yes.
6. **Apply.** `node scripts/cf-dns.mjs upsert <fqdn> CNAME <target> --apply`. The script needs `CF_API_TOKEN` in the environment (zone-scoped "Edit zone DNS" token; add Zone Read, or set `CF_ZONE_ID`, for lookup). It never prints the token. If the token is missing, give the owner the one-line export to run and do not ask for the value in chat.
7. **Verify.** Re-run `vercel domains verify`, then `dig +short <fqdn>` and `curl -sI https://<fqdn>`. The certificate issues automatically after verification (`vercel certs ls`); allow a few minutes. Confirm the response carries the new version marker.
   **Done when:** HTTPS answers 200 or the expected redirect from the right deployment.
8. **Canonical host (optional).** Once the custom domain works, redirect page requests that arrive on the platform host to it. In `proxy.ts`: only when `VERCEL_ENV === "production"` and `APP_URL` is set, only when the host ends in `.vercel.app`, answer 308 keeping path and query. Exclude `api/`, `_next/` and file extensions in `config.matcher`, so workers, webhooks and cron keep working on the old host. Set `APP_URL` in the worker's secrets too.
9. **Record it.** Add a row to `references/subdomains.md` (name, host, target type; no IPs, no secrets).

### VPS variant

Create an A record to the VPS (look the address up from `{{wb.vps_hosts}}` or the server, do not store it in the registry) with `upsert <fqdn> A <ip>`, same dry-run and approval flow. On the server: an nginx server block proxying a localhost port (nginx, not Caddy), then `certbot --nginx -d <fqdn>`. Certbot's HTTP challenge needs the record DNS-only or the proxy configured to pass `/.well-known/acme-challenge/`. Server steps belong to `ops-and-sre:deploying-to-a-vps`.

### Resend sending-domain records

Resend issues SPF, DKIM and return-path records per sending domain. Create each as DNS-only (mail records cannot be proxied). `cf-dns.mjs` handles CNAME and A; for TXT and MX use the Cloudflare dashboard or the Resend MCP. Same owner gate applies.

## Quick reference

| Case | Record |
|---|---|
| Vercel subdomain | CNAME, DNS-only, project-specific target from Vercel |
| VPS app | A to the VPS, nginx + certbot |
| Apex on Vercel | A or ALIAS-style value from Vercel, not a hand-typed address |
| Email auth | per-domain from Resend, DNS-only |

| Script command | Does |
|---|---|
| `zone <domain>` | print zone id |
| `list <domain> [name]` | show records |
| `upsert <fqdn> CNAME\|A <target> [--proxied] [--apply]` | dry run unless `--apply` |

## Rationalizations

| Excuse | Instead |
|---|---|
| "The target is the same as last time" | Targets are per project. Read it from Vercel. |
| "Proxy it for DDoS protection" | DNS-only unless the owner asks; proxying breaks cert issuance and caching rules. |
| "It is only DNS" | DNS can take down a live site. Dry run, then ask. |

## Verification

- `dig` showed no collision before the change.
- Dry run output was shown and approved before `--apply`.
- Token never appeared in output or files.
- Registry updated; HTTPS verified on the live host.

## References

| File | Load when |
|---|---|
| references/subdomains.md | picking a name or recording a new one |

## Versions

- Cloudflare DNS records API v4 (verified 2026-11-05, https://developers.cloudflare.com/api/resources/dns/subresources/records/methods/create/)
- Vercel domains and DNS (verified 2026-11-05, https://vercel.com/docs/domains/set-up-custom-domain)
- Vercel proxy guidance (verified 2026-11-05, https://vercel.com/kb/guide/can-i-use-a-proxy-on-top-of-my-vercel-deployment)
