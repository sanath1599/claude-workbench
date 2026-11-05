---
name: using-sileo-toasts
description: Use when adding toast notifications, snackbars, flash messages or "copied!" feedback to a React app or an HTML mockup, or when code or a library suggests sonner, react-hot-toast or react-toastify. Not for inline form errors or banners, which stay in the page.
---

# Toasts use sileo

The owner's apps use the `sileo` package for every toast: physics-based pills that look the same in the app and in its HTML mockups. Not sonner, not a hand-rolled toast, not shadcn's sonner wrapper. A PreToolUse hook blocks installing or importing the alternatives.

## When to use
- Any transient feedback: saved, copied, sent, failed, undo.
- A design mockup that must show the same toasts as the real app.

## When not to use
- Validation errors next to a field, empty states and persistent banners. These belong in the layout.

## Procedure

1. **Install:** `npm i sileo` (React 18 or later is a peer dependency).
2. **Mount once** in the root layout, with options defined at module level. A new object on every render re-runs the Toaster's options effect.
   ```tsx
   // src/components/app-toaster.tsx
   import { Toaster } from "sileo";
   import "sileo/styles.css";

   const OPTIONS = { fill: "var(--toast-fill, #101A29)" } as const;

   export function AppToaster() {
     return <Toaster position="bottom-right" theme="light" options={OPTIONS} />;
   }
   ```
   In Next.js the file needs `"use client"`. In TanStack Router, render it inside `__root.tsx`.
3. **Fix two styling defaults** in the global stylesheet. sileo title-cases every word, but the owner writes sentence case. Its viewport also sits below most modals.
   ```css
   html [data-sileo-title] { text-transform: none; }
   html [data-sileo-viewport] { z-index: 200; }
   ```
4. **Wrap calls** in a tiny `src/lib/toast.ts` so call sites stay short and consistent:
   ```ts
   import type { ReactNode } from "react";
   import { sileo, type SileoOptions } from "sileo";
   const o = (title: string, description?: ReactNode): SileoOptions => (description ? { title, description } : { title });
   export const toast = {
     success: (t: string, d?: ReactNode) => sileo.success(o(t, d)),
     error: (t: string, d?: ReactNode) => sileo.error(o(t, d)),
     info: (t: string, d?: ReactNode) => sileo.info(o(t, d)),
     warning: (t: string, d?: ReactNode) => sileo.warning(o(t, d)),
     promise: sileo.promise,
     dismiss: sileo.dismiss,
   };
   ```
   Usage: `toast.success("Link copied", "Anyone with this link can apply.")`. For async work, use `sileo.promise(p, { loading, success, error })`. For an action with a button, use `sileo.action({ title, button: { title: "Undo", onClick } })`.
5. **Mockups** (static HTML): bundle the same package into an IIFE so the mockup's toasts match the app exactly:
   ```bash
   npx esbuild toast-entry.jsx --bundle --format=iife --global-name=SileoBridge --outfile=preview/sileo.js
   ```
   Here `toast-entry.jsx` mounts `<Toaster>` into a div and exports `sileo`.
   **Done when:** a toast shows bottom-right, in sentence case, above any open modal.

## Quick reference

| Need | Call |
|---|---|
| Success, error, info, warning | `sileo.success({ title, description })` and the like |
| Loading that resolves | `sileo.promise(promise, { loading, success, error })` |
| Undo or retry button | `sileo.action({ title, button: { title, onClick } })` |
| Remove | `sileo.dismiss(id)` / `sileo.clear()` |
| Toaster props | `position`, `offset`, `theme` ("light", "dark", "system"), `options` (`fill`, `roundness`, `duration`, `styles`) |

## Copy rules
Titles are short and in sentence case ("Invite sent", not "Invite Sent!"). The description says what happens next, in one line. No emojis. Errors say what to do ("Couldn't save. Check your connection and try again."). Use mid-tone state colours from the design tokens, not neon.

## Verification
- [ ] No `sonner`, `react-hot-toast` or `react-toastify` in package.json or imports.## Rationalizations

| Excuse | Instead |
|---|---|
| "The conventions doc for the build says sonner" | Agents copy convention docs literally. Before handing a prototype or app to parallel agents, grep the conventions doc and `package.json` for `sonner`, `react-hot-toast` and `react-toastify` and fix the doc first. |

## Verification
- [ ] No `sonner`, `react-hot-toast` or `react-toastify` in package.json or imports (`grep -rn "from 'sonner'" src` returns nothing).
- [ ] `<Toaster>` is mounted exactly once.
- [ ] The title override and z-index CSS are present.

## Versions
- sileo 0.1.6 (verified 2026-11-05, https://www.npmjs.com/package/sileo; source https://github.com/hiaaryan/sileo)
