---
name: producing-word-documents
description: Use when the deliverable is a Word document (.docx): a client proposal, report, letter, SOW or spec that will be sent as Word or exported to PDF from Word, or when an existing .docx must be read, edited or filled in. Not for shareable reports and demos (those are self-contained HTML, workbench:writing-deliverables), nor for PDFs (working-with-pdfs).
---

# Producing Word documents

A client document is judged on two things: the words, and whether it looks like a person with taste made it in Word. Build it with real styles and real fields so that Word, not your script, decides the layout. Page numbers only match the owner's PDF if Word paginates the file.

## When to use

- A new .docx is asked for, or a PDF "exported from Word".
- An existing .docx must be changed, filled from a template, or read.
- A table of contents, page numbers, headers and footers, or a cover page are involved.

## When not to use

- Reports, handoffs and demos for sharing: one self-contained HTML file (`workbench:writing-deliverables`).
- Editing or extracting a PDF: `working-with-pdfs`.
- Tables of numbers that need formulas: `producing-spreadsheets`.

## Procedure

### 1. Settle the content before the file

Write the outline and every section's text first, as the reader-facing content, using `workbench:writing-deliverables` for tone. Executive and client documents are plain and confident, with acronyms spelled out at first use. If a template or earlier version exists, open it and copy its styles instead of inventing new ones.

**Done when:** headings, order and text are agreed or obviously unambiguous, and the template (if any) is identified.

### 2. Build with python-docx

Check `python3 -c "import docx"`. If it fails, install it in a virtual environment (`python3 -m venv .venv && .venv/bin/pip install python-docx`) and run the script with that interpreter. Rules for the build script:

- Start from the template file or from `Document()`, and set the fonts, sizes and spacing once on the `Normal`, `Heading 1-3`, `Title` and `Table Grid` styles. Never format by hand on each paragraph.
- Use heading styles for every heading, `List Bullet` and `List Number` for lists, and a caption style for table and figure captions. A document with direct formatting only has an empty navigation pane.
- Put the table of contents and page numbers in as fields (recipes in `references/python-docx-recipes.md`). Never type a page number.
- Control page breaks with `page_break_before` on a style or paragraph, and keep a heading with its next paragraph (`keep_with_next`). Never add blank paragraphs to push content down.
- Tables: header row repeated across pages, fixed column widths, numbers right-aligned, no merged cells in data tables.
- Images are inserted at a stated width with alt text. Logos and colours come from the client brand when given.
- Core properties (title, author, subject) are set so the PDF metadata is right.

**Done when:** the script runs end to end and writes the file to the path you will report.

### 3. Inspect it

Run `python3 scripts/inspect_docx.py out.docx`. It reports headings, tables, images, whether a PAGE field and a TOC field exist, leftover placeholder text, stacked empty paragraphs and typed page numbers. Fix every PROBLEM line.

Then render for a visual check. LibreOffice can convert to PDF (`soffice --headless --convert-to pdf --outdir /tmp/render out.docx`), then `pdftoppm -r 60 -png` and look at the pages. Judge spacing, table breaks, and orphaned headings. Do not judge pagination: LibreOffice breaks pages differently from Word.

**Done when:** the inspector exits 0 and you have looked at every page image.

### 4. Hand over, with the page-number rule

- Say that the contents list and page numbers are fields that Word updates when the file opens (accept the update prompt) or when the owner presses Ctrl+A then F9.
- Say that the final PDF must be exported from Word (File, Export, PDF) after that update, so the printed page numbers match the contents list. Never send a LibreOffice-rendered PDF as the final.
- Give the file path and the page count Word will show only if you have it from Word. Otherwise say it is unconfirmed.

**Done when:** the reply names the file path, the update-fields step and the export step.

## Editing an existing document

Unzip nothing by hand unless python-docx cannot do it. Open, change runs in place so formatting survives, save under a new name, then inspect. For find-and-replace, join the runs of a paragraph, because a word is often split across runs. Tracked changes and comments are not supported by python-docx; if they are needed, tell the owner and offer to write a change list instead.

## Quick reference

| Need | Do |
|---|---|
| Contents list | TOC field with `\o "1-3" \h \z \u`, plus `updateFields` in settings |
| Page X of Y | PAGE and NUMPAGES fields in the footer |
| Different first page | `section.different_first_page_header_footer = True` |
| Landscape table | new section with swapped page width and height |
| Brand colour | set once on styles, as RGB |
| Executive tone | outcome first, plain words, numbers with units |

## Verification

- [ ] Every heading uses a heading style; no typed numbering on headings unless the client wants it.
- [ ] PAGE and TOC are fields; `inspect_docx.py` exits 0.
- [ ] No placeholder text, no blank-line spacing, no hardcoded page numbers.
- [ ] Page images were looked at; the handover names the Word export step.
- [ ] No secrets, personal data or another client's details in the file.

## References

| File | Load when |
|---|---|
| references/python-docx-recipes.md | adding fields, footers, repeated table headers, styles or sections |

## Versions

- python-docx 1.2.0 (verified 2026-11-05, https://pypi.org/project/python-docx/)
- Read the current docs at https://python-docx.readthedocs.io before using an API not shown in the recipes.
