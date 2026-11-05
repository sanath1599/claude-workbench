#!/usr/bin/env python3
"""Profile a CSV, TSV or XLSX file with the standard library only.

Usage: python3 profile_table.py FILE [--sheet NAME] [--json]

Prints row and column counts, then per column: inferred type, blanks, distinct count,
min and max for numbers, and the most common values for text. Flags exact duplicate
rows, columns that are entirely blank, and numeric columns stored as text. XLSX files
are read from their cached values. Use pandas for anything beyond a first look.
"""
import csv
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def col_index(ref):
    letters = re.match(r"[A-Z]+", ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_xlsx(path, sheet=None):
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(NS + "si"):
            shared.append("".join(t.text or "" for t in si.iter(NS + "t")))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    chosen = None
    for s in wb.iter(NS + "sheet"):
        if sheet is None or s.get("name") == sheet:
            t = rels[s.get(REL + "id")].lstrip("/")
            chosen = t if t.startswith("xl/") else "xl/" + t
            break
    if chosen is None:
        raise SystemExit(f"sheet not found: {sheet}")
    rows = []
    for r in ET.fromstring(z.read(chosen)).iter(NS + "row"):
        row = []
        for c in r.iter(NS + "c"):
            i = col_index(c.get("r"))
            while len(row) <= i:
                row.append("")
            v = c.find(NS + "v")
            if c.get("t") == "s" and v is not None:
                row[i] = shared[int(v.text)]
            elif c.get("t") == "inlineStr":
                row[i] = "".join(t.text or "" for t in c.iter(NS + "t"))
            elif v is not None:
                row[i] = v.text or ""
        rows.append(row)
    return rows


def read_rows(path, sheet):
    if path.lower().endswith((".xlsx", ".xlsm")):
        return read_xlsx(path, sheet)
    with open(path, newline="", encoding="utf-8-sig") as f:
        sample = f.read(4096)
        f.seek(0)
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|") if sample else csv.excel
        return list(csv.reader(f, dialect))


def num(s):
    try:
        return float(s.replace(",", "")) if s.strip() else None
    except ValueError:
        return None


def profile(rows):
    if not rows:
        return {"rows": 0, "columns": []}
    header, data = rows[0], rows[1:]
    width = max(len(header), *(len(r) for r in data)) if data else len(header)
    header = header + [f"col{i + 1}" for i in range(len(header), width)]
    data = [r + [""] * (width - len(r)) for r in data]
    cols, notes = [], []
    for i, name in enumerate(header):
        vals = [r[i].strip() for r in data]
        filled = [v for v in vals if v != ""]
        nums = [num(v) for v in filled]
        numeric = bool(filled) and all(n is not None for n in nums)
        c = {"name": name or f"col{i + 1}", "blank": len(vals) - len(filled), "distinct": len(set(filled)),
             "type": "number" if numeric else "text" if filled else "empty"}
        if numeric:
            c["min"], c["max"] = min(nums), max(nums)
            if any(re.search(r"[,\s$%]", v) for v in filled):
                notes.append(f"column '{c['name']}' is numeric but stored with separators or symbols")
        elif filled:
            c["top"] = Counter(filled).most_common(3)
        else:
            notes.append(f"column '{c['name']}' is entirely blank")
        cols.append(c)
    dupes = len(data) - len({tuple(r) for r in data})
    if dupes:
        notes.append(f"{dupes} exact duplicate rows")
    return {"rows": len(data), "columns": cols, "notes": notes}


def main(argv):
    sheet = None
    if "--sheet" in argv:
        k = argv.index("--sheet")
        sheet = argv[k + 1]
        argv = argv[:k] + argv[k + 2:]
    args = [a for a in argv if not a.startswith("--")]
    if len(args) != 1:
        print(__doc__, file=sys.stderr)
        return 2
    r = profile(read_rows(args[0], sheet))
    if "--json" in argv:
        print(json.dumps(r, indent=2))
        return 0
    print(f"{r['rows']} rows, {len(r['columns'])} columns")
    for c in r["columns"]:
        extra = f"range {c['min']}..{c['max']}" if "min" in c else f"top {c.get('top', '')}"
        print(f"  {c['name']}: {c['type']}, {c['blank']} blank, {c['distinct']} distinct, {extra}")
    for n in r.get("notes", []):
        print("NOTE:", n)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
