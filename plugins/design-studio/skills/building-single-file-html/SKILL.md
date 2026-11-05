---
name: building-single-file-html
description: Use when producing one self-contained HTML file (offline deck, report, preview or demo) that must work by email, from file:// or in a sandbox, especially when a script inlines scripts, data and images or a model supplies screen markup. Not for pre-build design approval (previewing-ui-before-building) or the guided-tour format (presenting-guided-demos).
---

# Building single-file HTML

One file, no network, a known size. A build script fills placeholders in a source page, inlines everything, counts bytes and scans for leftovers.

## When to use

- A deliverable must open offline, by email, from `file://` or in a sandboxed viewer.
- A build script assembles a page from source, data and images.
- A model writes the markup for individual screens that you assemble into one page.

## When not to use

- Approval mockups before a build: `previewing-ui-before-building` (it ships its own template).
- A tour with highlights and popovers: `presenting-guided-demos`.
- Serving untrusted generated HTML on a live site: `engineering-craft:reviewing-security`.

## Procedure

1. **Write a source page with placeholders** that the build fills: `/*__JS__*/` and `/*__DATA__*/null`. Use function replacers (`str.replace(token, () => value)`) so `$` sequences in the value are not interpreted. Print the final size at the end of the build.
2. **Escape inlined content.** JSON in `<script type="application/json">`: escape `<` as `\u003c` and U+2028 and U+2029. Inline script text: replace `</script` with `<\/script` and `<!--` with `<\!--`.
3. **Inline assets as `data:` URIs under a byte budget.** Base64 adds a third and every occurrence is a full copy, so count each use. Pass each read the budget that is left (`remaining * 3/4`). Replace anything that does not fit with a 1x1 transparent GIF and add a reported "missing" entry. Never leave a network URL as the fallback.
4. **Fonts.** Name the product's font stack with a generic fallback; do not load from the network.
5. **Scope generated markup** when a model supplies screens. See `references/embedding-generated-markup.md`.
6. **Scan for leftovers.** Search the output for `https?://` in `src`, `href` (stylesheet), `url()` and `@import`. Every hit is fixed or justified.
7. **Verify.** Open the built file with the network blocked, using `design-studio:verifying-ui-in-browser` (`references/offline-artifacts.md` there).

**Done when:** the build prints a size under budget, the leftover scan is empty, and the file renders with the network blocked.

## Quick reference

| Concern | Rule |
|---|---|
| Placeholders | function replacers, never string replacement values |
| JSON in HTML | escape `<` and U+2028/2029 |
| Images | `data:` URIs counted against the budget; 1x1 GIF plus "missing" report on overflow |
| Fonts | named stack plus generic fallback |
| Network | none; scan output before shipping |

## Verification

- [ ] Final size printed and within budget.
- [ ] No external URL in `src`, stylesheet `href`, `url()` or `@import`.
- [ ] Generated markup scoped, scripts stripped.
- [ ] Rendered offline at desktop and phone width.

## References

| File | Load when |
|---|---|
| references/embedding-generated-markup.md | a model supplies HTML or CSS per screen |
