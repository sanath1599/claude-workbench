---
name: deploying-to-azure
description: Use when deploying or changing anything in Azure with the az CLI: Functions, Logic Apps, App Service, Application Insights, role assignments, or a VNet-restricted resource, including a 403 on a write. Not for a VPS (deploying-to-a-vps), Vercel (stack-web:deploying-on-vercel) or the approval gate itself (releasing-safely).
---

# Deploying to Azure

A laptop's default subscription is whatever it was last, a missing role is not a bug, and "deployment succeeded" proves nothing. Name the target on every command, stop at permission walls, and read back what you shipped.

## When to use

- Publishing a Function app or Logic App, changing app settings, workflows or role assignments.
- A resource sits behind a VNet or has public access disabled.
- An `az` write returns 403 or "authorization failed".
- Setting up identity between an app and Azure resources.

## When not to use

- The production approval gate, backups and rollback: `releasing-safely` (this skill adds the Azure mechanics).
- A VPS: `deploying-to-a-vps`. Vercel: `stack-web:deploying-on-vercel`.
- Alerts, workbooks and event design: `instrumenting-services`, `defining-slos-and-alerts`.

## Procedure

1. **Pin the target.** Every `az` command carries `--subscription <name>` and `--resource-group`. Run `az account show` at session start and say which environment you are in. Helper scripts take the subscription as a required argument and print it before acting. Pass the `releasing-safely` gate before any production change. **Done when:** no command in your plan relies on the default subscription.
2. **Roll out dev, then staging, then production.** Same artifact each time; write down which flags and settings each environment has. **Done when:** the artifact passed the previous environment.
3. **Back up before overwriting.** Export the workflow definition, auth config or app-settings block to `backups/<date>-<change>/<name>.before.json` first. Create the new version under a throwaway name, run it once, then promote. Disable what you replace rather than deleting it. **Done when:** the backup file exists and is non-empty.
4. **Deploy the artifact.** See `references/functions.md` for the prebuilt zip, the extension bundle and the 415 case. Prefer managed identity (see Identity below). **Done when:** the deployment command returned and you have its id.
5. **Read back.** Do not trust "deployment succeeded". List the registered functions and confirm every expected one is present with no error state, call the health route, and fetch the deployed definition or settings to compare version or hash. **Done when:** you can print the function list, the health response and the compared hash.
6. **Log the change.** One entry in `docs/deployment.md` (see `writing-runbooks` step 7): what changed, setting names (never values), deployment id, verification, exact rollback. **Done when:** the entry is in the same commit.

## Permissions: stop and ask

A 403 on a write is usually a missing or inactive role, not a bug. Privileged roles are time-boxed (PIM elevations expire). Do not look for a way around it: no borrowed credentials, no portal clicks by proxy, no alternate scope.

1. Stop and tell the owner the exact permission and the scope it is needed at.
2. Ask them to activate the role, batching every write you need into one window, then retry.
3. If it cannot happen now, add a row to `docs/skipped-features.md` (feature, exact error, permission and scope, who approves, the flag that turns it on) and ship the rest behind that flag.

## Network-restricted resources

When public access is off, manage the resource through its ARM management path (for Logic Apps Standard, the `hostruntime` admin proxy) rather than the SCM site. If an IP rule is unavoidable:

1. Save the current rules to a dated backup.
2. Get the owner's explicit yes.
3. Add your IP, do the one operation, remove the rule.
4. Re-list the rules and show they match the backup.
5. Record all of it in the deployment log.

**Done when:** the final rule list equals the backup.

## Identity

Give each environment its own identity; a shared one lets dev code touch production. Prefer managed identity to keys. In code use `DefaultAzureCredential`: it picks the managed identity in Azure (`AZURE_CLIENT_ID` for a user-assigned one) and the developer's `az login` locally. Do not shell out to `az` and cache tokens by hand. Managed identity does not exist on Vercel; use workload identity federation there. Grant the narrowest reader role per resource (for example Monitoring Reader on each Application Insights component) and verify the grant by calling the API: calendar or mailbox access may be granted in Exchange and not appear as an Azure role. Check outbound egress from the host: a hub firewall can reset TLS to the monitor and Application Insights APIs.

## Quick reference

| Symptom | Likely cause |
|---|---|
| Queue or timer functions show errored, HTTP 404 | `extensionBundle` missing in `host.json` |
| Remote build fails inside a VNet | Cannot reach the package index or build CDN; ship a prebuilt zip |
| `az functionapp deploy` answers 415 on Flex Consumption | Use the Kudu `/api/publish` endpoint |
| Event counts too low | Application Insights sampling on |
| Write 403 | Role not active or not granted at that scope |
| Wrong environment changed | A command ran without `--subscription` |

## Verification

- [ ] Every command named its subscription; production steps had a yes.
- [ ] Backups taken; the new definition was tested under a throwaway name first.
- [ ] Function list, health response and read-back hash shown.
- [ ] No permission wall was worked around; blocked items are in `docs/skipped-features.md`.
- [ ] Any temporary IP rule was removed and the list matches the backup.
- [ ] Deployment log entry written; no secret values in it.

## Versions

- @azure/identity 4.14.1 (verified 2026-11-05, https://www.npmjs.com/package/@azure/identity)
- azure-identity 1.27.0 (verified 2026-11-05, https://pypi.org/project/azure-identity/)

Read the current Azure Functions and az CLI docs at https://learn.microsoft.com/azure/azure-functions/ before relying on a flag or endpoint.

## References

| File | Load when |
|---|---|
| references/functions.md | publishing a Functions app, especially behind a VNet |
