# EAS Update (OTA)

Docs: https://docs.expo.dev/eas-update/introduction/ , https://docs.expo.dev/eas-update/rollouts/ , https://docs.expo.dev/eas-update/rollbacks/

## Model

Build profile -> **channel** -> **branch** -> updates. An installed build asks its channel for the newest compatible update on the linked branch. Compatibility is decided by the runtime version. A channel normally points at a branch of the same name (`preview`, `production`).

## Can and cannot go over the air

| Can | Cannot (needs a new build and store release) |
|---|---|
| JavaScript and TypeScript logic | New or upgraded native modules, SDK upgrades |
| Styles, copy, layouts | Config plugin, permission or entitlement changes |
| Bundled images, fonts that are already loaded by JS assets | `scheme`, bundle id, icon, splash, app name |
| Bug fixes that run on current native code | Anything that changes the fingerprint |

If unsure, compute the fingerprint of the working tree and compare with the build's runtime version. A different value means a new build.

Policy: an update must keep the app's described purpose and must not bypass review. Check the current Apple and Google policy text before a large change in behaviour.

## Publish

```bash
# preview first: allowed without asking
eas update --branch preview --message "Fix list refresh"

# production: needs the owner's yes for this specific update
eas update --branch production --message "Fix list refresh" --rollout-percentage 10
```

Print the update group id and the dashboard URL as evidence. Verify on a device by restarting the app twice (the first launch downloads, the second runs it) and reading the update id on the About screen.

## Rollout

| Step | Command |
|---|---|
| Start at 10 percent | `eas update --branch production --rollout-percentage 10` |
| Change percentage or finish at 100 | `eas update:edit` |
| Abort and restore the control update | `eas update:revert-update-rollout` |
| Replace an active rollout | add `--force-end-active-rollout` (EAS CLI 24.9.0 or newer) |
| Branch-level rollout between two branches | `eas channel:rollout` |

Constraints: one active per-update rollout per branch, platform and runtime version; one branch rollout per channel at a time; `eas update --channel` cannot be used during a branch rollout, use `--branch`.

Watch the error monitor for 30 to 60 minutes at each step; widen only when error rate and crash-free sessions are flat.

## Roll back

`eas update:rollback` opens a guide: roll back to a previously published update, or to the embedded bundle in the installed binary. After a rollback, the next published update goes to everyone again. Rollback is also an update: after it, confirm on a device.

## Code signing and safety

Enable code signing for updates if the app handles sensitive data, so a compromised dashboard or token cannot push code. `EXPO_TOKEN` lives only in CI secrets; limit who can publish to `production`.

## Free and paid

Updates count by monthly active updated users. The Free plan includes 1,000 and has no overage; paid plans include more and charge per extra MAU. See the plan numbers in the SKILL.md cost note and confirm at https://expo.dev/pricing.
