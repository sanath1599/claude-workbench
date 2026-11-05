---
name: producing-spreadsheets
description: Use when the deliverable is an Excel workbook (.xlsx) with calculations, such as a budget, allocation model, tracker or client schedule where totals must update when inputs change, or when an existing .xlsx must be edited without losing its formulas. Not for analysing data to find an answer (analysing-tabular-data) or for Google Sheets.
---

# Producing spreadsheets

A workbook that holds typed totals is a report, not a model. Every derived number is a formula that points at an input cell, the inputs are in one place, and the file is recalculated and checked before it leaves.

## When to use

- A new .xlsx where anything is computed: totals, shares, allocations, schedules, scenarios.
- Editing a client workbook that already has formulas, named ranges, validation or charts.
- Converting a CSV into a formatted, formula-driven workbook.

## When not to use

- Exploring data to answer a question: `analysing-tabular-data` (it may end in a workbook, which comes back here).
- A flat export that needs no formulas: write a CSV.
- Google Sheets: use the Google Drive connector's own guidance.

## Procedure

### 1. Design the sheets on paper

List the sheets: `Inputs` (assumptions, one value per labelled cell, shaded), the data or calculation sheets, and `Summary` for what the reader opens first. Decide the units and currency once and write them in the label, not in each cell. Executive readers get the summary first and plain headings with no abbreviations they have not met.

**Done when:** you can list each sheet, its purpose, and which cells are inputs.

### 2. Build with openpyxl

Check `python3 -c "import openpyxl"`; if it fails, use a virtual environment as in `producing-word-documents`. Rules:

- Write formulas as strings (`ws["D5"] = "=B5*C5"`). Never compute a value in Python and write the number, except for raw input data.
- Reference inputs by cell or by a defined name (`wb.defined_names`), never by a literal inside a formula. `=B5*1.18` hides an assumption; `=B5*(1+Inputs!$B$3)` shows it.
- Use ranges that grow with the data (whole columns in `SUMIFS`, or Excel tables) when rows will be added.
- Prefer functions that exist in every Excel version in use (`SUMIFS`, `INDEX/MATCH`, `IFERROR`). Dynamic-array functions (`FILTER`, `XLOOKUP`) are fine only if the client has Microsoft 365; ask or avoid.
- Cross-sheet references quote names with spaces: `='Q1 Plan'!B4`.
- Formatting by style, not by cell: number formats (`#,##0`, `0.0%`), a consistent input colour, frozen header row, column widths, print area and landscape for wide sheets. Recipes: `references/openpyxl-recipes.md`.
- Data validation on input cells (lists, ranges) and a visible check cell that reads OK when totals reconcile.
- openpyxl keeps formulas it did not touch, but loses charts and images it cannot read when it loads an existing file. For a client file with those, edit a copy and compare before and after.

**Done when:** the script writes the file and the only constants in calculation sheets are labelled inputs.

### 3. Recalculate, then check

openpyxl writes no cached values, so viewers that do not calculate (previews, some converters) show blanks. Recalculate with LibreOffice into a new file:

```bash
soffice --headless --calc --convert-to xlsx --outdir recalculated out.xlsx
python3 scripts/check_xlsx.py recalculated/out.xlsx
```

`check_xlsx.py` counts formulas and constants per sheet and fails on error values (`#REF!`, `#DIV/0!`, `#NAME?`), formulas with no cached value, and references to missing sheets. Then spot-check three numbers by hand (a total, a ratio, a boundary case) against the source data.

If the client's Excel will open the original, deliver the recalculated copy anyway: it has cached values and the same formulas. Confirm formulas survived by running the checker again on it and comparing the formula counts with the original.

**Done when:** the checker exits 0 on the file you deliver and three numbers were verified independently.

### 4. Hand over

Say what the inputs are and where, what the check cell shows, which Excel features are used, and that the file was recalculated with LibreOffice and not opened in Excel unless it was.

## Rationalizations

| Excuse | Instead |
|---|---|
| "Pandas already computed the total." | Write the formula. The client will change an input and the total must follow. |
| "I'll type the number, it is a one-off." | One-offs get reused. Make it an input cell. |
| "The checker shows uncached values, Excel will fix that." | Excel will, previews will not. Recalculate and deliver that file. |
| "Merged cells look tidier." | They break sorting, filtering and copy. Use centre-across-selection. |

## Verification

- [ ] Inputs are on one sheet, labelled, with units.
- [ ] No literal assumptions inside formulas.
- [ ] `check_xlsx.py` exits 0 on the delivered file.
- [ ] Three outputs were verified by hand against the source.
- [ ] Header row frozen, widths set, print setup done for sheets that will be printed.

## References

| File | Load when |
|---|---|
| references/openpyxl-recipes.md | styles, number formats, validation, conditional formatting, charts, defined names |

## Versions

- openpyxl 3.1.5 (verified 2026-11-05, https://pypi.org/project/openpyxl/)
- LibreOffice headless (`soffice`) for recalculation; check `soffice --version` on the machine.
- Read https://openpyxl.readthedocs.io before using an API not shown in the recipes.
