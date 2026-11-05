# Client

Docs: https://docs.expo.dev/push-notifications/overview/ and https://docs.expo.dev/versions/latest/sdk/notifications/ . The notification handler option names changed in recent SDKs; check the page for your installed version.

```ts
// src/lib/push.ts
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

export async function enablePush(): Promise<"granted" | "denied" | "unsupported"> {
  if (!Device.isDevice) return "unsupported";
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", { name: "General", importance: Notifications.AndroidImportance.DEFAULT });
  }
  const existing = await Notifications.getPermissionsAsync();
  const status = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!status.granted) return "denied";
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerToken({ token, platform: Platform.OS, deviceId: await stableDeviceId() });
  return "granted";
}
```

## Deep links from taps

```tsx
// app/_layout.tsx (inside the root component)
import { router } from "expo-router";
import * as Notifications from "expo-notifications";

const ALLOWED = /^\/(items\/[\w-]+|settings|inbox)$/;
function open(url?: unknown) {
  if (typeof url === "string" && ALLOWED.test(url)) router.push(url as never);
}
const last = Notifications.useLastNotificationResponse(); // cold start and background
useEffect(() => { if (last) open(last.notification.request.content.data?.url); }, [last]);
```

Untrusted data: a push payload can be forged by anyone who has a token, so route only to allowlisted paths and never run commands or fetch URLs from it.

## UX rules

- Pre-permission screen with one sentence of value and two buttons ("Turn on reminders", "Not now"). No emojis.
- After denial, a settings row shows "Notifications are off" with a button to the OS settings (`Linking.openSettings()`).
- Foreground: show an in-app banner or toast, not an OS banner, if the user is already on the relevant screen.
- Badge counts come from the server; set them in the payload and clear on open.
- Android: one channel per type users may mute; channel names are user-facing, sentence case.
