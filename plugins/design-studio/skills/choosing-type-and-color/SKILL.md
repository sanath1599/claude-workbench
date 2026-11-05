---
name: choosing-type-and-color
description: Use when picking or changing a palette, font pairing or type scale, writing the tokens file for a new UI, or when brand colours need checking for contrast. Triggers on "what colours", "which fonts", "set up tokens", "brand palette". Not for deciding whether a mockup is needed (previewing-ui-before-building) or reviewing taste (designing-without-ai-slop).
---

# Choosing type and color

Pick one palette and one type pairing for a stated reason, prove the contrast, and write them into a single tokens file. The curated data here is small on purpose: 25 palettes and 26 font pairings, each checked, so the choice takes minutes instead of an afternoon.

## When to use

- A new product or redesign has no palette or fonts yet.
- A client supplies one brand colour and you need a full, accessible set around it.
- You are about to write the first CSS or Tailwind theme for a project.
- Someone asks whether a colour pair is readable.

## When not to use

- The client already supplied a complete brand kit with tokens: use it, and only run the contrast check.
- Judging whether a finished page looks generated: `design-studio:designing-without-ai-slop`.
- Chart colours and chart type: `design-studio:styling-charts-and-data-displays`.

## Procedure

1. **State the brief in four words.** Industry, audience, mood, and the main surface (dashboard, landing, forms, article). Light mode is the default for client work; ask for dark only if the owner did.
   **Done when:** you can say, for example, "hr, recruiters, warm, dashboard".
2. **Search the palettes.** From this skill's directory run `node scripts/search.mjs palettes --industry hr --tags dashboard`. Add `--mood warm` to narrow. If a client brand colour exists, skip the search and go to step 4 with that colour as the primary.
   **Done when:** you have two or three candidates and have picked one, with a one-line reason that mentions the audience.
3. **Search the fonts.** `node scripts/search.mjs fonts --industry hr --mood friendly`. Prefer one family. Choose two only when the heading face has a job (editorial, brand voice). Never pick a pairing whose display face is also its body face unless the entry says "alone".
   **Done when:** one pairing is chosen and its `npm` line is noted.
4. **Prove contrast.** Run `node scripts/search.mjs contrast <fg> <bg>` for any pair you changed or any client colour. Body text needs 4.5:1, large text and UI outlines 3:1. If a client primary fails with white labels, darken it until it passes; do not switch the label to black unless the brand does.
   **Done when:** every text pair you will ship prints "body text pass".
5. **Export tokens.** `node scripts/search.mjs export pine-people --font jakarta-solo --out src/styles/tokens.css`. Add `--dark` only if dark mode is requested. For Tailwind, map the semantic names (`--color-bg`, `--color-primary`, and so on) in the theme and keep the file as the source of truth.
   **Done when:** the file exists, components reference `var(--color-*)` and `var(--font-*)` only, and `grep -rE "#[0-9a-fA-F]{6}" src --include=*.tsx` finds nothing outside the tokens file.
6. **Install the fonts.** Self-host with the Fontsource packages printed in the entry (`npm i @fontsource-variable/inter`) and import them once at the app entry. Use the Google Fonts URL only for single-file mockups. Set `font-display: swap` and preload the body face's regular weight.
   **Done when:** the page renders with the chosen faces offline, with no layout jump on load.
7. **Record the choice.** Add two lines to the project's design notes: palette id, font id, and the reason. Later sessions should not reopen the choice.

## Rules of thumb

- One accent. The primary is the accent; a second hue appears only in charts and status.
- Text colours come from three tokens: `fg`, `muted`, and the primary for links. Anything lighter than `muted` is decoration, never information.
- Status colours (success, warning, danger) pass 4.5:1 on both page and surface in every palette here, but still pair them with an icon and a word.
- Tabular numbers (`font-variant-numeric: tabular-nums`) in every table and metric.
- Line length under 75 characters for reading text; body 16px minimum, 17 or 18 for forms and long reading.
- Five type sizes at most (small, base, large, heading, display), two or three weights. The export gives exactly those five.
- Do not tint backgrounds with brand colour more than a few percent; use the `surface` and `border` tokens for structure.

## Quick reference

| Command | Purpose |
| --- | --- |
| `node scripts/search.mjs palettes [--industry x] [--mood x] [--tags a,b] [--mode dark] [--json]` | list matching palettes with contrast figures |
| `node scripts/search.mjs fonts [--industry x] [--mood x] [--tags a,b]` | list matching pairings with npm packages |
| `node scripts/search.mjs export <id> [--font <id>] [--dark] [--out file]` | write the tokens CSS |
| `node scripts/search.mjs contrast #RRGGBB #RRGGBB` | WCAG ratio and pass/fail |

## Rationalizations

| Excuse | Instead |
| --- | --- |
| "I will keep the default Tailwind blue and system font" | That is the generated look. Search, choose, and write the reason down. |
| "Contrast is close enough" | 4.4 fails. Darken the colour until it passes. |
| "Two display fonts will add character" | Spend character on one headline, not on the system. |
| "I will inline hex just this once" | Add or reuse a token. Hex outside the tokens file is a defect. |

## Verification

- [ ] Palette and font ids are recorded with a reason.
- [ ] Every shipped text pair passes the contrast command.
- [ ] Tokens file exists; no hex in components.
- [ ] Fonts are self-hosted and load without layout shift.
- [ ] If dark mode exists, both modes were checked, not only light.

## References

| File | Load when |
| --- | --- |
| references/palettes.json | you need to read palette data directly instead of through the script |
| references/font-pairings.json | you need Google Fonts URLs or the font stacks |
| references/type-and-color-notes.md | adapting a client brand colour into a full set, or building a dark mode |

## Versions

- @fontsource-variable/inter 5.3.0 (verified 2026-11-05, https://www.npmjs.com/package/@fontsource-variable/inter)
- culori 4.0.2 (verified 2026-11-05, https://www.npmjs.com/package/culori), optional, for generating tints from a client colour
