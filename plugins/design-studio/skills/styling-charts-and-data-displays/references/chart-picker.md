# Chart picker

| Question | Data shape | Use | When not | Notes |
| --- | --- | --- | --- | --- |
| How does it change over time? | one value per period | Line (area only for a single series) | fewer than four points (use a stat tile); more than five series | Mark the latest value; gaps stay gaps |
| How do categories compare? | one value per category | Horizontal bar, sorted | more than about fifteen categories (use a table) | Direct value labels |
| How are parts split? | two to four parts of a whole | Stacked bar or one 100 percent bar | many parts; parts that change over time (use stacked area) | Pie only for a single share of a whole |
| How did it change between two states? | before and after per category | Dumbbell or slope chart | many categories | Label both ends |
| Is there a relationship? | two numeric measures | Scatter | fewer than about thirty points | Add a trend line only if it is meaningful |
| How is it distributed? | many numeric values | Histogram or box plot | tiny samples | State the bin width |
| What is the current number? | single value with context | Stat tile with sparkline | no meaningful comparison period | Show delta and period |
| Where and how much? | value per region | Choropleth, or a sorted bar if precision matters | regions of very different areas | Bars are often clearer than maps |
| Progress against a target | one value, one goal | Bullet bar | many goals | Not a gauge |
| Flow between stages | counts per stage | Funnel as sorted bars with conversion percentages | non-sequential steps | Label the drop between stages |
| Exact lookup | rows and columns | Table | patterns matter more than values | Provide export |

## Colour roles

- Sequential data: one hue, light to dark. Diverging data: two hues with a neutral midpoint. Categorical: the chart tokens, five at most.
- Highlight one series: accent for the subject, muted grey for context.
- Missing and not applicable use hatching or an outlined empty cell, not a colour that looks like zero.
