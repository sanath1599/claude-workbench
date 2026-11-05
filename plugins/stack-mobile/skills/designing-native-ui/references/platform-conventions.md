# Platform conventions

Sources: https://developer.apple.com/design/human-interface-guidelines/ and https://m3.material.io/ . Re-read before a redesign; both change yearly.

| Topic | iOS | Android |
|---|---|---|
| Back | edge swipe, back button in the bar | system back gesture or button; must work on every screen |
| Titles | large title that collapses on scroll | top app bar, title left |
| Tabs | bottom tab bar, labels with icons | bottom navigation bar, 3 to 5 items |
| Primary action | in the bar or inline; avoid floating buttons | a floating action button is acceptable for one main create action |
| Destructive actions | swipe left on a row, red; confirm in an action sheet | swipe or overflow menu, confirm in a dialog |
| Pickers | native wheel or compact date picker | Material date and time dialogs |
| Sharing | system share sheet | system share sheet |
| Text | system font (San Francisco), Dynamic Type | system font (Roboto), font scale |
| Edge to edge | content under status bar, respect safe areas | edge to edge is the default on current Android; respect insets |
| Permissions | ask in context, once; explain before the system prompt | same; handle "ask every time" and permanent denial |

Rules of thumb:

- Use platform-specific code only where the table says they differ: `Platform.select` for small differences, `.ios.tsx` / `.android.tsx` files for large ones.
- Prefer `expo-router` native stack and tabs so transitions, gestures and large titles come from the OS. Custom headers are the exception.
- Do not recreate system controls (switch, segmented control, date picker) from scratch.
- Keyboards: set `keyboardType`, `autoComplete`, `textContentType` and `returnKeyType` on inputs so autofill and the right keyboard appear.
- Sheets: a bottom sheet for secondary tasks; full screen for flows with several steps.
