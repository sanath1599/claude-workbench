# openpyxl recipes

## Inputs sheet with a defined name

```python
from openpyxl import Workbook
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.styles import PatternFill, Font

wb = Workbook()
inp = wb.active; inp.title = "Inputs"
inp["A1"], inp["B1"] = "Tax rate", 0.18
inp["B1"].number_format = "0.0%"
inp["B1"].fill = PatternFill("solid", fgColor="FFF2CC")   # one colour for every input
wb.defined_names["tax_rate"] = DefinedName("tax_rate", attr_text="Inputs!$B$1")
ws = wb.create_sheet("Calc")
ws["C2"] = "=B2*(1+tax_rate)"
```

In openpyxl 3.1 `wb.defined_names` behaves like a dict. If the call fails on an older release, use `wb.defined_names.add(...)`.

## Number formats

| Content | Format |
|---|---|
| Whole currency | `#,##0` or `"$"#,##0` |
| Currency with cents | `#,##0.00` |
| Percent | `0.0%` |
| Date | `dd mmm yyyy` |
| Negative in brackets | `#,##0;(#,##0)` |

## Header, freeze, widths, print

```python
for c in ws[1]:
    c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="1F3A5F")
ws.freeze_panes = "A2"
ws.column_dimensions["A"].width = 28
ws.page_setup.orientation = "landscape"; ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
ws.sheet_properties.pageSetUpPr.fitToPage = True
ws.print_title_rows = "1:1"
```

## Data validation and conditional formatting

```python
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule
dv = DataValidation(type="list", formula1='"Open,In progress,Done"', allow_blank=False)
ws.add_data_validation(dv); dv.add("E2:E500")
ws.conditional_formatting.add("F2:F500", CellIsRule(operator="lessThan", formula=["0"], font=Font(color="C00000")))
```

## Reconciliation check cell

```python
ws["H1"] = "Check"
ws["I1"] = '=IF(ABS(SUM(Calc!C:C)-Summary!B5)<0.005,"OK","MISMATCH")'
```

## Chart

```python
from openpyxl.chart import BarChart, Reference
ch = BarChart(); ch.title = "Spend by month"; ch.y_axis.title = "Amount"
ch.add_data(Reference(ws, min_col=3, min_row=1, max_row=13), titles_from_data=True)
ch.set_categories(Reference(ws, min_col=1, min_row=2, max_row=13))
ws.add_chart(ch, "H3")
```

Charts survive in files built by openpyxl. They do not survive a load-and-save of a file that already holds charts, so edit a copy.

## Loading

`load_workbook(path)` keeps formulas. `load_workbook(path, data_only=True)` returns cached values and, if saved, destroys the formulas. Never save a workbook opened with `data_only=True`.
