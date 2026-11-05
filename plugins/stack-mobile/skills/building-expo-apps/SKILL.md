---
name: building-expo-apps
description: Use when starting or extending a mobile app, an iOS or Android app, or when the owner mentions Expo, Expo Router, React Native, a development build, deep links, EXPO_PUBLIC variables, FlashList or a web plus mobile monorepo. Not for visual design (designing-native-ui), login (adding-mobile-auth-and-storage) or store builds (shipping-mobile-releases).
---

# Building Expo apps

New mobile apps are Expo (managed workflow with continuous native generation), Expo Router, TypeScript, TanStack Query, Lucide icons, and a tokens file. Plain React Native CLI projects are for existing codebases only. Read the current docs before using an API; Expo ships a new SDK several times a year and `npx expo install` picks the matching versions.

## When to use

- "Build an iOS / Android app", "mobile version of this dashboard".
- Adding routes, layouts, deep links, data fetching, forms, lists or theming to an Expo app.
- Deciding between Expo Go and a development build, or how to share code with a web app.

## When not to use

- Look and feel, platform conventions, toasts, motion: `stack-mobile:designing-native-ui`. Get the approved mockup first (house rules).
- Sign-in, tokens, local database: `stack-mobile:adding-mobile-auth-and-storage`.
- Push: `stack-mobile:sending-push-notifications`.
- Tests: `stack-mobile:testing-mobile-apps`. Builds and stores: `stack-mobile:shipping-mobile-releases`.
- The web app in the same repo: `stack-web:building-tanstack-frontends`.

## Procedure

1. **Confirm scope.** Ask only what changes the outcome: iOS, Android or both; whether a web app exists; the backend (FastAPI or TanStack Start); whether push, auth or offline are in scope. State the stack in one line in the README.
   **Done when:** the README names platforms, backend and the Expo SDK.
2. **Scaffold.** Run `npx create-expo-app@latest <name>` (TypeScript, Expo Router template). Use `{{wb.package_manager}}` and keep the lockfile. Install every Expo-aware dependency with `npx expo install <pkg>`, never `npm i`, so versions match the SDK.
   **Done when:** `npx expo start` serves and `npx tsc --noEmit` passes.
3. **Pick the runtime.** Expo Go is for the first hour only. As soon as the app needs a native module outside Expo Go, a custom scheme, push, or a config plugin, create a development build: `npx expo install expo-dev-client`, then `eas build --profile development` or a local `npx expo run:ios|android`. Never hand-edit `ios/` or `android/`; they are generated (CNG), git-ignored, and rebuilt by `npx expo prebuild --clean`. Native changes go through config plugins in `app.config.ts`.
4. **Routes.** Files in `app/` are routes. Use `_layout.tsx` for stacks and tabs, groups like `(tabs)` and `(auth)` for structure, `[id].tsx` for params. Turn on typed routes (`experiments.typedRoutes` in app config, then `npx expo customize tsconfig.json`) and pass `Href` values to `Link` and `router.push`. Set a `scheme` for deep links now; changing it later needs a new build. Details in `references/app-structure.md`.
5. **Data.** TanStack Query for server state: `queryOptions` defined once per resource, mutations call `invalidateQueries`. Persist the cache with `@tanstack/react-query-persist-client` over an async storage persister for offline reads, and wire `onlineManager` to NetInfo. Local UI state stays in React state or `zustand`; do not mirror server data in a store.
6. **Forms.** TanStack Form or `react-hook-form` with a Zod schema shared with the web app. Show field errors under the field. Submit buttons show a pending state and are disabled while pending.
7. **Env and secrets.** Only `EXPO_PUBLIC_` variables are inlined into the JavaScript bundle, and the bundle is readable by anyone who installs the app. Put public values there (API base URL, publishable keys, Sentry DSN). Secrets live on the server, or in EAS environment variables with secret visibility for build-time tooling. Never put a token, service key or password behind `EXPO_PUBLIC_`. Commit `.env.example`, never `.env`. `shipping-mobile-releases` ships a script that flags suspicious names.
8. **Tokens, theme, icons.** One `src/theme/tokens.ts` with light and dark palettes, spacing, radius and type scale; set `userInterfaceStyle: "automatic"` and read `useColorScheme()`. Components never contain hex. Icons come from `lucide-react-native`; no emojis in UI. Snippets in `references/app-structure.md`.
9. **Layout hygiene.** Wrap the root in `SafeAreaProvider`; use `useSafeAreaInsets` or `SafeAreaView` from `react-native-safe-area-context`. Forms use `KeyboardAvoidingView` or `react-native-keyboard-controller`. Every pressable has `accessibilityRole` and a label, text scales with the system font size, and nothing is cut off without a "show more".
10. **Performance.** Lists of more than a screen use `@shopify/flash-list` with a stable `keyExtractor`; remote images use `expo-image` with a size and cache policy. Memoise row components, keep `renderItem` pure, and test on a mid-range Android device, not only a simulator. See `references/performance-and-offline.md`.
11. **Monorepo with web.** Put the apps under `apps/`, shared TypeScript under `packages/` (API client, Zod schemas, query keys, pure logic). Shared packages contain no DOM and no React Native imports. Metro autoconfigures npm, Yarn and Bun workspaces in current SDKs; pnpm needs the isolated-install setup from the Expo monorepo guide. Details in `references/monorepo.md`.
12. **Verify on a device.** Run the app on a simulator and one physical device, on both light and dark, with large text, offline, and a cold start from a deep link.
    **Done when:** `npx tsc --noEmit`, lint, `npx expo-doctor` and the unit tests pass, the main route runs on a device in both themes, and `testing-mobile-apps` has a smoke flow.

