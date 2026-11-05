# UI preview

One self-contained HTML mockup of every screen, with fictional data. The real build waits for approval of this file.

## Layout

- `src/styles.css`: design tokens in `:root`, then components. No hex outside the token block.
- `src/screens/NN-name.html`: one `<section class="screen" id data-title>` per screen and state.
- `src/data.js`: fictional data. `src/app.js`: navigation. Other `src/*.js` files are inlined in name order.
- `src/index.html`: shell with the `/*CSS*/`, `<!--SCREENS-->` and `/*JS*/` markers.

## Build

```bash
node build.mjs            # writes preview.html next to build.mjs
node build.mjs --out x.html
```

Open `preview.html` by double-click; it needs no server or network.

## Rules

- Lucide icons inlined as SVG (copy the `<svg>` from lucide.dev); no emojis; no native `<select>`.
- Every list has a loading, empty and error screen.
- Toasts: bundle the real `sileo` package into an IIFE so visuals match the app:
  `npx esbuild toast-entry.jsx --bundle --minify --format=iife --jsx=automatic --define:process.env.NODE_ENV='"production"' --outfile=src/toast.js`
  Inline the package CSS in `styles.css`. Titles in sentence case, bottom-right.

## After approval

Copy the `:root` block into the app's single tokens file and map names one to one. Rebuild components in the app's framework; keep this folder as the visual reference.
