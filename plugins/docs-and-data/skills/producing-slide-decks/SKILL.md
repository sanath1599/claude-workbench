---
name: producing-slide-decks
description: Use when the deliverable is a PowerPoint deck (.pptx): a client presentation, proposal deck or status review, or an existing .pptx must be read, restyled or extended from a template. Not for interactive guided demos (design-studio:presenting-guided-demos) or Claude's own slide artifact types.
---

# Producing slide decks

A deck carries one argument. Each slide has one message in its title, one piece of evidence under it, and the speaker's detail in the notes. The file must open in PowerPoint with real layouts, so the client can edit it.

## When to use

- A new .pptx, or changes to one.
- Pulling text, notes or the outline out of a deck to reuse elsewhere.
- Applying a client template (.potx or a master slide) to new content.

## When not to use

- Click-through product demos that copy the real UI: `design-studio:presenting-guided-demos`.
- A written report: `workbench:writing-deliverables`, or `producing-word-documents` when it must be Word.

## Procedure

### 1. Write the storyline first

Before any file: the audience, the decision or understanding you want at the end, and 5 to 12 slide titles that read as a complete argument when read alone ("Support tickets fell 31% after the rollout", not "Results"). For executives: plain words, acronyms spelled out once, the recommendation on slide 2 and the evidence after it. Client decks are confident; every number is traceable to a source you can name.

**Done when:** the list of titles tells the story without any slide body, and each slide has its one piece of evidence named (a chart, a table, a quote, a number).

### 2. Build with python-pptx

Check `python3 -c "import pptx"`; if it fails, use a virtual environment as in `producing-word-documents`. Rules:

- Start from the client's template, or from a blank file whose slide size you set on purpose (13.333 x 7.5 inches for 16:9). Use the layouts and placeholders (`prs.slide_layouts`, `slide.shapes.title`), so titles show in outline view and the master controls fonts and colours.
- One title, then at most 3 short points or one visual per slide. Aim for under 60 words on a slide; the inspector flags more than 90.
- Charts are native (`chart_data`, `add_chart`) so the client can edit the data. Tables are real tables. Screenshots only for UI.
- Every picture gets alt text (`pic._element.nvPicPr.cNvPr.set("descr", "...")`). Fonts are the template's; do not embed a font the client lacks.
- Speaker notes (`slide.notes_slide.notes_text_frame.text`) carry the talking points, sources and caveats, not the slide text again.
- Consistent margins, one accent colour from the client brand, left-aligned text, no decorative clip art, no bullets inside bullets.

**Done when:** the script writes the file and every slide uses a layout placeholder for its title.

### 3. Inspect and look

Run `python3 scripts/inspect_pptx.py deck.pptx`. It prints the outline with word counts and flags missing titles, slides over the word limit, pictures without alt text and placeholder text. Fix every PROBLEM line.

Then render: `soffice --headless --convert-to pdf --outdir /tmp/render deck.pptx`, then `pdftoppm -r 50 -png /tmp/render/deck.pdf /tmp/render/s`, and look at each image for overflow, text on busy backgrounds, and uneven spacing. LibreOffice may substitute fonts, so judge layout, not typography. Text that overflows its box here will overflow in PowerPoint too.

**Done when:** the inspector exits 0 and you looked at every slide image.

### 4. Hand over

Report the path, slide count, which slides have charts or tables, and that notes are in. If the client needs a PDF, it comes from PowerPoint, not LibreOffice, for the same reason as Word.

## Reading or reusing a deck

`inspect_pptx.py --json` gives titles and word counts. For full text, loop over `prs.slides` and `shape.text_frame`; include `slide.notes_slide` when notes matter. Group shapes hide text, so walk `shape.shapes` recursively.

## Quick reference

| Slide type | Content |
|---|---|
| Recommendation | the ask in the title, three reasons below, the cost and the date |
| Evidence | claim as title, one chart or table, source line in small text |
| Comparison | table with the same rows for each option, the pick marked |
| Timeline | 4 to 6 steps with dates and owners |
| Close | decisions needed, next steps with owners |

## Verification

- [ ] Titles alone tell the story.
- [ ] Inspector exits 0; every slide was viewed as an image.
- [ ] Charts are native; pictures have alt text.
- [ ] Notes hold the detail; slides hold one message each.
- [ ] No placeholder text; numbers match their sources.

## Versions

- python-pptx 1.0.2 (verified 2026-11-05, https://pypi.org/project/python-pptx/)
- Read https://python-pptx.readthedocs.io before using an API you have not used in this session.
