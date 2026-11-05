---
name: analysing-tabular-data
description: Use when a question must be answered from a spreadsheet, CSV or exported table (what drives this, who is over allocation, where do values cluster, what changed between two files), or when messy tabular data needs cleaning before use. Not for building a formula-driven client workbook (producing-spreadsheets) or SQL warehouse work.
---

# Analysing tabular data

An analysis is a claim with its evidence. Profile the data, state the question as something that can be wrong, compute with pandas, and check the answer against the raw rows before it is shown to anyone.

## When to use

- A question that a spreadsheet, CSV or export should answer.
- Cleaning, reshaping or reconciling tables (allocations, rosters, maps with coordinates, exports from two systems).
- Producing charts or a summary table for a report.

## When not to use

- A deliverable workbook with live formulas: `producing-spreadsheets`.
- Charts as the main product: follow the `dataviz` skill for colour and layout if it is available.
- Database queries: `stack-python:modeling-data-in-postgres`.

## Procedure

### 1. Profile before thinking

```bash
python3 scripts/profile_table.py data.xlsx            # or .csv / .tsv, --sheet NAME
```

It lists rows, column types, blanks, distinct counts, ranges, duplicate rows and numbers stored as text. For workbooks with several sheets, list the sheets first, then profile each one that matters.

**Done when:** you can state the grain of the table (one row is one what) and which columns are keys.

### 2. State the question

Write the question and what answer would change a decision. Name the metric precisely (count of what, over which period, excluding what). If the question is vague and the answer changes the work, ask once, in a batch of at most four questions with a recommended default for each (the workbench house rules). Otherwise pick the reading, state it in one line, and go.

**Done when:** the question, the metric definition and the filters are written down.

### 3. Load and clean with pandas

Check `python3 -c "import pandas"`; if it fails, use a virtual environment (`.venv/bin/pip install pandas openpyxl`).

- Read with explicit types for ids, dates and codes (`dtype={"id": str}`, `parse_dates=[...]`); a leading-zero code read as a number is a classic corruption.
- Make cleaning a visible script, not clicks. Each step logs rows in and rows out: trimming whitespace, normalising case, parsing dates and numbers, dropping duplicates, handling blanks.
- Never silently drop rows. Count them and list a sample.
- Keep the raw file untouched; write cleaned data to a new file.

**Done when:** the script runs from raw to clean and prints the row counts at each step.

### 4. Compute

- Start with the simple version: group, count, sum, rank, pivot. Use statistics only when they answer the question. Medians and percentiles beat means for skewed data; report the denominator for every rate.
- Comparisons between groups need group sizes next to every difference. A 20% difference between groups of 4 and 6 is a note, not a finding.
- Joins: check the key is unique on the side you expect, and compare row counts before and after the join.
- Allocation and optimisation problems: write the constraints in plain language first, solve, then verify every constraint on the output.
- Maps and coordinates: validate latitude and longitude ranges, swap risk, and units before plotting.

**Done when:** the answer exists as a table or number, and the code that produced it can be re-run.

### 5. Check the answer

Before presenting, do all four:

1. Recompute one headline number a second way (a different grouping, or by hand from five raw rows).
2. Check that parts sum to the total and that percentages use the stated denominator.
3. Look for what the result would look like if it were wrong: a filter that dropped a category, a join that duplicated rows, a time zone shift.
4. Say what the data cannot show (missing periods, self-reported fields, survivors only).

**Done when:** the second computation matches and the limits are written.

### 6. Present

Lead with the answer in one sentence and the number. Then the table or chart that proves it, then the limits, then the next question. Choose the chart from the question: trend is a line, comparison is sorted bars, composition is a stacked bar or a table, relationship is a scatter. Label axes with units; no 3D, no dual axes. A deliverable that will be shared goes into a self-contained HTML file (`workbench:writing-deliverables`). Save the cleaning script and say where outputs went.

## Quick reference

| Symptom | Likely cause |
|---|---|
| Totals differ between two views | duplicate rows from a join, or different filters |
| Percentages over 100 | numerator and denominator at different grain |
| Dates off by one day | time zone conversion on a date-only column |
| Counts lower than expected | blanks dropped by `groupby` (use `dropna=False`) |
| Numbers become text | thousands separators, currency symbols or a stray footer row |

## Verification

- [ ] The grain, question and metric definition are written down.
- [ ] Cleaning is a script with row counts; raw data untouched.
- [ ] Headline number recomputed a second way.
- [ ] Group sizes shown beside differences; limits stated.
- [ ] Outputs and script paths reported.

## References

| File | Load when |
|---|---|
| references/analysis-recipes.md | pandas snippets for dedupe, reconciliation, outliers, trend, and charts |

## Versions

- pandas 3.1.1 (verified 2026-11-05, https://pypi.org/project/pandas/)
- Read https://pandas.pydata.org/docs/ before using an API you have not used in this session; pandas 3 changed copy-on-write and string dtype defaults.
