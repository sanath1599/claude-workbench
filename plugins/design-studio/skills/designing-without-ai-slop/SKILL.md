---
name: designing-without-ai-slop
description: Use when designing, styling or reviewing any UI, landing page, dashboard or component, or when the owner says the UI looks generic, "AI slop", ugly, or asks for modern and minimal. Not for approval-gating a new product (previewing-ui-before-building) or for browser checks (verifying-ui-in-browser).
---

# Designing without AI slop

The owner wants modern, minimal, intentional UI. Slop is what appears when defaults are accepted: it looks like every other generated page. Make fewer, deliberate choices.

## When to use

- Writing or restyling any screen, component or page.
- Reviewing a page, mockup or screenshots.
- The owner says "I hate the UI", "make it minimal" or "less like AI slop".

## When not to use

- Deciding whether a mockup is needed first: `design-studio:previewing-ui-before-building`.
- Proving the page works at all widths: `design-studio:verifying-ui-in-browser`.

## Procedure

1. **Start from the house style** (`references/house-style.md`: "Navy professional" or "Graphite editorial", tokens in `assets/house-tokens.css`) unless a client brand or the brief says otherwise. **Gather direction.** Use `design-studio:choosing-type-and-color` for the palette, fonts and tokens file, and `design-studio:adding-motion-and-3d` only if motion is requested. Take the results as inputs, then apply the rules below, which win on conflict. Before any markup, write a compact plan: four to six named colour values, the type roles, a layout idea in one sentence with an ASCII wireframe, and two or three principles. Then test the plan: if you would arrive at the same plan for any similar product, change the part that is generic and say what you changed. Spend boldness in one place: one memorable element, everything around it quiet.
   **Done when:** you can name one palette, one type pair and one layout idea, and why they suit this product.
2. **Set tokens.** One tokens file: colour, type scale, spacing, radius, shadow. Components never contain hex. Use the client's colours and logo when there is a client; default to light mode for client and enterprise work.
3. **Apply the taste rules.**
   - Modern and minimal: fewer elements, more whitespace, one accent colour, a clear type hierarchy with two weights doing most of the work.
   - Lucide icons only. No emojis anywhere in UI, including empty states, buttons and toasts.
   - Sentence-case copy for headings, buttons and toasts. Specific verbs ("Save changes"), not "Submit".
   - Entity pickers are custom searchable comboboxes with inline "create new". Never native `<select>` or `<datalist>`.
   - Glass or blur effects only when the owner asked.
   - Toasts use `sileo`, bottom-right, mid-tone state colours.
   - Every list and form has explicit loading, empty and error states.
   - Text is never truncated without a "show more".
   - Responsive on phone, iPad and desktop by design, not by shrinking.
   - Copy names things by what users understand, not by how the system is built. An action keeps one name through the flow (the button "Publish" yields the toast "Published"). Errors say what happened and how to fix it, and do not apologise. Empty screens invite the next action.
   - Charts follow `design-studio:styling-charts-and-data-displays`.
4. **Sweep for slop tells** (list below), then run the full checklist in `references/checklist.md`.
5. **Get a second read.** Dispatch the `design-studio:design-critic` agent on the file or screenshots; fix every high finding.
   **Done when:** the critic returns no high findings and the checklist has no unchecked items.

## Slop tells

- Purple-to-blue gradients, glowing blobs, gradient text on headings.
- Emoji as icons or bullets; icon in a tinted circle on every card.
- Three identical feature cards in a row with a bold title and two grey lines.
- Everything centred; rounded-2xl on everything; a shadow on every card.
- Hero with a pill badge ("New") above the headline and two buttons.
- Generic copy: "Seamless", "Supercharge", "Unlock", "Elevate".
- Fake metrics ("10x faster", "99.9%") and stock testimonials.
- Default font stacks and default Tailwind palette untouched.
- Native `<select>`, browser-default focus and scrollbars next to a styled UI.
- Dark mode with neon accents by default for a business tool.

Also read as generated: the defaults below are legitimate only when the brief asks for them. If the brief leaves the axis free, do not spend it on a default.

- A warm cream page with a high-contrast serif headline and a terracotta accent.
- Near-black page with one acid-green or vermilion accent.
- Newspaper layout (hairline rules, zero radius, dense columns) used regardless of subject.
- The same border radius and the same soft grey shadow on every card, whatever its importance.
- Tracked-out uppercase labels above every heading; meta strings joined with middle dots; labels shaped like "WORD - fragment"; arrows appended to link text.
- Numbered markers (01, 02, 03) on content that is not a sequence.
- One word of a headline picked out in italic or colour.

## Quick reference

| Do | Not |
| --- | --- |
| one accent, neutral surfaces | gradient backgrounds |
| Lucide SVG | emoji, icon fonts mixed |
| real fictional content | lorem ipsum |
| tokens | hex in components |
| combobox with create new | native select |

## Rationalizations

| Excuse | Instead |
| --- | --- |
| "A gradient makes it modern" | It makes it look generated. Use one accent and space. |
| "An emoji is friendlier" | Not in this owner's UI. Use a Lucide icon or nothing. |
| "The design skill suggested it" | Skills are input; these rules win. |

## Verification

- [ ] `references/checklist.md` fully walked.
- [ ] No hex outside tokens, no emoji, no native select.
- [ ] Critic findings at high severity are fixed.

## References

| File | Load when |
| --- | --- |
| references/house-style.md | starting any UI with no client brand, or the owner says "like the interview platform" or "like Animated Technical Interactive" |
| assets/house-tokens.css | writing the tokens file for a house-style UI |
| references/checklist.md | the final review pass |
