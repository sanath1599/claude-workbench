---
name: testing-mobile-apps
description: Use when writing or running tests for an Expo or React Native app, setting up Jest or React Native Testing Library, adding end-to-end flows with Maestro or Detox, choosing a device matrix, capturing screenshots for review, wiring mobile CI, or adding crash and error monitoring. Not for choosing web test layers (engineering-craft:planning-tests) or release gates (shipping-mobile-releases).
---

# Testing mobile apps

Test at the cheapest layer that would catch the failure: pure logic in unit tests, screens in component tests, one real-device smoke flow in Maestro. Tests never call real LLM, push, email or identity providers.

## When to use

- A new Expo app needs a test setup.
- Writing a component test, or an E2E flow for sign-in or the main task.
- Choosing which devices and OS versions to cover, or collecting screenshots for review.
- Mobile CI is red, flaky or missing; adding crash reporting.

## When not to use

- Deciding layers and mocking policy in general: `engineering-craft:planning-tests` (this skill applies it to mobile).
- Walking the product as a user: `engineering-craft:running-qa-passes`.
- Gating a store or OTA release: `stack-mobile:shipping-mobile-releases`.

## Procedure

1. **Place each behaviour at a layer.** Pure functions, Zod schemas, query-key builders and the API client: Jest. A screen with states: React Native Testing Library. A multi-screen flow on a real build: Maestro. Native-only behaviour (permissions, deep links, push taps): Maestro on a device or emulator, or a manual checklist when it cannot be automated. **Done when:** the plan lists each behaviour with its layer, following `engineering-craft:planning-tests`.
2. **Set up Jest.** `npx expo install jest-expo jest @types/jest --dev`, set `"jest": { "preset": "jest-expo" }` in `package.json`, add `"jest"` to `tsconfig` types. SDK 58 needs Jest 30. Install `@testing-library/react-native` (v14 or newer for Expo Router); `render` is async in v14, so `await render(...)`. Do not use the deprecated `react-test-renderer`.
   **Done when:** `npx jest` runs a trivial test green.
3. **Write component tests like a user.** Query by role, label or text, fire events with `userEvent`, assert on what is visible. Cover loading, empty, error and success for each data view by mocking the API client at the network boundary (MSW or a fake fetch), not the hook. Wrap with a fresh `QueryClient` per test and `retry: false`. Mock native modules (`expo-secure-store`, `expo-notifications`) in one setup file. Test Expo Router screens with `expo-router/testing-library`. Details and a template in `references/jest-and-rtl.md`.
4. **Add Maestro flows.** Install the CLI (`curl -fsSL "https://get.maestro.mobile.dev" | bash`, see the docs for your platform), keep flows in `.maestro/` next to `eas.json`, and set `testID` on elements that have no stable text. One flow per user journey, short, with `launchApp` clearing state, explicit `assertVisible` checks, `takeScreenshot` at each state, and a `runFlow` helper for sign-in. Run locally with `maestro test .maestro/` against an emulator, simulator or device with a development or preview build. Flow templates in `references/maestro.md`.
5. **Detox only when Maestro cannot.** Detox is gray-box (it synchronises with the app) and fits teams already writing JavaScript E2E with fine control, at the price of heavy native setup and build coupling. Choose it for a specific need, say which, and record it in the README.
6. **Pick a device matrix.** Minimum: the newest iOS on a current iPhone simulator plus one physical iPhone; the newest Android and the oldest supported Android on emulators plus one low-memory physical device. Add one small phone and one tablet if the app supports them. Run the full matrix before a store release and the smoke flow on one iOS and one Android device per pull request. The supported floors come from the Expo SDK page.
7. **Capture screenshots for review.** Maestro `takeScreenshot` for each state and each theme (set the theme with a flow parameter or a launch argument). Store them as CI artifacts, not in git, and attach the set to the pull request. **Done when:** a reviewer can see loading, empty, error, populated, dark and large-text without running the app.
8. **CI.** Two good fits. EAS Workflows: a `.eas/workflows/*.yml` file with a `build` job (an `e2e-test` profile that builds a simulator `.app` or Android `.apk` without credentials) followed by a `maestro` job. Or GitHub Actions: lint, `tsc --noEmit`, `npx jest`, `npx expo-doctor` on every push, and the build plus Maestro job on pull requests or a nightly schedule. Cache dependencies, pin the Node version, and keep secrets in the CI store. Templates in `references/ci-and-monitoring.md`. Starting an EAS build costs credits on paid plans: say so before enabling it per pull request.
9. **Monitoring.** Add crash and error reporting before the first beta. Open-source first: GlitchTip is a lightweight, Sentry-SDK-compatible server you can self-host; self-hosted Sentry is source-available under its own license and heavier to run. The `@sentry/react-native` SDK works with both; check feature coverage (source maps, native crashes) on the server you pick. Scrub user data, set the DSN in `EXPO_PUBLIC_` (a DSN is public by design), upload source maps from the release job, and tag events with the app version and update id.
10. **Keep real providers out.** Default test runs use mock servers for the backend, identity, push and email. An opt-in integration job guarded by env vars may hit staging, never production.
    **Done when:** `npx jest`, `tsc --noEmit` and the Maestro smoke flow pass on a clean checkout, and the screenshot set is attached to the pull request.

