# Previewing mobile screens for approval

The approval rule is the same as for web: one clickable preview with fictional data, approved before building. Decide where the preview lives with `design-studio:previewing-ui-before-building`; this file only covers making it feel like a phone.

## Route A: single-file HTML in a device frame (default for new products)

Use `design-studio:building-single-file-html`.

- One HTML file, a 390 x 844 CSS-pixel frame centred on a neutral page, rounded corners, a status-bar strip, no brand-name device art.
- All screens as sections shown or hidden by JS; bottom tabs and back buttons actually navigate; sheets slide up; states (loading, empty, error, offline) reachable from a small "States" control outside the frame.
- Light and dark toggle outside the frame. Toasts drawn with the same sileo bundle the web mockups use, restyled to match the in-house mobile toast, or plain CSS.
- Lucide icons via inline SVG. No emojis.
- Check at 390 px width in a real browser with `design-studio:verifying-ui-in-browser`.

Share the file as a hosted preview (HTML artifact or the owner's preview host), not an attachment.

## Route B: the real app on Expo web (once the stack exists)

- `npx expo install react-dom react-native-web @expo/metro-runtime`, then `npx expo start --web`. Open it in a browser at phone width using device emulation.
- Good for layout, copy and flow review. Not a proof of native behaviour: haptics, gestures, native pickers, keyboard avoidance and safe areas differ. Say so in the review.
- Static export for a shareable URL: `npx expo export --platform web`, deploy the `dist/` folder as a preview (a preview deploy is allowed; production needs the owner's yes).

## Route C: on a device

- Development build installed through EAS internal distribution; share the QR. Use for the final native-feel review, after Route A has been approved.

## What to put in the approval message

The link, the list of screens, the states covered, what is deliberately not shown, and the question: approve, or list changes. Wait for the answer.
