# Analysis recipes (pandas)

## Read a workbook with several sheets

```python
import pandas as pd
sheets = pd.read_excel("data.xlsx", sheet_name=None, dtype=str)   # dict of DataFrames, all text
for name, df in sheets.items():
    print(name, df.shape)
```

Reading as text first and converting columns deliberately avoids silent type damage. If a header is not on row 1, pass `header=N`.

## Row accounting for cleaning

```python
def step(df, label, new):
    print(f"{label}: {len(df)} -> {len(new)} rows")
    return new

df = step(df, "drop blank ids", df[df["id"].notna()])
df = step(df, "dedupe", df.drop_duplicates(subset=["id"], keep="last"))
```

## Compare two exports (what changed)

```python
m = a.merge(b, on="id", how="outer", suffixes=("_a", "_b"), indicator=True)
only_a = m[m["_merge"] == "left_only"]
only_b = m[m["_merge"] == "right_only"]
both = m[m["_merge"] == "both"]
changed = both[both["amount_a"] != both["amount_b"]]
```

Report the three counts first, then samples.

## Join safety

```python
assert right["key"].is_unique, "right side has duplicate keys"
before = len(left)
out = left.merge(right, on="key", how="left", validate="many_to_one")
assert len(out) == before
```

## Outliers with a stated rule

```python
q1, q3 = s.quantile([0.25, 0.75]); iqr = q3 - q1
flag = (s < q1 - 1.5 * iqr) | (s > q3 + 1.5 * iqr)
```

List the flagged rows; do not delete them unless the owner agrees.

## Trend by period

```python
monthly = df.set_index("date").resample("MS")["amount"].sum()
change = monthly.pct_change()
```

Compare like with like (same number of working days) before calling a movement real.

## Group comparison with sizes

```python
g = df.groupby("segment")["value"].agg(["count", "median", "mean"]).sort_values("median", ascending=False)
```

## Coordinates check

```python
bad = df[~df["lat"].between(-90, 90) | ~df["lon"].between(-180, 180)]
swapped = df[df["lat"].abs() > 90]
```

## Chart (matplotlib)

```python
import matplotlib.pyplot as plt
ax = monthly.plot(kind="line", figsize=(8, 3.5), color="#1F3A5F")
ax.set_ylabel("Amount (USD)"); ax.set_xlabel(""); ax.spines[["top", "right"]].set_visible(False)
plt.tight_layout(); plt.savefig("trend.png", dpi=200)
```

For an HTML report, embed the PNG as a base64 data URI so the file stays self-contained.
