---
name: shipping-mobile-releases
description: Use when building, versioning, submitting or updating a mobile app with EAS, including TestFlight, Play internal testing, store listings, app review, EAS Update over-the-air updates, rollouts and rollbacks. Triggers on "ship the app", "submit to the store", "push an OTA update". Not for web deploys (stack-web:deploying-on-vercel) or the general release gate (ops-and-sre:releasing-safely).
---

# Shipping mobile releases

A store submission or a production over-the-air update is a production action. Build and test channels are free to use; submitting, releasing to the public and publishing to the production channel each need the owner's yes, every time, with the cost, the rollback and the evidence stated first.

## When to use

- Creating EAS build profiles, credentials, versions or channels.
- Cutting a TestFlight or Play internal build; preparing a store listing.
- Publishing, rolling out or rolling back an EAS Update.
- A rejected review, a mismatched runtime version, or a build number clash.

## When not to use

- Generic release discipline for services: `ops-and-sre:releasing-safely` (this skill follows its gate for mobile).
- Pipelines for unit tests: `stack-mobile:testing-mobile-apps`.
- Hosting the web app: `stack-web:deploying-on-vercel`.

## Procedure

1. **Read the policy.** Open `.claude/workbench.json` and the project's CLAUDE.md. Whatever they say, store submission and production OTA still need an explicit yes. **Done when:** you can say which actions you may do alone: local builds, `development` and `preview` builds, publishes to a `preview` branch.
2. **Run the checker.** `node scripts/check-release.mjs .` reads app config, `eas.json` and `package.json`, and flags a missing runtime version, missing production profile, version mismatches and `EXPO_PUBLIC_` names that look like secrets. Fix every error and read every warning. `npx expo-doctor` and `npx expo install --check` as well. **Done when:** zero errors from all three.
3. **Shape `eas.json`.** Profiles: `development` (`developmentClient: true`, `distribution: "internal"`), `preview` (`distribution: "internal"`, `channel: "preview"`), `production` (`channel: "production"`, store distribution, auto-increment). Set `cli.appVersionSource` to `"remote"` so EAS owns build numbers. Add `submit.production`. Template in `references/eas-config.md`.
4. **Version on purpose.** `version` is the human version in app config. Build number (iOS) and version code (Android) are managed by EAS with `autoIncrement`. Set `runtimeVersion` to `{ "policy": "fingerprint" }` by default: a new runtime appears whenever native code or config changes, so an OTA update can never reach an incompatible binary. `appVersion` is acceptable when the team reliably bumps the version on every native change. Never hand-write a fixed runtime string.
5. **Credentials.** `eas credentials` creates and stores signing keys and provisioning profiles; let EAS manage them. Back up the Android upload keystore reference and record where credentials live (never the files themselves) in the README. Account-level steps (Apple Developer, Play Console, App Store Connect API key) are owner-machine tasks: give exact commands as `! <command>`.
6. **Build.** `eas build --profile preview --platform all` for testers. For production run the gate (step 9) first, then `eas build --profile production`. **Done when:** the build id, status URL and version are printed, and the installed build shows the version and update channel in an About screen.
7. **Internal testing.** iOS: TestFlight internal testers via `eas submit --platform ios` (this uploads to App Store Connect; internal TestFlight does not need review but is still a submission, so ask). Android: Play internal testing track. Testers install, run the Maestro smoke flow and the device matrix from `testing-mobile-apps`. **Done when:** two testers confirm on real devices.
8. **Store listing checklist.** Work through `references/store-checklist.md`: name, subtitle, description, screenshots per required size, privacy policy URL, data safety and privacy nutrition labels, age rating, support URL, review notes with a demo account, permission strings that say why, account deletion path, export compliance. **Done when:** every row has a value or "not applicable".
9. **The gate for production.** Message the owner once with: what ships (version, build number, runtime), to which stores, cost, test evidence, the rollback plan (previous build stays available; OTA rollback command), the listing diff, and the exact command. Wait for an explicit yes naming the action. A yes for one release is not a yes for the next. **Done when:** the reply names the action.
10. **Submit and release.** `eas submit --platform ios|android --profile production --latest` (or the specific build id). Choose manual release after approval for iOS and a staged rollout on Play (start at 5 to 20 percent). Do not use `--auto-submit` on production builds unless the owner approved that pipeline in advance. Watch review status; reply to rejections with a fix, not an argument. Pitfalls in `references/store-checklist.md`.
11. **OTA updates.** What can go over the air: JavaScript, styles and bundled assets that run on the installed native code. What cannot: new or upgraded native modules, config plugin or permission changes, `scheme`, icons, splash, SDK upgrades, anything that changes the runtime version. Publish to `preview` first (`eas update --branch preview --message "..."`), verify on a device, then ask for the yes before `production`. Roll out gradually (`--rollout-percentage 10`), watch crash and error rates, then finish. Do not change the app's primary purpose or bypass store review with an update. Commands in `references/eas-update.md`.
12. **Roll back.** Know the command before publishing: `eas update:rollback` (to a previous update or to the embedded bundle), `eas update:revert-update-rollout` for a percentage rollout, or a new corrected update. A bad native build is rolled back by halting the staged rollout and shipping a fixed build; store binaries cannot be recalled. **Done when:** the rollback command is in the gate message.
13. **Report with evidence.** Build ids, submission ids, update group id, runtime version, the screen showing the new version on a device. Never write "released" without them. If the repo uses graphify, update the graph after the release (see `ops-and-sre:releasing-safely`).

