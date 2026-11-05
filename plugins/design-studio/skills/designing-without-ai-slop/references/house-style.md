# House style

The owner's preferred UI, taken from two shipped products: an AI interview platform (HR and candidate flows) and Animated Technical Interactive (app.antm.ai, a repo-to-demo tool). Two named directions share one set of principles. Tokens are in `assets/house-tokens.css` (select with `data-house="navy"` or `data-house="graphite"`); palette ids `house-navy` and `house-graphite` and font ids `house-navy-jakarta` and `house-graphite-geist` are in `design-studio:choosing-type-and-color` (`--tag house`). A client brand or an explicit brief overrides all of this.

## Principles (why these UIs feel right)

1. One accent, used only where something is clickable or live. Everything else is ink, paper and hairlines.
2. Real content, never stock art. A landing page shows the live product (or a screenshot of the real one) on a full-width stage; sample data is realistic, with long names and empty cases.
3. Type does the work: a bold, tightly tracked display face, a calm body face, tabular numbers wherever numbers line up.
4. Restrained hero: a headline and a plain-sentence explanation side by side, one primary and one quiet button, one line of fact below. No badge above the headline, no gradient text, no feature-card trio.
5. One moment of motion per screen (the product arriving, a live step spinning, a done mark drawing). Everything else transitions in 150 to 320 ms and respects `prefers-reduced-motion`.
6. Quiet density: 13 to 14px table text, 4px-based spacing, sticky headers, hover rows, a visible empty state with the next action.
7. States are designed: loading skeleton or spinner step list, empty with an invitation, error that says what to do, success that draws a mark.
8. Light first; dark is a full second palette, not an inversion.
9. Toasts are `sileo`, bottom-right, sentence case, mid-tone state colours. No emoji, Lucide icons only, custom comboboxes (never native select).

## Shared rules

| Topic | Rule |
| --- | --- |
| Headings | weight 700 to 800, tracking -0.02em to -0.045em, line-height 1.04 to 1.22, `text-wrap: balance` |
| Body | 15 to 16px, line-height 1.55, max 62ch for reading text |
| Numbers | `font-variant-numeric: tabular-nums` in tables, KPIs, scores |
| Controls | buttons 42px (large 50, small 34), inputs 44px, hit area never under 34px |
| Focus | 2px solid ring in the accent, offset 2px; inputs add a 4px 14 to 15% halo |
| Borders | 1px hairlines carry structure; shadows are rare and soft |
| Icons | Lucide, 18px, stroke 1.9, inline SVG |
| Status | pill with a dot and a word: success, warning, danger, info; colour never carries meaning alone |
| Tabs | segmented strip (navy) or underline row (graphite), arrow keys move selection |
| Empty / loading | centred grid, 48px padding, muted text, one action; skeleton or step list for loading |
| Motion | 150 to 200 ms for state, 320 ms for panels, `cubic-bezier(.22,1,.36,1)`; press feedback `translateY(1px)` |
| Toasts | `sileo`, `position="bottom-right"`, titles in sentence case, viewport above dialogs |

Toast overrides (also in `assets/house-tokens.css`):

```css
:root:root { --sileo-state-success: #178255; --sileo-state-error: #C52020; --sileo-state-action: #C4500F; }
html [data-sileo-viewport] { z-index: 200; } /* above dialogs (100) and the mobile sidebar (80) */
html [data-sileo-title] { text-transform: none; } /* sileo capitalises every word otherwise */
```

## Direction 1: Navy professional

For HR, B2B, candidate and admin products. Cool off-white page, navy ink, one electric blue, soft translucent panels over a faint blue sky. Friendly and confident, never corporate-grey.

**Tokens (light).** bg `#F8F9FC`, surface `#FFFFFF`, well `#EEF1F8`, fg `#101A29`, muted `#5C6074` (the source used `#737588`, 4.3:1; darkened to pass), border `#DCE1EB`, primary `#246BFD` (hover `#1A5AE6`), accent `#155BAC`, success `#0A7F58`, warning `#9A5B00`, danger `#C03535`. Soft tints for pills: the hue at 10 to 14% alpha. **Dark** is the navy family: bg `#101A29`, surface `#182640`, raised `#22324F`, fg `#EAF0FF`, muted `#93A6CC`, primary `#5B8EFF` with a navy label. The dark app sidebar is navy even in light mode (`#101A29`, text `#C9D5EE`, active item at 6% white).

**Type.** Plus Jakarta Sans only (400 to 800), body 15px weight 500, line-height 1.55, `ss01` on. Display `clamp(34px, 5.4vw, 52px)` weight 800 tracking -0.035em; h1 26 to 32px -0.028em; h2 22px 700 -0.02em; h3 17px 700 -0.012em; small 13px muted. Metric numbers 26px 800 -0.03em.

**Shape.** Radii: panel 26px, card 18px, control 12px, pill 999px. Controls: button 42px, 600 weight, 14.5px; input 44px, 500 weight. Spacing 4px base, panel padding `clamp(24px, 4vw, 44px)`.

**Components.**

```css
.btn-primary { color: #fff; border-radius: 12px; height: 42px; font-weight: 600;
  background: linear-gradient(180deg, #3A7BFF, #246BFD 55%, #1E62F0);
  box-shadow: 0 1px 0 rgb(255 255 255 / .35) inset, 0 0 0 1px rgb(21 91 172 / .35), 0 8px 20px -8px rgb(36 107 253 / .65); }
.input:focus { border-color: #246BFD; box-shadow: 0 0 0 4px rgb(36 107 253 / .14); }
.pill { height: 24px; padding: 0 10px; border-radius: 999px; font: 600 12.5px/1 inherit; } /* dot + word */
.kpis { display: grid; grid-template-columns: repeat(7, 1fr); } /* hairline dividers, 26px value over 12.5px label */
.tabs { display: flex; gap: 2px; padding: 4px; border-radius: 14px; background: rgb(16 26 41 / .05); }
```

