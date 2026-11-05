---
name: working-with-pdfs
description: Use when a PDF is the input or must be changed: extracting text or tables, merging, splitting, rotating, stamping, filling a form, redacting, reading a scanned file, or making a PDF from content. Not for producing a client document (producing-word-documents, exported from Word) or a shareable report (self-contained HTML).
---

# Working with PDFs

Find out what kind of PDF it is before choosing a tool. A text PDF is read directly, a scanned one needs OCR, and a form has fields. Creating a PDF is usually the last step of a Word or HTML deliverable, not a separate craft.

## When to use

- Reading, searching or pulling tables from a PDF.
- Merge, split, reorder, rotate, crop, watermark, page numbers, metadata.
- Filling a form, or redacting text.
- Turning a PDF into data or into images.

## When not to use

- A client document with matching page numbers: build the .docx and export from Word (`producing-word-documents`).
- A report to share: one self-contained HTML file.

## Procedure

### 1. Probe it

```bash
python3 scripts/pdf_probe.py file.pdf
```

The verdict is `text`, `scanned`, `mixed` or `encrypted`, with the pages that have no text layer. Also open page one as an image (`pdftoppm -r 60 -f 1 -l 1 -png file.pdf /tmp/p`) when layout matters.

**Done when:** you know the page count, the verdict, and whether the file has form fields.

### 2. Choose the tool

| Task | Tool |
|---|---|
| Plain text in reading order | `pdftotext -layout file.pdf -` (poppler) |
| Text with positions, tables | `pdfplumber` (`page.extract_tables()`); check the first result by eye |
| Merge, split, rotate, crop, metadata, encrypt, decrypt | `pypdf` |
| Form fields | `pypdf` (`reader.get_fields()`, `writer.update_page_form_field_values`) |
| Pages to images | `pdftoppm -r 150 -png` |
| Scanned pages | OCR with `ocrmypdf` (adds a text layer), or `tesseract` on page images |
| Create from HTML | print to PDF from a browser (Playwright `page.pdf()`) |
| Redaction | rasterise the page or use a redaction tool; drawing a black box does not remove the text |

Install missing Python packages in a virtual environment. Poppler and tesseract come from the system package manager (`brew install poppler tesseract`).

### 3. Do the work on a copy

Never write over the original. Name outputs after the operation (`file.merged.pdf`). For batch jobs, run on one file first and look at the result.

**Done when:** the output exists beside the original and the page count matches what you expect.

### 4. Check the result

- Merge or split: page counts add up; open the first and last page of each part as images.
- Extraction: spot-check three values against the page image. Tables that span pages need their header rows handled.
- Form fill: re-read the fields from the output and compare with the input values. Some viewers show stale appearances until the form is flattened or `NeedAppearances` is set.
- Redaction: extract text from the output and search for the removed string. It must not be found.
- Encrypted files: only decrypt files the owner has the right to open, and never log a password.

**Done when:** each check above that applies was run and its output seen.

## Rationalizations

| Excuse | Instead |
|---|---|
| "The text came out, so it is fine." | Scanned files give empty or garbage text. Probe first. |
| "A black rectangle redacts it." | The text stays underneath. Remove it and verify with extraction. |
| "I'll export the Word doc through LibreOffice." | Pagination differs from Word. Export from Word. |

## Verification

- [ ] The original is untouched.
- [ ] Output page count and spot checks match.
- [ ] Redactions verified by text search.
- [ ] No passwords or document contents echoed into logs.

## Versions

- pypdf 6.21.4 (verified 2026-11-05, https://pypi.org/project/pypdf/)
- pdfplumber 0.11.10 (verified 2026-11-05, https://pypi.org/project/pdfplumber/)
- poppler utilities (`pdftotext`, `pdftoppm`, `pdfinfo`) from the system package manager.
