# Maestro

Docs: https://docs.maestro.dev/ . The CLI is open source (github.com/mobile-dev-inc/maestro); the hosted cloud product is paid and optional. Run locally or on EAS Workflows for free of that.

## Layout

```
.maestro/
  config.yaml          optional: flows to include, tags
  helpers/sign-in.yaml
  smoke.yaml
  create-item.yaml
```

## Smoke flow

```yaml
# .maestro/smoke.yaml
appId: com.yourcompany.example
tags: [smoke]
---
- launchApp:
    clearState: true
- runFlow: helpers/sign-in.yaml
- assertVisible: "Items"
- takeScreenshot: 01-home
- tapOn:
    id: "add-item"
- inputText: "First item"
- tapOn: "Save"
- assertVisible: "First item"
- takeScreenshot: 02-created
```

```yaml
# .maestro/helpers/sign-in.yaml
appId: com.yourcompany.example
---
- tapOn:
    id: "email-input"
- inputText: ${MAESTRO_TEST_EMAIL}
- tapOn:
    id: "password-input"
- inputText: ${MAESTRO_TEST_PASSWORD}
- tapOn: "Sign in"
- extendedWaitUntil:
    visible: "Items"
    timeout: 15000
```

Pass credentials with `maestro test -e MAESTRO_TEST_EMAIL=... -e MAESTRO_TEST_PASSWORD=...` from CI secrets, for a staging test account only. Never commit them.

## Rules

- Prefer visible text or `id` (the `testID` prop). Avoid coordinates and indexes.
- Wait on conditions with `assertVisible` or `extendedWaitUntil`, never fixed sleeps.
- Reset state with `clearState`, and seed data through the staging API in a setup step.
- Run on a development or preview build of the app (`preview` profile, or an `e2e-test` profile that builds a simulator/emulator binary).
- Dark mode and font scale: set on the device or simulator before the flow, or use separate flows tagged `dark` and `large-text`.
- Run `maestro test --include-tags smoke .maestro/` for the quick set.

## Detox comparison

| | Maestro | Detox |
|---|---|---|
| Flow language | YAML | JavaScript |
| Setup | CLI, no native integration | native build changes, test runner config |
| Sync | polls UI with waits | gray-box, tracks app idle |
| Black-box (any app) | yes | needs app instrumentation |
| Pick when | default | you need tight app-state control and accept the setup |
