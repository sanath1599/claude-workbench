#!/usr/bin/env python3
"""Audit a .xlsx for live formulas using only the standard library.

Usage: python3 check_xlsx.py FILE.xlsx [--json]

Per sheet: formula cells, constant numeric cells, formula cells with no cached value
(never recalculated), and cells whose cached value is an Excel error. Also flags
formulas that point at a sheet that does not exist. Exit code 1 when a problem is found.
A workbook written by openpyxl has no cached values until Excel or LibreOffice
recalculates it; run the recalculation step in the skill, then check again.
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
ERRORS = {"#REF!", "#DIV/0!", "#VALUE!", "#NAME?", "#N/A", "#NUM!", "#NULL!"}
SHEET_REF = re.compile(r"(?:'([^']+)'|([A-Za-z_][\w.]*))!")


def sheets(z):
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    target = {r.get("Id"): r.get("Target") for r in rels}
    out = []
    for s in wb.iter(NS + "sheet"):
        t = target[s.get(REL + "id")].lstrip("/")
        out.append((s.get("name"), t if t.startswith("xl/") else "xl/" + t))
    return out


def audit(path):
    z = zipfile.ZipFile(path)
    names = [n for n, _ in sheets(z)]
    report, problems = [], []
    for name, part in sheets(z):
        formulas = constants = uncached = 0
        errors = []
        for c in ET.fromstring(z.read(part)).iter(NS + "c"):
            f = c.find(NS + "f")
            v = c.find(NS + "v")
            if f is not None:
                formulas += 1
                if v is None or v.text in (None, ""):
                    uncached += 1
                text = f.text or ""
                for m in SHEET_REF.finditer(text):
                    ref = m.group(1) or m.group(2)
                    if ref not in names and not ref.startswith("["):
                        problems.append(f"{name}!{c.get('r')}: formula points at missing sheet '{ref}'")
            elif v is not None and c.get("t") in (None, "n"):
                constants += 1
            if c.get("t") == "e" and v is not None and v.text in ERRORS:
                errors.append(f"{c.get('r')}={v.text}")
        report.append({"sheet": name, "formulas": formulas, "numeric_constants": constants,
                       "uncached": uncached, "errors": errors})
        if errors:
            problems.append(f"{name}: error values {', '.join(errors[:10])}")
        if formulas and uncached:
            problems.append(f"{name}: {uncached} formula cells have no cached value; recalculate before sending")
    return {"sheets": report, "problems": problems}


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    if len(args) != 1:
        print(__doc__, file=sys.stderr)
        return 2
    r = audit(args[0])
    if "--json" in argv:
        print(json.dumps(r, indent=2))
    else:
        for s in r["sheets"]:
            print(f"{s['sheet']}: {s['formulas']} formulas, {s['numeric_constants']} numeric constants, {s['uncached']} uncached")
        for p in r["problems"]:
            print("PROBLEM:", p)
    return 1 if r["problems"] else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
