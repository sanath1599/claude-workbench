# UI review checklist

Mark each item pass, fail or not applicable. Every fail needs a fix or a stated reason.

## Visual system
- [ ] All colours, radii, spacing, shadows and fonts come from tokens in one file.
- [ ] No hex or rgb literals in components or markup.
- [ ] One accent colour; state colours (success, warning, danger) are mid-tone and used only for state.
- [ ] Client brand colours and logo used when a client exists; light mode is the default for client and enterprise work.
- [ ] Type scale has at most 5 sizes and 2 to 3 weights; line length 45 to 80 characters for prose.
- [ ] Spacing follows a scale (4, 8, 12, 16, 24, 32); alignment is consistent on a grid.
- [ ] No gradients, glows or glass effects unless the owner asked.

## Content and copy
- [ ] Sentence case for headings, buttons, labels, toasts.
- [ ] Buttons say what they do. No "Submit", "OK" alone, "Click here".
- [ ] No emojis anywhere, including toasts and empty states.
- [ ] No lorem ipsum, no marketing adjectives, no invented metrics.
- [ ] Error messages say what happened and what to do next.

## Components
- [ ] Icons are Lucide, one stroke width, one size per context.
- [ ] Entity pickers are searchable comboboxes with inline "create new"; no native select or datalist.
- [ ] Toasts use sileo, bottom-right, sentence-case titles.
- [ ] Tables and lists have loading, empty and error states.
- [ ] Forms show validation inline, keep input on error, and disable submit while pending.
- [ ] No text is truncated without a "show more".
- [ ] Destructive actions ask for confirmation naming the item.

## Responsive
- [ ] Phone (375), iPad (768), desktop (1280, 1536) each laid out on purpose.
- [ ] No horizontal page scroll; tables scroll inside their container or restack.
- [ ] Tap targets at least 44 px; no hover-only controls.

## Accessibility
- [ ] Contrast 4.5:1 body, 3:1 large text and UI borders.
- [ ] Visible focus ring on every interactive element; logical tab order.
- [ ] Icons that carry meaning have labels; images have alt text.
- [ ] Dialogs trap focus, close on Escape, restore focus.
- [ ] Respects prefers-reduced-motion; no motion without purpose.

## Craft
- [ ] Hover, active, disabled and loading states for every control.
- [ ] Empty states say what the thing is and offer the next action.
- [ ] Console is clean (see design-studio:verifying-ui-in-browser).
