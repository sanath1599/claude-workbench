#!/usr/bin/env python3
"""Report on a .docx using only the standard library.

Usage: python3 inspect_docx.py FILE.docx [--json]

Prints headings, table and image counts, section settings, whether a PAGE field and a
table of contents exist, and likely leftovers (placeholder text, empty paragraph runs,
hard page numbers typed into the text). Exit code 1 when a problem is found.
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
PLACEHOLDER = re.compile(r"lorem ipsum|\bTODO\b|\bTBD\b|\bXXX\b|\[(?:insert|client|name|date)[^\]]*\]", re.I)


def read_part(z, name):
    try:
        return ET.fromstring(z.read(name))
    except KeyError:
        return None


def paragraph_text(p):
    return "".join(t.text or "" for t in p.iter(W + "t"))


def inspect(path):
    z = zipfile.ZipFile(path)
    doc = read_part(z, "word/document.xml")
    if doc is None:
        raise SystemExit("not a .docx: word/document.xml is missing")
    body = doc.find(W + "body")
    headings, empties, run, max_run, texts = [], 0, 0, 0, []
    for p in body.iter(W + "p"):
        text = paragraph_text(p).strip()
        style = p.find(f"{W}pPr/{W}pStyle")
        sid = style.get(W + "val") if style is not None else ""
        if re.match(r"(?i)^heading\s*(\d)$", sid) or sid.lower().startswith("heading"):
            headings.append((sid, text))
        if text:
            texts.append(text)
            run = 0
        else:
            has_break = p.find(f".//{W}br") is not None or p.find(f".//{W}drawing") is not None
            if not has_break:
                empties += 1
                run += 1
                max_run = max(max_run, run)
    instr = " ".join(i.text or "" for i in doc.iter(W + "instrText"))
    simple = " ".join(f.get(W + "instr") or "" for f in doc.iter(W + "fldSimple"))
    fields_all = instr + " " + simple
    for name in z.namelist():
        if re.match(r"word/(header|footer)\d*\.xml", name):
            part = read_part(z, name)
            if part is not None:
                fields_all += " " + " ".join(i.text or "" for i in part.iter(W + "instrText"))
                fields_all += " " + " ".join(f.get(W + "instr") or "" for f in part.iter(W + "fldSimple"))
    settings = read_part(z, "word/settings.xml")
    update_on_open = settings is not None and settings.find(W + "updateFields") is not None
    sect = doc.find(f".//{W}sectPr/{W}pgSz")
    size = (sect.get(W + "w"), sect.get(W + "h")) if sect is not None else None
    media = [n for n in z.namelist() if n.startswith("word/media/")]
    full = "\n".join(texts)
    problems = []
    if PLACEHOLDER.search(full):
        problems.append("placeholder text found: " + PLACEHOLDER.search(full).group(0))
    if max_run >= 3:
        problems.append(f"{max_run} empty paragraphs in a row (use spacing, not blank lines)")
    if re.search(r"(?im)^\s*page\s+\d+\s*(of\s*\d+)?\s*$", full):
        problems.append("a page number is typed into the body text; use a PAGE field")
    if "PAGE" not in fields_all:
        problems.append("no PAGE field in the body, header or footer")
    if not headings:
        problems.append("no heading styles used; navigation pane and TOC will be empty")
    return {
        "headings": headings,
        "tables": len(list(body.iter(W + "tbl"))),
        "images": len(media),
        "page_size_twips": size,
        "has_toc_field": "TOC" in fields_all,
        "update_fields_on_open": update_on_open,
        "empty_paragraphs": empties,
        "words": len(full.split()),
        "problems": problems,
    }


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    if len(args) != 1:
        print(__doc__, file=sys.stderr)
        return 2
    r = inspect(args[0])
    if "--json" in argv:
        print(json.dumps(r, indent=2))
    else:
        print(f"words: {r['words']}  tables: {r['tables']}  images: {r['images']}  page: {r['page_size_twips']}")
        print(f"TOC field: {r['has_toc_field']}  update fields on open: {r['update_fields_on_open']}")
        for sid, t in r["headings"]:
            print(f"  [{sid}] {t}")
        for p in r["problems"]:
            print("PROBLEM:", p)
    return 1 if r["problems"] else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
