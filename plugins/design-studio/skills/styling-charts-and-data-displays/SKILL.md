---
name: styling-charts-and-data-displays
description: Use when adding a chart, graph, KPI tile, sparkline or data table to a dashboard or report, or when asked which chart fits some data. Triggers on "show this as a chart", "dashboard", "analytics page", "visualise". Not for palette or font choice (choosing-type-and-color) or for the page's overall taste review (designing-without-ai-slop).
---

# Styling charts and data displays

A chart answers one question. Choose the form from the question and the shape of the data, colour it from the project tokens, and make it readable without colour and without a mouse.

## When to use

- A dashboard, report, admin overview or executive summary needs visuals.
- Someone asks "which chart should this be?".
- A chart looks busy, uses default library colours, or cannot be read by keyboard.

## When not to use

- Choosing the brand palette itself: `design-studio:choosing-type-and-color` (its tokens file already has `--chart-1` to `--chart-5`).
- Analysing a CSV to find the answer first: use the data skills, then come back here to present it.
- Presenting a finished app to an audience: `design-studio:presenting-guided-demos`.

## Procedure

1. **Write the question.** One sentence: "Are signups growing?" or "Which region is slowest?". A chart without a question becomes decoration.
   **Done when:** each chart on the page has a question and a title that states the answer or the metric, not "Chart 1".
2. **Choose the form from the data** with the table in `references/chart-picker.md`. Short version: change over time is a line; compare categories is a horizontal bar sorted by value; part of a whole with two to four parts is a stacked bar or a single number, almost never a pie; relationship between two measures is a scatter; one number with context is a stat tile with a sparkline; exact values are a table.
   **Done when:** the form is chosen and the "when not" column for it was read.
3. **Pick the library by the job.** Recharts for ordinary React dashboards; ECharts for large data, maps or many chart types; uPlot for real-time series with thousands of points; TanStack Table for tables. One charting library per project. Read the library's current docs before using its API.
4. **Colour from tokens.** Series colours are `var(--chart-1)` to `var(--chart-5)`; axis text and gridlines use `--color-muted` and `--color-border`. No library default palette. One highlighted series in the accent and the rest in muted grey beats five colours.
   - Never rely on colour alone: add direct labels at line ends, different line dash patterns, or markers.
   - No more than five series; group the tail into "Other".
   - Status colours mean status only (success, warning, danger); do not reuse them as categories.
5. **Draw plainly.** Start bar axes at zero. Remove chart borders, 3D, shadows and gradient fills. Light gridlines, few ticks, number format with units and thousands separators, tabular numerals. Titles and axis labels in sentence case.
6. **Make it accessible.** Give each chart a text summary of the finding (`aria-describedby`), a visible "View as table" toggle or the table beneath it, and keyboard-reachable tooltips. Tooltips show on focus as well as hover. Respect `prefers-reduced-motion` for entry animation; charts should draw in under 400 ms or not animate.
7. **Cover every state.** Loading (skeleton in the chart's shape), empty ("No signups in this period" with the next action), error (what failed and a retry), and a single-data-point case. Test a long category label and a very large number.
8. **Lay out for phones.** Charts keep an aspect ratio, labels rotate or switch to horizontal bars, legends move below, and tables scroll inside their container. Check at 375 and 768 with `design-studio:verifying-ui-in-browser`.
   **Done when:** every chart passes the verification list below at four widths.

## Stat tiles and tables

- A stat tile has the number large, a label in muted text, a delta with an arrow icon and a sign (never colour alone), and the period. No decorative icon in a coloured circle.
- Tables: left-align text, right-align numbers, tabular numerals, sticky header, row height 40 to 48 px, zebra striping only if rows are wide, sort and filter in the header, column visibility menu on narrow screens. Do not truncate cell text without a way to read it all.

## Quick reference

| Do | Not |
| --- | --- |
| Sorted horizontal bars for rankings | Pie with eight slices |
| Direct labels | Legend of five similar blues |
| Zero baseline on bars | Truncated axis that exaggerates |
| Table toggle beside each chart | Chart as the only way to get the numbers |
| Chart tokens from the tokens file | Library default colours |

## Rationalizations

| Excuse | Instead |
| --- | --- |
| "A donut looks nicer" | Use it only for one share of a whole; otherwise a bar reads faster. |
| "The legend is enough" | Colour-blind readers and print: label directly. |
| "The tooltip has the values" | Touch and keyboard users cannot hover; provide the table. |
| "Animate it so it feels alive" | Short, once, and skipped under reduced motion. |

## Verification

- [ ] Each chart has a question, a descriptive title and a text summary.
- [ ] Series colours come from tokens; meaning survives greyscale.
- [ ] Table alternative and keyboard-reachable tooltips exist.
- [ ] Loading, empty, error and one-point states checked.
- [ ] Readable at 375 and 768; no horizontal page scroll.

## References

| File | Load when |
| --- | --- |
| references/chart-picker.md | choosing the chart form for a given data shape |

## Versions

- recharts 3.10.1 (verified 2026-11-05, https://www.npmjs.com/package/recharts)
- echarts 6.1.0 (verified 2026-11-05, https://www.npmjs.com/package/echarts)
- uplot 1.6.32 (verified 2026-11-05, https://www.npmjs.com/package/uplot)
- @tanstack/react-table 9.3.1 (verified 2026-11-05, https://www.npmjs.com/package/@tanstack/react-table)