- Cards and panels: translucent white (56 to 86%), `backdrop-filter: saturate(170%) blur(22px)`, 1px white edge, blue-tinted shadow. This glass look is approved for this direction only, over the faint blue-sky background; do not extend it to other directions.
- Table: 13.5px, header 12.5px 600 muted on 55% white, 12 to 14px cell padding, hover row lifts to white, sticky first column plus an edge fade when columns overflow.
- Tabs: 4px-padded segmented strip, active tab is a white chip with a 1px shadow.
- Toast: fill navy `#101A29`, `theme="light"`, bottom-right.
- Motion: panels rise 10px with a 4px blur-in; switches use the spring ease `cubic-bezier(.34,1.56,.64,1)`; a live pill pulses a 6px ring.
- Empty: centred, 48px padding, muted line plus one button.

**Do:** use the gradient only on the primary button and one hero mark; keep copy human ("Good morning", "2 candidates are waiting for your review"); show progress as a step list with spinner and tick.
**Don't:** gradient text on more than one greeting, glass inside glass, more than one blue, tracked-out uppercase labels, emoji.

## Direction 2: Graphite editorial

For landing pages, docs and developer or builder tools. White paper, cool graphite ink, hairline rules, orange only on clickable things. Quiet, confident, closer to a magazine than a dashboard.

**Tokens (light).** bg `#FFFFFF`, well `#F3F4F6` (secondary fills, wells, window bars), fg `#16181D`, muted `#5B606B`, border `#E2E4E9`, primary and accent `#C4500F` (brand orange `#E7641D` gives white labels only 3.4:1, so the shipped light primary is the darker step), success `#13774E`, warning `#9A5B00`, danger `#C52020`. **Dark:** bg `#0F1114`, surface `#16191D`, well `#1B1E23`, fg `#EEEFF1`, muted `#A0A4AC`, border `#282C33`, primary `#FF7E33` with a `#111317` label. Selection tint: primary at 28%.

**Type.** Display face Schibsted Grotesk 700 to 800; body Geist 400 to 500; mono JetBrains Mono for eyebrows, chips, URLs, logs (11 to 13px). Product screens may set headings in a regular-weight serif (Instrument Serif) with the accent word in italic orange; marketing pages do not. Hero `clamp(2.6rem, 6.4vw, 5rem)` 800, line-height .98, tracking -0.045em, `max-width: 12ch`. Section h2 `clamp(1.9rem, 3.6vw, 2.75rem)` tracking -0.025em; closing h2 -0.04em. Lede 1.15rem muted, max 34rem.

**Shape.** Buttons `.55rem` radius (square-ish, not pills), chips `.35rem` with mono text, cards `.75rem`, inputs `.5rem`. No lift, no glow, no card shadow. The only shadow on the page is the product stage: `0 1px 2px rgb(22 24 29 / .06), 0 30px 60px -30px rgb(22 24 29 / .35)`. Page wrapper `76rem`, section rhythm `7rem` top padding, 4rem to 5rem column gaps, sticky heading column beside content.

**Components.**

```css
.lp { --background: 0 0% 100%; --foreground: 222 13% 10%; --border: 220 13% 90%; --primary: 21 81% 51%; }
.lp .btn { border-radius: .55rem; font-weight: 500; transition: background .15s, border-color .15s, color .15s; }
.lp .btn:hover { transform: none; border-color: hsl(var(--foreground) / .35); } /* no lift */
.stage-tabs button[aria-selected="true"] { color: var(--fg); border-bottom: 2px solid var(--fg); }
.sample-row { display: grid; gap: 1rem 2rem; padding: 1.5rem 0; border-bottom: 1px solid var(--border); }
@media (min-width: 44rem) { .sample-row { grid-template-columns: 17rem 1fr; } }
```

- Nav: sticky, 88% page colour with a 10px blur, one hairline below; links muted, the one orange button at the end.
- Stage: tab strip with underline on top, then a 16:9 frame with `.75rem` radius, 1px border, the stage shadow, holding the real product (an iframe scaled to fit); caption below in muted text. It animates in once (24px rise, .9s).
- Lists are rows between hairlines, not cards: thumbnail left, title (1.4rem display) and a muted line right, mono meta; hover underlines the title. FAQs are `details` with a plus that turns into a minus.
- Receipt and facts: definition lists on hairlines, 13rem label column, muted `dt`.
- Window chrome: bar on the well colour with a mono URL and a status chip.
- Toast: default `sileo` with `theme` following the site's theme toggle (dark pill on light, light pill on dark), bottom-right.
- Dark mode: toggle on `<html data-theme>`, set before paint, with a full second palette.

**Do:** let the live product be the hero image; use mono only for machine text; keep one orange element per viewport.
**Don't:** gradient blobs, pill badge above the headline, three-card feature rows, orange on non-interactive text, italic accent words on marketing headlines.

## Choosing between them

Product and candidate-facing work: navy. Marketing, docs and builder tools: graphite. When unsure, offer both as the first two directions and let the owner pick; a third direction comes from the brief. Copy is sentence case with specific verbs in both.
