# Notes for adapting brand colours and building dark mode

## From one client colour to a full set

1. Check the client colour against white and against near-black with the contrast command. Whichever gives 4.5:1 or better decides the label colour on buttons.
2. If neither passes, darken the colour in small steps (about 5 percent lightness each) and keep its hue. Record the original and the adjusted value in the design notes so the client can see the change.
3. Pick the nearest palette from the dataset by hue family and swap only `primary` and `onPrimary`. Keep the dataset's `bg`, `surface`, `fg`, `muted` and `border`, which are already balanced.
4. Re-run contrast for `primary` on `bg` (needs 3:1 for outlines and icons) and for any link text (4.5:1).
5. Chart series: keep the dataset's list, replacing the first entry with the client primary if it keeps 3:1 against the page background.

## Dark mode

- Do not invert. Lower the lightness of the surfaces in steps (page darkest, surface one step up, raised elements another step) and use borders more than shadows.
- Raise primary lightness until it reaches 4.5:1 on the dark page, then use a very dark label on it. The dataset's dark blocks follow this.
- Pure black pages with pure white text vibrate; the dataset uses off-black and off-white.
- Re-check status colours; the light-mode ones are usually too dark on a dark page.
- Switch with a `data-theme` attribute and the `color-scheme` property so form controls follow.
- Images with white backgrounds need a rounded container or a subtle border in dark mode.

## Type details

- Optical size: variable fonts with an `opsz` axis (Fraunces, Newsreader, Source Serif 4) look better with `font-optical-sizing: auto`.
- Tracking: tighten large headings slightly (-0.01em to -0.02em), never body text.
- Uppercase labels are a generated-page tell; use sentence case and weight or colour for hierarchy.
- Numerals: tabular in tables, proportional in prose.
- Fallback stacks in the tokens file keep layout stable if a font fails; adjust with `size-adjust` only if a shift is visible.