## Quick reference

| Need | Use |
|---|---|
| Unit and component tests | `jest-expo` + `@testing-library/react-native` |
| E2E default | Maestro (YAML flows in `.maestro/`) |
| E2E alternative | Detox |
| CI with builds | EAS Workflows `build` + `maestro` jobs |
| CI without builds | GitHub Actions: lint, types, Jest |
| Errors | Sentry SDK to GlitchTip or Sentry |
| Stable selectors | `testID`, accessibility labels |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "Simulators are enough." | Run one physical iPhone and one low-end Android before release. |
| "Add a sleep, the screen is slow." | Use `assertVisible` or `extendedWaitUntil`; wait on a condition. |
| "Mock the hook, it is easier." | Mock the network; test the hook through the screen. |
| "E2E on every screen." | One flow per journey; the rest at lower layers. |

## Verification

- Jest preset set; Jest 30 on SDK 58; tests green from a clean install.
- Every data view has loading, empty and error tests.
- At least a sign-in or main-task Maestro flow with screenshots exists and passes.
- No real provider is called in the default run.
- CI runs lint, types and unit tests on each push; E2E runs on a defined trigger.
- Error reporting is configured with scrubbing and source maps.

## References

| File | Load when |
|---|---|
| references/jest-and-rtl.md | writing setup files, mocks and component tests |
| references/maestro.md | writing flows, selectors, parameters, Detox comparison |
| references/ci-and-monitoring.md | writing workflows, device matrix, GlitchTip or Sentry setup |

## Versions

- jest-expo 58.0.14, jest 30.5.2 (SDK 58 needs Jest 30) (verified 2026-11-05, https://docs.expo.dev/develop/unit-testing/)
- @testing-library/react-native 14.1.0, v14 or newer for Expo Router, async render (verified 2026-11-05, https://docs.expo.dev/develop/unit-testing/)
- mobile-dev-inc/maestro cli-2.12.1 (verified 2026-11-05, https://github.com/mobile-dev-inc/maestro/releases)
- detox 20.51.4 (verified 2026-11-05, https://www.npmjs.com/package/detox)
- @sentry/react-native 8.33.0 (verified 2026-11-05, https://docs.sentry.io/platforms/react-native/)
- EAS Workflows with `build` and `maestro` jobs (verified 2026-11-05, https://docs.expo.dev/eas/workflows/examples/e2e-tests/)
- getsentry/self-hosted 26.10.1, Sentry self-hosted (verified 2026-11-05, https://github.com/getsentry/self-hosted/releases); GlitchTip: confirm the current release and license at https://glitchtip.com before choosing
