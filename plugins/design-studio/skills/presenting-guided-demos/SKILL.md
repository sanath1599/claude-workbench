---
name: presenting-guided-demos
description: Use when the owner wants a demo presentation, guided tour, walkthrough deck or executive demo of an app they have built, shown as one HTML file. Not for generating a demo from a repository through the claude.ai connector, which is interactive-demos:building-interactive-demos, and not for README screenshots, which is writing-showcase-readmes.
---

# Presenting guided demos

A guided demo is one standalone HTML deck that walks an audience through the real app. The tour must look exactly like the app, because the audience should recognise it when they log in.

## When to use

- "Make a demo presentation", "guided tour", "walkthrough for the client or executives".
- A finished or near-finished app needs to be explained to non-technical people.

## When not to use

- Building a demo straight from a code repository with the claude.ai connector: `interactive-demos:building-interactive-demos`.
- Static screenshots for a README: `design-studio:writing-showcase-readmes`.
- Pre-build approval of screens: `design-studio:previewing-ui-before-building`.
- Charts inside a report or demo: follow the account's dataviz skill for colour and layout and `docs-and-data:analysing-tabular-data` for choosing the chart.

## Format

- One standalone HTML file; no network needed. Fonts, icons and CSS inlined.
- A 1280x720 stage scaled to fit the window (CSS `transform: scale`), letterboxed.
- Slide 1: navy title slide with the product name, a one-line purpose and the audience or date.
- Middle slides: the real app UI (its real CSS and markup, with fictional seeded data) with guided steps. Each step dims the backdrop and draws a gold ring around one element. A white popover reads "KEY, n of m" (small caps label, step count), then a title, one or two sentences and progress dots, with Back and Next.
- Second-last slide, "Your turn": the app is clickable and free of overlays.
- Last slide: a summary whose points reveal one per step.
- Bottom bar: a progress bar and the text "Slide x/y, step a/b".
- Keys: Right/Space next, Left back, O overview grid of slides, F fullscreen. Hash deep links (`#3.2` is slide 3, step 2).

## Procedure

1. **Plan the story.** List 5 to 8 tasks the audience cares about, each as one slide with 2 to 5 steps. Write copy for executives: no jargon, spell out acronyms, say what it saves or enables. Sentence case, no emojis.
   **Done when:** a table of slide, steps, element to highlight exists and the owner has not objected.
2. **Capture the real UI.** Serve the app locally with fictional seeded data (never real customers or candidates). Capture each screen's rendered DOM and computed CSS, or reuse the app's components in a static build. Do not redraw it by hand; if the app's styles are not inlined the tour will drift from the app.
3. **Assemble.** Copy `assets/skeleton.html`. Put each screen in a `<section class="slide">` inside the stage. Give highlighted elements a `data-step` attribute with `data-title` and `data-text`. Keep one JS block for navigation.
4. **Check fidelity.** Open the deck beside the live app; fonts, colours, spacing and icons must match.
5. **Verify.** Run `design-studio:verifying-ui-in-browser` at 1280 and 1536 and on a phone width (the stage scales). Press every key; follow every deep link; confirm the "Your turn" slide is interactive.
   **Done when:** no console errors, popovers never cover their target, and the file opens offline.
6. **Hand over.** Give the file path and the keys cheat sheet. Offer a hosted copy only if asked; deploys need the owner's yes.

## Quick reference

| Element | Spec |
| --- | --- |
| Stage | 1280x720, scaled |
| Highlight | gold ring, dimmed backdrop |
| Popover | white, "KEY, n of m", title, text, dots |
| Bar | progress plus "Slide x/y, step a/b" |
| Keys | arrows/space, O, F |
| Deep link | `#slide.step` |

## Verification

- [ ] Title, tour, your-turn and summary slides all present.
- [ ] UI matches the live app exactly.
- [ ] Copy has no jargon or emojis; data is fictional.
- [ ] One file, works offline.

## References

| File | Load when |
| --- | --- |
| assets/skeleton.html | starting the deck |