## Quick reference

| Need | Use |
|---|---|
| New app | `npx create-expo-app@latest` |
| Add a package | `npx expo install <pkg>` |
| Native module or custom scheme | development build, not Expo Go |
| Native config | config plugin in `app.config.ts`, then `npx expo prebuild --clean` |
| Server data | TanStack Query (+ persist client) |
| Long list | `@shopify/flash-list` |
| Images | `expo-image` |
| Icons | `lucide-react-native` |
| Public env | `EXPO_PUBLIC_*` only; never a secret |
| Health check | `npx expo-doctor` |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "Just edit the Xcode project." | Write a config plugin; generated folders are disposable. |
| "Put the API key in EXPO_PUBLIC for now." | Proxy through the backend. The bundle is public. |
| "FlatList is fine." | Use FlashList once a list can exceed a screen. |
| "Expo Go works, skip the dev build." | It stops working at the first native module; switch early. |

## Verification

- Dependencies installed via `npx expo install`; `npx expo-doctor` is clean.
- `ios/` and `android/` are git-ignored and not hand-edited.
- No secret behind `EXPO_PUBLIC_`; `.env` ignored, `.env.example` committed.
- Typed routes on; a `scheme` is set.
- Light and dark, safe areas, keyboard, large text and offline checked on a device.
- Lucide icons only, tokens file used, no emojis.

## References

| File | Load when |
|---|---|
| references/app-structure.md | writing layouts, typed routes, deep links, tokens, query setup, forms |
| references/performance-and-offline.md | slow lists, images, startup, offline cache and sync |
| references/monorepo.md | sharing code with a web app |

## Versions

- expo 58.0.23, SDK 58 uses react-native 0.88 and React 19.3, needs Node 22.13 or newer and Xcode 26.4 or newer (verified 2026-11-05, https://docs.expo.dev/versions/latest/)
- expo-router 58.0.30 (verified 2026-11-05, https://www.npmjs.com/package/expo-router)
- react-native 0.88.1, react 19.3.1 (verified 2026-11-05, https://www.npmjs.com/package/react-native)
- @tanstack/react-query 5.106.1, @tanstack/react-query-persist-client 5.106.1, @tanstack/query-async-storage-persister 5.106.1 (verified 2026-11-05, https://www.npmjs.com/package/@tanstack/react-query)
- @react-native-async-storage/async-storage 3.1.1, @react-native-community/netinfo 12.0.1 (verified 2026-11-05, https://www.npmjs.com/package/@react-native-community/netinfo)
- @shopify/flash-list 2.3.3 (verified 2026-11-05, https://www.npmjs.com/package/@shopify/flash-list)
- expo-image 58.0.18, expo-linking 58.0.16, expo-constants 58.0.15, expo-system-ui 58.0.7 (verified 2026-11-05, https://docs.expo.dev/versions/latest/)
- lucide-react-native 1.69.0, react-native-svg 15.16.0 (verified 2026-11-05, https://lucide.dev/guide/packages/lucide-react-native)
- react-native-safe-area-context 5.11.1, react-native-keyboard-controller 1.22.9 (verified 2026-11-05, https://www.npmjs.com/package/react-native-keyboard-controller)
- zustand 5.0.16, react-hook-form 7.91.0 (verified 2026-11-05, https://registry.npmjs.org)
- Typed routes are beta and enabled with `experiments.typedRoutes`; dark mode on Android dev builds needs `expo-system-ui` (verified 2026-11-05, https://docs.expo.dev/router/reference/typed-routes/)
