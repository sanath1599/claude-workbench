---
name: protecting-and-promoting-on-vercel
description: Use when abusive traffic, bots or scraping hit a Vercel app, an API needs rate limiting, a protected preview must be called from a script or browser tool, or a build should go live gradually, be promoted without rebuilding, or rolled back. Not for first deploys and env vars, which is deploying-on-vercel, nor for the generic release gate, which is releasing-safely.
---

# Protecting and promoting on Vercel

Block bad traffic with the firewall before it costs money, and move good builds to production by re-pointing an alias rather than rebuilding. Every production-affecting command here still needs the owner's yes.

## When to use

- A form, login or API route is being hammered or scraped.
- "Add rate limiting", "block this IP range", "turn on attack mode".
- `curl` against a preview returns the Vercel login page.
- "Promote this preview", "roll back", "ship to 10% first".

## When not to use

- Deploy mechanics and env vars: `stack-web:deploying-on-vercel`.
- Release approvals and migration order: `ops-and-sre:releasing-safely`.
- Cloudflare's own WAF or Turnstile: `stack-web:using-cloudflare-beyond-dns`.

## Procedure

1. **Check the link first.** Run `vercel project inspect --non-interactive` in the intended directory and confirm project and team. A wrong link changes the wrong project's firewall.
   **Done when:** the printed project matches the one the owner named.
2. **Review current state.** `vercel firewall overview --json` shows rules, IP blocks, bypasses and unpublished drafts. DDoS mitigation is on for every plan and blocked traffic is not billed.
3. **Stage rate limits in log mode.** Add a rule with `--action rate_limit --rate-limit-action log`, a window of 10 to 3600 s and a limit 5 to 10 times the legitimate rate, scoped by method as well as path. Counters are per region, so effective limits can be several times higher. Watch hits, then switch the rule to `deny` or `challenge`.
   - Agents must use the flag or `--json` forms of `rules add`; the AI and wizard forms need a terminal.
   - Rule and IP-block changes are drafts until `vercel firewall publish --yes`; review `vercel firewall diff` first. Attack mode, system bypass and mitigations apply immediately.
   - `edit --condition` replaces every condition on the rule; restate all of them.
4. **Use Attack Mode only during an attack,** with a duration (`--duration 1h`) so it expires. Ask first; it challenges real visitors too.
5. **Bots on forms.** Vercel BotID adds invisible verification to chosen routes; Turnstile is the Cloudflare alternative. Verify on the server, never only in the client.
6. **Reach a protected deployment.** Use `vercel curl <url>` (it carries your Vercel auth). For a browser tool, send the header `x-vercel-trusted-oidc-idp-token` with the token from `vercel env run`. Do not disable Deployment Protection, and never print the token. A 401 after protection is passed belongs to the app.
7. **Promote without rebuilding.** `vercel deploy --prod --skip-domain` builds production without switching traffic; check it with `vercel curl`; `vercel promote <url>` makes it live; `vercel rollback` returns to the previous production deployment. Database migrations are not rolled back.
8. **Roll out gradually when the change is risky.** `vercel rr configure --enable --advancement-type=automatic --stage=10,5m --stage=50,10m`, then `vercel rr start --dpl=<url> --yes`, `vercel rr fetch` to see status (there is no `status` subcommand), and `vercel rr abort` or `complete`.
   **Done when:** `vercel rr fetch` or the live version marker shows the intended state.

## Quick reference

| Goal | Command |
|---|---|
| See state | `vercel firewall overview --json` |
| Publish drafts | `vercel firewall publish --yes` |
| Block IP | `vercel firewall ip-blocks block <ip> --yes` then publish |
| Emergency | `vercel firewall attack-mode enable --duration 1h --yes` |
| Call protected URL | `vercel curl <url>` |
| Go live | `vercel promote <url>` |
| Undo | `vercel rollback` |

## Rationalizations

| Excuse | Instead |
|---|---|
| "Turn protection off so the test passes" | Use `vercel curl` or the OIDC header. |
| "Set the limit to 100 and enforce" | Log first, tune, then enforce. |
| "Rebuild for production, it is the same code" | Promote the verified deployment. |

## Verification

- [ ] Linked project confirmed before any change.
- [ ] Draft rules reviewed with `diff`, published, and the owner told.
- [ ] Promoted or rolled-out build shows the expected version marker.
- [ ] No token or secret printed.

## Versions

- vercel 65.11.0 CLI (verified 2026-11-05, https://registry.npmjs.org/vercel/latest)
- botid 1.5.12 (verified 2026-11-05, https://registry.npmjs.org/botid/latest)
