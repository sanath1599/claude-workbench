---
type: llm
weight: 3
---

Pass if the assistant plans a workbook whose rates sit in labelled input cells, whose totals are formulas that reference those cells (no typed totals, no rates hidden inside formulas), and that it will recalculate the file and check for formula errors or missing cached values before delivery. Fail if totals are computed in Python and written as numbers.
