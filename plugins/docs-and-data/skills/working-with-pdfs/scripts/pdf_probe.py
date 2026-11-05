#!/usr/bin/env python3
"""Probe a PDF before choosing how to work on it.

Usage: python3 pdf_probe.py FILE.pdf [--json]

Uses poppler's pdfinfo and pdftotext when installed, and falls back to pypdf when it
is importable. Reports page count, encryption, whether each page has a text layer,
and the verdict: text, scanned (needs OCR) or mixed. Exit code 3 when neither poppler
nor pypdf is available.
"""
import json
import re
import shutil
import subprocess
import sys


def poppler(path):
    info = subprocess.run(["pdfinfo", path], capture_output=True, text=True)
    if info.returncode != 0:
        raise SystemExit(info.stderr.strip() or "pdfinfo failed")
    meta = dict(re.findall(r"^([A-Za-z ]+):\s*(.*)$", info.stdout, re.M))
    pages = int(meta.get("Pages", "0"))
    counts = []
    for n in range(1, pages + 1):
        t = subprocess.run(["pdftotext", "-f", str(n), "-l", str(n), "-layout", path, "-"], capture_output=True, text=True)
        counts.append(len(t.stdout.strip()))
    return meta.get("Title", ""), meta.get("Encrypted", "no").startswith("yes"), counts


def with_pypdf(path):
    from pypdf import PdfReader
    r = PdfReader(path)
    enc = r.is_encrypted
    counts = [] if enc else [len((p.extract_text() or "").strip()) for p in r.pages]
    return (r.metadata.title or "") if r.metadata else "", enc, counts


def probe(path):
    if shutil.which("pdfinfo") and shutil.which("pdftotext"):
        title, enc, counts = poppler(path)
        engine = "poppler"
    else:
        try:
            title, enc, counts = with_pypdf(path)
            engine = "pypdf"
        except ImportError:
            raise SystemExit(3)
    with_text = [i + 1 for i, c in enumerate(counts) if c >= 20]
    without = [i + 1 for i, c in enumerate(counts) if c < 20]
    verdict = "encrypted" if enc and not counts else "text" if counts and not without else "scanned" if counts and not with_text else "mixed"
    return {"engine": engine, "title": title, "encrypted": enc, "pages": len(counts),
            "pages_without_text": without, "verdict": verdict}


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    if len(args) != 1:
        print(__doc__, file=sys.stderr)
        return 2
    r = probe(args[0])
    if "--json" in argv:
        print(json.dumps(r, indent=2))
    else:
        print(f"{r['pages']} pages, encrypted: {r['encrypted']}, verdict: {r['verdict']} (via {r['engine']})")
        if r["pages_without_text"]:
            print("pages with no text layer:", ", ".join(map(str, r["pages_without_text"][:40])))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
