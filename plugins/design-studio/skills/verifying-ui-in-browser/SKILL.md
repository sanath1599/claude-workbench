---
name: verifying-ui-in-browser
description: Use before saying any UI work is done, fixed or ready: a new screen, a layout fix, a mockup, a deployed page. Triggers on "does it look right", "check responsiveness", "fix the mobile view". Not for judging taste or style, which is designing-without-ai-slop, and not for unit or E2E test suites.
---

# Verifying UI in the browser

UI is not done until it has been seen in a browser at four widths with a clean console. Code that compiles proves nothing about layout.

## When to use

- You changed markup, CSS or components and are about to report it finished.
- The owner reports a broken layout on phone or iPad.
- Before sending a preview, a deck or README screenshots.

## When not to use

- Pure copy or logic changes with no visual effect.
- Reviewing taste: `design-studio:designing-without-ai-slop` and the `design-studio:design-critic` agent.
- Writing regression tests: use the project's test skills.

## Procedure

1. **Serve it.** Use the project's dev server, a local production build, or open the HTML file directly. Seed fictional data so lists are not empty, and also load the empty state.
2. **Pick the tool.** If the project has Playwright (`playwright` in package.json or importable), run `node scripts/shoot.mjs <url-or-file> --out ui-shots`. Otherwise use the chrome-devtools MCP tools: `resize_page`, `take_screenshot`, `list_console_messages`, `evaluate_script`.
   **Done when:** you have one screenshot each at 375, 768, 1280 and 1536 px wide.
3. **Look at every screenshot.** Open them with Read. Check:
   - no horizontal scroll (`scrollWidth` equals viewport width);
   - no text cut off without a "show more", no overlapping elements, no cramped tap targets (44 px minimum);
   - loading, empty and error states exist and look intentional;
   - phone and iPad layouts are designed, not merely squeezed.
4. **Check the console.** Zero errors and zero failed network requests. Warnings about missing keys or hydration count as errors.
5. **Check contrast and focus.** Body text needs 4.5:1 contrast against its background, large text 3:1, in light mode first and dark mode if offered. Tab through the page: focus is visible and moves in reading order; dialogs trap and restore focus; combobox opens with the keyboard.
6. **Interact once.** Click the main flow, open a dropdown and a toast. A toast appears bottom-right with a sentence-case title.
7. **Fix and repeat** from step 2 until clean. Report the screenshot paths and the summary line.
   **Done when:** `summary.json` reports `ok: true` (or you list each remaining problem), and you have viewed the images.

## Quick reference

| Check | Pass |
| --- | --- |
| Widths | 375, 768, 1280, 1536 |
| Console | 0 errors |
| Overflow | none on x-axis |
| Text | nothing truncated without "show more" |
| Contrast | 4.5:1 body, 3:1 large |
| Focus | visible, logical order |
| Maps and canvas | fresh `--user-data-dir`, `--disable-gpu` in headless Chrome |
| Background tabs | do not paint until screenshotted; screenshot before reading state |

## Rationalizations

| Excuse | Instead |
| --- | --- |
| "Build passed" | Passing builds say nothing about layout. Open it. |
| "Desktop looks fine" | The owner uses phone and iPad. Shoot 375 and 768. |
| "The console warning is harmless" | Fix it or say exactly why it is not. |
| "Playwright is not installed" | Use the chrome-devtools MCP tools; do not skip. |

## Verification

- [ ] Four screenshots viewed, paths reported.
- [ ] Console clean, no overflow, no silent truncation.
- [ ] Contrast and focus checked by hand.
- [ ] Empty and loading states seen.

## References

| File | Load when |
| --- | --- |
| scripts/shoot.mjs | running the screenshot sweep (`node scripts/shoot.mjs --help` style usage is in its header) |

## Versions

- playwright 1.64.1 (verified 2026-11-05, https://www.npmjs.com/package/playwright)