## Quick reference

| Task | Command |
|---|---|
| Check readiness | `node scripts/check-release.mjs .` |
| Preview build | `eas build --profile preview --platform all` |
| Production build | `eas build --profile production --platform all` (after the gate) |
| Submit | `eas submit --platform ios --profile production --latest` |
| OTA to preview | `eas update --branch preview --message "..."` |
| Staged OTA | `eas update --branch production --rollout-percentage 10` |
| Finish or edit rollout | `eas update:edit` |
| Roll back | `eas update:rollback` |
| Credentials | `eas credentials` |
| Build number | `eas build:version:get` |

## EAS cost notes

Free plan: up to 15 Android and 15 iOS builds per month, low queue priority, 1,000 update MAUs, no overage. Starter is $19 per month plus usage with a $45 build credit; Production is $199 per month with a $225 credit and 50,000 update MAUs. Beyond credit, a medium build is about $1 (Android) or $2 (iOS). Apple Developer Program and Google Play registration are separate yearly or one-time fees. State the expected cost in the gate message. Local builds (`eas build --local`) avoid build charges.

## Rationalizations

| Excuse | Do instead |
|---|---|
| "It is only a JS change, push it to production." | Preview first, then ask for the yes; use a staged rollout. |
| "Native change, but OTA is faster." | A new runtime needs a new build. The fingerprint policy blocks the mismatch. |
| "Auto-submit saves a step." | Submission is an owner decision. |
| "Reviewers will not notice." | Give review notes, a demo login and honest permission text. |
| "Tests passed last week." | Gate on the exact commit and build being shipped. |

## Verification

- `check-release.mjs` reports zero errors; `expo-doctor` clean.
- Runtime version policy set; channels map to branches as written down.
- Owner's yes recorded for each store submission and production OTA.
- Build, submission and update ids printed; version confirmed on a device.
- Rollback command ready; staged rollout used; monitoring watched after release.

## References

| File | Load when |
|---|---|
| references/eas-config.md | writing eas.json, app config, workflows for builds |
| references/eas-update.md | publishing, rolling out or rolling back OTA updates; OTA limits |
| references/store-checklist.md | preparing listings, answering review, avoiding rejections |

## Versions

- eas-cli 27.4.1; staged rollout flags need 24.9.0 or newer (verified 2026-11-05, https://docs.expo.dev/eas-update/rollouts/)
- expo-updates 58.0.21 (verified 2026-11-05, https://docs.expo.dev/versions/latest/sdk/updates/)
- expo-dev-client 58.0.18 (verified 2026-11-05, https://docs.expo.dev/versions/latest/sdk/dev-client/)
- @expo/fingerprint 0.21.9 (verified 2026-11-05, https://docs.expo.dev/eas-update/runtime-versions/)
- EAS plans and prices as listed above (verified 2026-11-05, https://expo.dev/pricing)
- EAS Submit reference (verified 2026-11-05, https://docs.expo.dev/submit/introduction/)
