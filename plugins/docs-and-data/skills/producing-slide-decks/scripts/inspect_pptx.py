#!/usr/bin/env python3
"""Outline a .pptx using only the standard library.

Usage: python3 inspect_pptx.py FILE.pptx [--json] [--max-words N]

Per slide: title, word count, picture count, whether speaker notes exist, and
pictures with no alt text. Flags slides over the word limit (default 90), slides
with no title, and leftover placeholder text. Exit code 1 when a problem is found.
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
PLACEHOLDER = re.compile(r"lorem ipsum|click to add|\bTODO\b|\bTBD\b|\[(?:insert|client|name|date)[^\]]*\]", re.I)


def slide_order(z):
    names = [n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)]
    return sorted(names, key=lambda n: int(re.search(r"(\d+)", n.rsplit("/", 1)[1]).group(1)))


def inspect(path, max_words=90):
    z = zipfile.ZipFile(path)
    slides, problems = [], []
    for i, part in enumerate(slide_order(z), 1):
        root = ET.fromstring(z.read(part))
        title, words, pics, no_alt = "", 0, 0, 0
        text_all = []
        for sp in root.iter(P + "sp"):
            ph = sp.find(f"{P}nvSpPr/{P}nvPr/{P}ph")
            txt = " ".join("".join(t.text or "" for t in para.iter(A + "t")) for para in sp.iter(A + "p")).strip()
            if ph is not None and ph.get("type") in ("title", "ctrTitle") and txt:
                title = txt
            words += len(txt.split())
            text_all.append(txt)
        for pic in root.iter(P + "pic"):
            pics += 1
            c = pic.find(f"{P}nvPicPr/{P}cNvPr")
            if c is None or not (c.get("descr") or "").strip():
                no_alt += 1
        rels_name = part.replace("slides/", "slides/_rels/") + ".rels"
        has_notes = False
        if rels_name in z.namelist():
            has_notes = "notesSlide" in z.read(rels_name).decode("utf8", "ignore")
        s = {"n": i, "title": title, "words": words, "pictures": pics, "pictures_without_alt": no_alt, "notes": has_notes}
        slides.append(s)
        if not title:
            problems.append(f"slide {i}: no title placeholder text")
        if words > max_words:
            problems.append(f"slide {i}: {words} words (limit {max_words})")
        if no_alt:
            problems.append(f"slide {i}: {no_alt} picture(s) without alt text")
        m = PLACEHOLDER.search(" ".join(text_all))
        if m:
            problems.append(f"slide {i}: placeholder text '{m.group(0)}'")
    return {"slides": slides, "problems": problems}


def main(argv):
    max_words = 90
    if "--max-words" in argv:
        k = argv.index("--max-words")
        max_words = int(argv[k + 1])
        argv = argv[:k] + argv[k + 2:]
    args = [a for a in argv if not a.startswith("--")]
    if len(args) != 1:
        print(__doc__, file=sys.stderr)
        return 2
    r = inspect(args[0], max_words)
    if "--json" in argv:
        print(json.dumps(r, indent=2))
    else:
        for s in r["slides"]:
            print(f"{s['n']:>2}. {s['title'] or '(no title)'}  [{s['words']} words, {s['pictures']} pictures, notes: {s['notes']}]")
        for p in r["problems"]:
            print("PROBLEM:", p)
    return 1 if r["problems"] else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
