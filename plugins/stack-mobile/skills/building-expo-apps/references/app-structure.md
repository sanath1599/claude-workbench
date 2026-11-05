# App structure snippets

Docs: https://docs.expo.dev/router/introduction/ . Read them before using an API; these snippets show the shape, not the full surface.

## Folder layout

```
app/
  _layout.tsx            root: providers, theme, splash control
  (auth)/sign-in.tsx     unauthenticated group
  (tabs)/_layout.tsx     tab bar
  (tabs)/index.tsx
  (tabs)/settings.tsx
  items/[id].tsx         dynamic route
  +not-found.tsx
src/
  api/        client.ts, queries.ts (queryOptions), schemas.ts (Zod)
  components/
  theme/tokens.ts, theme/use-theme.ts
  lib/        env.ts, toast.tsx
```

## app.config.ts

```ts
import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Example",
  slug: "example",
  scheme: "example",               // deep links and auth redirects; changing it needs a new build
  version: "1.0.0",
  userInterfaceStyle: "automatic", // light and dark
  newArchEnabled: true,
  ios: { bundleIdentifier: "com.yourcompany.example" },
  android: { package: "com.yourcompany.example" },
  plugins: ["expo-router"],
  experiments: { typedRoutes: true },
  extra: { eas: { projectId: process.env.EAS_PROJECT_ID } },
};
export default config;
```

If `newArchEnabled` is rejected by the current SDK, drop it: check the SDK changelog for the default. Use the owner's domain (`{{wb.domain}}`) reversed for the real identifiers (for example `tld.domain.app`); they are permanent once published.

## Root layout

```tsx
// app/_layout.tsx
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/api/client";
import { ToastHost } from "@/lib/toast";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
        <ToastHost />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```

Create the `QueryClient` once in `src/api/client.ts` (module scope is fine on a device; there is no server render).

## Auth gate with protected groups

Use `Stack.Protected` guards in the layout (check the current Expo Router docs for the exact prop) so signed-out users cannot reach `(tabs)`. Redirect after sign-in with `router.replace`. Do not rely on hiding a tab as the access check; the API enforces access.

## Typed navigation and deep links

```tsx
import { Link, router, type Href } from "expo-router";

<Link href={{ pathname: "/items/[id]", params: { id } }}>Open</Link>;
router.push("/settings");
const target = `/items/${id}` as Href; // only for runtime-built paths
```

Typed routes reject relative paths. A link `example://items/42` opens `app/items/[id].tsx` once the `scheme` is installed in a build. Universal links (iOS) and app links (Android) need `associatedDomains` and `intentFilters` plus hosted association files on `{{wb.domain}}`; treat that as a release task and confirm with `shipping-mobile-releases`. Test links with `npx uri-scheme open example://items/42 --ios`.

## Tokens and theme

```ts
// src/theme/tokens.ts
export const palette = {
  light: { bg: "#FFFFFF", surface: "#F6F7F9", text: "#0E1116", muted: "#5B6472", accent: "#2B59FF", danger: "#C62828", border: "#E3E6EB" },
  dark:  { bg: "#0B0D10", surface: "#14181D", text: "#F2F4F7", muted: "#9AA3AF", accent: "#7C9BFF", danger: "#FF6B6B", border: "#232A33" },
} as const;
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20 } as const;
export const type = { body: 16, small: 13, title: 22, display: 30 } as const;

// src/theme/use-theme.ts
import { useColorScheme } from "react-native";
import { palette } from "./tokens";
export const useTheme = () => palette[useColorScheme() === "dark" ? "dark" : "light"];
```

Choose the real palette with `design-studio:choosing-type-and-color` after the mockup is approved; the values above are placeholders.

## Queries

```ts
// src/api/queries.ts
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "./client";

const Item = z.object({ id: z.string(), title: z.string() });
export const itemsQuery = () =>
  queryOptions({ queryKey: ["items"], queryFn: async () => z.array(Item).parse(await api("/items")) });
```

Parse every response with Zod; a bad payload becomes an error state, not a crash.

## Persisted cache and online state

```ts
import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((s) => setOnline(!!s.isConnected)));
```

Wrap the app in `PersistQueryClientProvider` with `createAsyncStoragePersister({ storage: AsyncStorage })`, a `buster` equal to the app version, and a `maxAge` that matches how stale the data may be. Never persist queries that hold tokens or personal data you would not store on the disk; exclude them with `dehydrateOptions.shouldDehydrateQuery`.

## Env helper

```ts
// src/lib/env.ts
import { z } from "zod";
export const env = z.object({ apiUrl: z.string().url() }).parse({ apiUrl: process.env.EXPO_PUBLIC_API_URL });
```

Reference `process.env.EXPO_PUBLIC_X` literally; dynamic access (`process.env[name]`) is not inlined.
