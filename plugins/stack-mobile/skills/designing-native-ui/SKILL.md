---
name: designing-native-ui
description: Use when designing or reviewing mobile screens, navigation, touch targets, haptics, motion, toasts or alerts, or empty, loading and error states in an iOS or Android app, or when the owner wants a mobile mockup approved. Not for the Expo project setup (building-expo-apps) or web UI taste rules (design-studio:designing-without-ai-slop).
---

# Designing native UI

A phone app should feel like it belongs on the phone it runs on: follow iOS and Android conventions where they differ, keep one minimal visual identity on top, and get the screens approved as a clickable preview before building them.

## When to use

- New screens, a redesign, or "make the app feel native".
- Choosing navigation (tabs, stack, sheet), touch sizes, haptics, motion or feedback.
- Adding toasts, confirmations, empty, loading or error states.

## When not to use

- Project structure, routing, data: `stack-mobile:building-expo-apps`.
- Web or desktop layouts: `design-studio:designing-without-ai-slop`.
- Choosing palette and fonts from scratch: `design-studio:choosing-type-and-color`.

## Procedure

1. **Run the slop rules first.** Apply `design-studio:designing-without-ai-slop` (modern, minimal, Lucide only, sentence case, one accent, no emojis, no gradients as decoration). This skill adds the mobile layer on top and does not repeat them.
2. **Get a mockup approved.** For a new product or screen set, nothing is built until the owner approves a preview. Follow `design-studio:previewing-ui-before-building`, and make the preview clickable on a phone: see `references/previewing-mobile-screens.md` for the Expo web route and the device-frame HTML route. Dummy data only.
   **Done when:** the owner has said yes to a named preview file or URL.
3. **Choose navigation by task, not habit.** Three to five top-level destinations: bottom tabs. A drill-down hierarchy: a stack with the system back gesture intact. A short task that returns to context: a sheet or modal. Never hide the primary action in a hamburger. Respect the platform back behaviour (iOS edge swipe, Android system back); do not trap it.
4. **Follow platform conventions where they differ.** Rules in `references/platform-conventions.md`: iOS large titles and swipe actions, Android top app bar and system back, system fonts, native pickers and share sheets. Only override a convention for a reason you can say in one line.
5. **Size touch targets.** At least 44x44 pt on iOS and 48x48 dp on Android, with 8 dp between neighbours. Use `hitSlop` to enlarge small icons; do not shrink the visual only. Primary actions sit in the thumb zone at the bottom, not the top corner.
6. **Pick feedback by weight.** A toast or banner for passive confirmation; a native alert (`Alert.alert`) only for destructive or irreversible confirmations with a specific verb on the button ("Delete 3 items", never "OK"); an inline message for field errors; a haptic for a physical-feeling confirmation. Toast choice and the reasoning are in `references/feedback-and-motion.md`: in-house component on Reanimated, not `sileo` (web only), and not any sonner port (the workbench hook blocks sonner).
7. **Add haptics sparingly.** `expo-haptics`: selection tick on picker change, light impact on toggle, success/warning/error notification on outcome. Never on scroll or every tap. Respect the user's system haptic setting.
8. **Motion with a reduced-motion path.** Use Reanimated for transitions of 150 to 300 ms with ease-out; animate transform and opacity. Read `AccessibilityInfo.isReduceMotionEnabled()` (or Reanimated's reduced-motion hook) and replace movement with a fade or nothing. No motion is added unless the owner asked for it or it explains a state change.
9. **Write the four states for every data view.** Loading (skeleton or spinner after 300 ms, never a blank), empty (one sentence and one action), error (what happened, how to fix, a retry button), offline (saved data with a banner). No emojis, even here. Text that is long gets "show more", not an ellipsis with no way out.
10. **Accessibility pass.** Labels and roles on every control, focus order that matches reading order, contrast of 4.5:1 for body text in both themes, dynamic type up to the largest size without clipping, and a screen reader walk (VoiceOver or TalkBack) of the main flow.
    **Done when:** the main flow works with the screen reader, at the largest text size, in dark mode, with reduce motion on, and screenshots of each state are attached to the review.

## Quick reference

| Question | Default |
|---|---|
| Top-level nav | bottom tabs, 3 to 5 items |
| Touch target | 44 pt iOS, 48 dp Android |
| Passive feedback | in-house toast (bottom, above the tab bar) |
| Destructive confirm | `Alert.alert` with a named verb |
| Icons | `lucide-react-native`, stroke 1.75 to 2 |
| Haptics | `expo-haptics`, outcomes only |
| Motion | Reanimated, 150 to 300 ms, reduce-motion aware |
| Preview | Expo web route or device-frame HTML |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "Same UI on both platforms is simpler." | Share tokens and components, not conventions that fight the OS. |
| "Skip the mockup, it is only a phone app." | New screens need an approved preview. A tweak does not. |
| "A tiny icon button looks cleaner." | Keep the glyph small and the hit area 44/48. |
| "Just use sonner-native." | The guard hook blocks sonner imports; use the in-house toast. |

## Verification

- An approved preview is linked in the PR or the README.
- Targets meet 44 pt / 48 dp; the back gesture and Android back work.
- Loading, empty, error and offline states exist and were screenshotted.
- Reduce motion, largest text, dark mode and a screen reader pass were run.
- No emoji, no hex in components, Lucide icons only, sentence case.

## References

| File | Load when |
|---|---|
| references/platform-conventions.md | deciding iOS versus Android behaviour |
| references/feedback-and-motion.md | writing the toast, haptics, reduced-motion code |
| references/previewing-mobile-screens.md | preparing the mockup for approval |

## Versions

- expo-haptics 58.0.7 (verified 2026-11-05, https://docs.expo.dev/versions/latest/sdk/haptics/)
- react-native-reanimated 4.7.1 with react-native-worklets 0.13.1 (verified 2026-11-05, https://docs.swmansion.com/react-native-reanimated/)
- lucide-react-native 1.69.0 (verified 2026-11-05, https://lucide.dev/guide/packages/lucide-react-native)
- burnt 0.13.0, optional native toasts, needs a development build (verified 2026-11-05, https://www.npmjs.com/package/burnt)
- Apple Human Interface Guidelines and Material Design 3 are the conventions sources (verified 2026-11-05, https://developer.apple.com/design/human-interface-guidelines/ and https://m3.material.io/)
