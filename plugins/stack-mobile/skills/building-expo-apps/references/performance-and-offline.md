# Performance and offline

Docs: https://shopify.github.io/flash-list/ , https://docs.expo.dev/versions/latest/sdk/image/

## Lists

- `FlashList` with `keyExtractor`, a memoised `renderItem`, and `getItemType` when rows differ in layout. In FlashList 2 sizing is automatic; do not add the v1 `estimatedItemSize` unless the docs for your installed version still ask for it.
- No inline arrow functions or object literals in row props. No `ScrollView` wrapping a long `.map`.
- Paginate with a cursor from the API and `useInfiniteQuery`; show a footer spinner, an empty state and an error row with retry.

## Images

- `expo-image` with `contentFit`, `placeholder` (blurhash or thumbhash from the API) and `cachePolicy="memory-disk"`.
- Request the size you display (`?w=` on the server), not the original.

## Startup and runtime

- Keep the splash screen up with `expo-splash-screen` until fonts and the first auth check resolve, then hide it once.
- Animate with Reanimated on the UI thread (`transform`, `opacity`). Avoid animating layout props on large trees.
- Profile a release build, not a dev build. Use the React Native DevTools profiler and Android Studio or Instruments for jank.
- Hermes is the engine; do not ship `console.log` in hot paths.

## Offline basics

1. Reads: persisted TanStack Query cache gives last-known data. Show a small "Offline, showing saved data" banner from NetInfo state.
2. Writes: queue mutations with `mutationKey` defaults and `resumePausedMutations` after the persist client restores. Make every write idempotent with a client-generated id so a retry cannot duplicate.
3. Conflicts: last-write-wins with a server `updated_at` check is the default; escalate to a real sync design only when two devices edit the same record. See `stack-mobile:adding-mobile-auth-and-storage` for local databases.
4. Test by turning on airplane mode mid-flow, then restoring.
