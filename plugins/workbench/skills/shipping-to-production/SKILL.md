---
name: shipping-to-production
description: Use when about to deploy to production or staging, run a migration against a shared or production database, change DNS or domains, provision anything that may cost money, send real email or SMS, or change cloud configuration, or when a hook asked for confirmation on one of these. Not for the full release procedure (expand/contract, rollback, CI), which is ops-and-sre:releasing-safely.
---

# Shipping to production

Code changes are pre-approved. Production, infrastructure and anything that reaches real people are not: each needs the owner's yes, every time, unless the project's `.claude/workbench.json` says `"productionDeploys": "auto-on-main"` (deploys only; migrations, DNS, paid resources and real sends still ask). The guard hook asks for these commands. This skill makes the ask worth a quick yes, and makes "done" provable.

## When to use
- `vercel --prod`, `lk agent deploy`, VPS restarts, `az ... deploy`, a Temporal namespace or worker change in production.
- Migrations against Neon or any shared database, DNS records, a new paid resource, a real email.

## When not to use
- Preview deploys and local work: just do them.
- Designing the release (migrations, flags, rollback): ops-and-sre:releasing-safely.

## Procedure

1. **Pre-flight**, before you ask:
   - Pushed? The deploy should build from a pushed commit.
   - Anything running? Check for in-progress builds, jobs or user sessions (the owner once said not to deploy while builds were running).
   - Cost: state it ("free tier", "about $X a month", "billed per use"). Prefer free tiers.
   - Backup: export any cloud config or data you will overwrite, and save it under `backups/<date>/`.
   - Order: dev, then staging, then prod, when those environments exist.
   **Done when:** you can fill in the ask below.

2. **Ask once**, in this shape:
   > Deploy `<what>` to `<where>`. Changes: `<one line>`. Cost: `<…>`. Risk: `<…>`. Undo: `<exact rollback>`. OK?
   Put cost, scale and reversibility in the ask itself. If the safety classifier blocks a step that needs the owner's credentials, write it as a script that never prints secrets and give them `! bash scripts/<step>.sh`.

3. **Execute** exactly what was approved. Nothing extra rides along.

4. **Prove it.** Confirm the new version is serving (a version endpoint, a build id, a page marker) before any request with side effects. A domain can serve the old deployment for a short while. Then smoke-test without side effects: no real emails, proposals, payments or writes to real users' data. Use the designated test accounts.
   **Done when:** you have evidence (URL plus marker plus logs, run id, or command output).

5. **Report** in three lines: what shipped, the evidence, and any owner follow-ups.

## Rationalizations

| Excuse | Instead |
|---|---|
| "They approved the last deploy." | Approval covers that action only. Ask again. |
| "It's a tiny change; I'll ship it with the other one." | Ship only what was approved. |
| "The CLI said success, so it's live." | Check the marker on the live URL. |
| "Testing prod needs a real email." | Use the test recipients (`delivered@resend.dev`) or test accounts. |

## Verification
- [ ] The yes covered this exact action.
- [ ] A backup exists for anything overwritten.
- [ ] Evidence of the live version was shown, and the smoke test had no side effects.
