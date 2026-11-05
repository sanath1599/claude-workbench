# Feedback, haptics and motion

## Toast choice for mobile

`sileo` is a DOM/CSS library and does not run in React Native. Candidates for native:

| Option | Verdict |
|---|---|
| In-house toast on Reanimated + Lucide | Chosen default. No dependency, matches the tokens file, works in Expo Go and dev builds, follows the same sentence-case copy rules as the web app. About 60 lines. |
| `burnt` (native iOS/Android toasts) | Good when an OS-native look is wanted; needs a development build; limited styling. Optional. |
| sonner ports | Do not use. The workbench guard hook blocks sonner imports and installs, and the owner standardised against it. |

The component keeps the same API shape as the web wrapper so call sites read the same: `toast.success("Saved")`.

```tsx
// src/lib/toast.tsx
import { useEffect } from "react";
import { AccessibilityInfo, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleAlert, CircleCheck, Info } from "lucide-react-native";
import { create } from "zustand";
import { useTheme } from "@/theme/use-theme";

type Kind = "success" | "error" | "info";
type Item = { id: number; kind: Kind; title: string; description?: string };
let next = 1;
const useToasts = create<{ items: Item[]; push: (i: Omit<Item, "id">) => void; drop: (id: number) => void }>((set) => ({
  items: [],
  push: (i) => set((s) => ({ items: [...s.items.slice(-2), { ...i, id: next++ }] })),
  drop: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

const show = (kind: Kind) => (title: string, description?: string) => {
  useToasts.getState().push({ kind, title, description });
  AccessibilityInfo.announceForAccessibility(description ? `${title}. ${description}` : title);
};
export const toast = { success: show("success"), error: show("error"), info: show("info") };

function Row({ item }: { item: Item }) {
  const t = useTheme();
  const drop = useToasts((s) => s.drop);
  useEffect(() => {
    const h = setTimeout(() => drop(item.id), item.kind === "error" ? 6000 : 3500);
    return () => clearTimeout(h);
  }, [item.id, item.kind, drop]);
  const Icon = item.kind === "success" ? CircleCheck : item.kind === "error" ? CircleAlert : Info;
  const tone = item.kind === "error" ? t.danger : item.kind === "success" ? t.accent : t.muted;
  return (
    <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOutDown.duration(150)}
      style={{ flexDirection: "row", gap: 12, padding: 14, borderRadius: 12, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border }}>
      <Icon size={20} color={tone} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: "600" }}>{item.title}</Text>
        {item.description ? <Text style={{ color: t.muted }}>{item.description}</Text> : null}
      </View>
    </Animated.View>
  );
}

export function ToastHost() {
  const items = useToasts((s) => s.items);
  const { bottom } = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, bottom: bottom + 72, gap: 8 }}>
      {items.map((i) => <Row key={i.id} item={i} />)}
    </View>
  );
}
```

Adjust `bottom + 72` to the real tab bar height. Entering and exiting animations should be skipped when reduce motion is on (see below). Errors stay longer and always carry a next step.

## Haptics

```ts
import * as Haptics from "expo-haptics";
Haptics.selectionAsync();                                             // picker or segment change
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);               // toggle
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);  // outcome
```

Wrap in a helper that no-ops on web. Never trigger haptics in a loop or on scroll.

## Reduced motion

```ts
import { useReducedMotion } from "react-native-reanimated";
const reduce = useReducedMotion();
const entering = reduce ? undefined : FadeInDown.duration(200);
```

Reanimated 4 also honours a global reduced-motion setting through its config; read the current docs for the exact option. With reduce motion on, swap slides and springs for a short fade or an instant change. Parallax, auto-playing loops and large zooms are removed entirely.

## Alerts

`Alert.alert(title, message, buttons)` for destructive confirmation only. Name the action on the button, put the cancel button first on iOS convention, and mark the destructive one with `style: "destructive"`. For input, build a screen or sheet.
