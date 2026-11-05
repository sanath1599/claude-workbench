# CI and monitoring

## EAS Workflows (E2E with builds)

Docs: https://docs.expo.dev/eas/workflows/examples/e2e-tests/

`eas.json` profile for test binaries (no signing needed):

```json
{ "build": { "e2e-test": { "withoutCredentials": true, "ios": { "simulator": true }, "android": { "buildType": "apk" } } } }
```

`.eas/workflows/e2e-android.yml`:

```yaml
name: e2e-android
on:
  pull_request:
    branches: ['*']
jobs:
  build:
    type: build
    params:
      platform: android
      profile: e2e-test
  maestro:
    needs: [build]
    type: maestro
    params:
      build_id: ${{ needs.build.outputs.build_id }}
      flow_path: ['.maestro/smoke.yaml']
```

Run by hand with `eas workflow:run .eas/workflows/e2e-android.yml`. Builds use EAS credits on paid plans and the free-tier build allowance otherwise; trigger on pull requests only when the allowance covers it, or use a nightly schedule or a label.

## GitHub Actions (fast checks)

```yaml
name: ci
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint --if-present
      - run: npx jest --ci
      - run: npx expo-doctor
```

Pin action versions to the current stable majors at write time. On release branches add a step that runs `node scripts/check-release.mjs .` from `stack-mobile:shipping-mobile-releases` (copy the script into the repo's `scripts/` folder for CI).

## Device matrix template

| Slot | Device | When |
|---|---|---|
| iOS current | newest simulator + one physical iPhone | every release |
| iOS floor | oldest supported simulator | release |
| Android current | newest emulator | every release |
| Android floor | oldest supported emulator | release |
| Low-end Android | physical, 3 GB RAM or less | release |
| Tablet / small phone | one each if supported | release |

## Error monitoring

| Option | Notes |
|---|---|
| GlitchTip | Open source, Sentry-SDK compatible, light to self-host. Confirm current license, version and source-map support on glitchtip.com. |
| Sentry self-hosted | Source-available license, many containers; richest features. |
| Sentry cloud | Managed; free tier exists; paid beyond it. Owner's yes to create an account. |

Setup: `npx expo install @sentry/react-native`, add its config plugin for source map upload, `Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN, release, dist, beforeSend: scrub })`. The auth token for source map upload is a secret: keep it in EAS secrets or CI secrets, never behind `EXPO_PUBLIC_`. Wrap the root with `Sentry.wrap`. Scrub emails, tokens and request bodies in `beforeSend`. Verify with a deliberate test error from a release build and confirm the event and a symbolicated stack arrive.
