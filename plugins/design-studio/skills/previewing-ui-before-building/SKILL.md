---
name: previewing-ui-before-building
description: Use when starting UI for a new product, a new set of screens or a redesign, and nothing has been approved yet. Triggers on "build the app", "new dashboard", "design the screens", "mockup", "how will it look". Not for small tweaks, copy or colour changes, or when the owner says "just create the build"; those go straight to code.
---

# Previewing UI before building

For new product UI, the owner reviews one HTML file with every screen and fictional data before any real code is written. The build waits for approval.

## When to use

- A new product, module or set of screens with no approved visual reference.
- A redesign where the owner has said they dislike the current UI.
- The owner asks for a "sample html", "mockup" or "how it will look".

## When not to use

- A tweak to an existing screen: footer text, a colour, one new field, a bug. Edit the code.
- The owner says "just create the build", "skip the mockup" or approves a design already in the repo. Do not offer a mockup again.
- A demo deck of a finished app: `design-studio:presenting-guided-demos`.
- Judging taste on a finished page: `design-studio:designing-without-ai-slop`.

## Procedure

1. **Check the gate.** Look for an approved preview (`design/preview/` or a link in the spec). If one exists and the request is inside it, stop here and build. Otherwise propose the preview in one line and start; do not ask permission to make it, it is cheap and reversible.
2. **Get direction.** Invoke `frontend-design:frontend-design` for aesthetic direction, then `ui-ux-pro-max:ui-ux-pro-max` for palette, type and layout, and `meta-skills:modern-web-design` for current patterns. Read `design-studio:designing-without-ai-slop` before drawing anything. If the client has brand colours and a logo, use them and default to light mode.
   **Done when:** you can state in three lines the palette, the type pair and the layout idea.
3. **Scaffold.** Copy `assets/` to `design/preview/` in the project. Run `node design/preview/build.mjs` once to confirm the empty template builds.
   **Done when:** `design/preview/preview.html` exists and opens.
4. **Write tokens first.** Put every colour, radius, space step, shadow and font in `src/styles.css` as custom properties. Components reference tokens only, never hex.
5. **List all screens.** Every screen in the flow, each role's view, plus loading, empty and error states. One partial per screen in `src/screens/NN-name.html`. Add fictional data in `src/data.js` (invented names, `example.com`, never real client or candidate data).
6. **Build the interactions that sell the idea.** Navigation between screens, a custom searchable combobox with inline "create new" for entity pickers (never `<select>` or datalist), modals, and toasts. Icons are Lucide inlined as SVG; no emojis. For toasts in a non-React mockup, bundle `sileo` into an IIFE with esbuild so the visuals match the app (see `assets/README.md`).
7. **Verify.** Run `design-studio:verifying-ui-in-browser` against the built file at all four widths. Then run the `design-studio:design-critic` agent on it and fix high-severity findings.
   **Done when:** zero console errors, no horizontal overflow, critic has no high findings.
8. **Present and wait.** Give the owner the file path and a numbered list of screens. Do not start the real build. After "approved" (or equivalent), record it in the spec or CLAUDE.md as the visual reference.
9. **Optional: runnable prototype.** When the approved mockup must become a multi-screen prototype with fake data before any backend exists, follow `references/clickable-prototype.md`. For one self-contained file that must survive email and `file://`, see `design-studio:building-single-file-html`.
10. **Port tokens.** In the real app, copy the `:root` token block into one tokens file (`src/styles/tokens.css`, or the Tailwind theme if the project uses it). Map each token name one to one so the preview stays the reference. Rebuild components from the partials; do not paste preview markup wholesale. If the preview changes later, update tokens first.
   **Done when:** `grep -rE "#[0-9a-fA-F]{3,8}" src --include=*.tsx --include=*.css` finds hex only in the tokens file.

## Quick reference

| Item | Rule |
| --- | --- |
| Output | one self-contained HTML file, works offline by double-click |
| Data | fictional, realistic in length and variety, includes long names and empty cases |
| States | loading, empty, error, success for every list and form |
| Widths | phone, iPad, desktop all designed, not only shrunk |
| Dependencies | none in the template; esbuild only for the sileo bundle |
| Libraries | The mockup and the app use the same toast, icon and component libraries; grep the conventions doc before parallel builds |

## Rationalizations

| Excuse | Instead |
| --- | --- |
| "I can describe the design in words" | The owner approves what they can see. Build the file. |
| "Only the main screen matters" | Approval covers all screens and states; missing ones become surprises later. |
| "It is a small change" | Then it is not this skill. Edit the code. |
| "I will use placeholder lorem ipsum" | Use believable fictional data; layout bugs hide behind lorem. |

## Verification

- [ ] Every screen and state in the flow is in the file.
- [ ] No hex outside `styles.css`; no emoji; no native select.
- [ ] Built file opens offline; verified at 375, 768, 1280, 1536.
- [ ] The real build has not started.

## References

| File | Load when |
| --- | --- |
| assets/README.md | scaffolding the preview folder |
| assets/build.mjs | customising the build |

## Versions

- esbuild 0.28.2 (verified 2026-11-05, https://www.npmjs.com/package/esbuild)
- sileo 0.1.6 (verified 2026-11-05, https://www.npmjs.com/package/sileo)
- lucide-react 1.69.0 (verified 2026-11-05, https://www.npmjs.com/package/lucide-react)
| references/clickable-prototype.md | turning the approved mockup into a runnable multi-screen prototype with fake data |
