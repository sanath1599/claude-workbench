#!/usr/bin/env python3
"""Heading-aware chunker with a sliding-window fallback. Standard library only.

Usage:
  python3 chunk.py FILE [FILE ...] [--max-chars 1200] [--overlap 150] [--min-chars 80]
  cat notes.md | python3 chunk.py - --source-id notes

Emits one JSON object per line:
  id        stable id: sha256(source, chunk_no, content hash), 32 hex chars
  source    source id (file path, or --source-id for stdin)
  chunk_no  position inside the source
  section   heading path, for example "Setup > Install"
  hash      sha256 of the chunk text, 16 hex chars
  text      the chunk text
  start,end character offsets of the chunk in the source

Rules: headings start a new section (headings inside code fences are ignored). Fenced code
and pipe tables are kept whole unless a single block exceeds --max-chars. Blocks are packed
up to --max-chars. A block that is too large is split with a sliding window that snaps to
whitespace and repeats --overlap characters. Running the same input twice gives identical output.
"""
import argparse
import hashlib
import json
import re
import sys

HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
FENCE = re.compile(r"^\s*(```|~~~)")


def sha(text, n):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:n]


def sections(text):
    """Yield (heading_path, body, body_offset). Headings inside fences are body text."""
    path, body, body_start, pos, in_fence = [], [], 0, 0, False
    out = []

    def flush():
        if "".join(body).strip():
            out.append((" > ".join(h for _, h in path), "".join(body), body_start))

    for line in text.splitlines(keepends=True):
        if FENCE.match(line):
            in_fence = not in_fence
        m = None if in_fence else HEADING.match(line.rstrip("\n"))
        if m:
            flush()
            level = len(m.group(1))
            path = [(lv, h) for lv, h in path if lv < level] + [(level, m.group(2))]
            body, body_start = [], pos + len(line)
        else:
            body.append(line)
        pos += len(line)
    flush()
    return out


def blocks(body, base):
    """Split a section body into (text, offset) blocks: paragraphs, whole fences, whole tables."""
    res, cur, cur_start, pos, in_fence = [], [], 0, 0, False

    def flush():
        nonlocal cur
        t = "".join(cur).strip("\n")
        if t.strip():
            res.append((t, base + cur_start))
        cur = []

    for line in body.splitlines(keepends=True):
        if not cur:
            cur_start = pos
        if FENCE.match(line):
            in_fence = not in_fence
            cur.append(line)
        elif in_fence:
            cur.append(line)
        elif not line.strip():
            flush()
        else:
            if cur and line.lstrip().startswith("|") != cur[-1].lstrip().startswith("|"):
                flush()
                cur_start = pos
            cur.append(line)
        pos += len(line)
    flush()
    return res


def window(text, offset, max_chars, overlap):
    """Sliding window over one oversized block, snapping cuts to whitespace."""
    out, i, n = [], 0, len(text)
    while i < n:
        j = min(i + max_chars, n)
        if j < n:
            cut = max(text.rfind("\n", i, j), text.rfind(" ", i, j))
            if cut > i + max_chars // 2:
                j = cut
        piece = text[i:j].strip()
        if piece:
            out.append((piece, offset + i))
        if j >= n:
            break
        i = max(j - overlap, i + 1)
    return out


def pack(blks, max_chars, overlap):
    """Greedy-pack blocks up to max_chars; carry trailing whole blocks that fit in the overlap."""
    chunks, cur, fresh = [], [], False

    def emit():
        chunks.append(("\n\n".join(t for t, _ in cur), cur[0][1]))

    for t, off in blks:
        if len(t) > max_chars:
            if fresh:
                emit()
            cur, fresh = [], False
            chunks.extend(window(t, off, max_chars, overlap))
            continue
        size = sum(len(x) + 2 for x, _ in cur)
        if fresh and size + len(t) > max_chars:
            emit()
            keep, kept = [], 0
            for b in reversed(cur):
                if kept + len(b[0]) > overlap:
                    break
                keep.insert(0, b)
                kept += len(b[0]) + 2
            cur, fresh = keep, False
            if sum(len(x) + 2 for x, _ in cur) + len(t) > max_chars:
                cur = []
        cur.append((t, off))
        fresh = True
    if fresh:
        emit()
    return chunks


def chunk_text(text, source, max_chars=1200, overlap=150, min_chars=80):
    text = text.replace("\r\n", "\n")
    results, pending, pending_sec = [], None, ""

    def add(piece, off, sec):
        h = sha(piece, 16)
        no = len(results)
        results.append({"id": sha(f"{source}\0{no}\0{h}", 32), "source": source, "chunk_no": no,
                        "section": sec, "hash": h, "text": piece, "start": off, "end": off + len(piece)})

    for section, body, base in sections(text):
        if pending and pending_sec != section:  # never merge across sections
            add(pending[0], pending[1], pending_sec)
            pending = None
        for piece, off in pack(blocks(body, base), max_chars, overlap):
            if pending:  # a tiny fragment is merged into the next chunk rather than embedded alone
                piece, off, pending = pending[0] + "\n\n" + piece, pending[1], None
            if len(piece) < min_chars:
                pending, pending_sec = (piece, off), section
                continue
            add(piece, off, section)
    if pending:  # trailing fragment: keep it rather than silently drop content
        add(pending[0], pending[1], pending_sec)
    return results


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+", help="files to chunk, or - for stdin")
    ap.add_argument("--max-chars", type=int, default=1200)
    ap.add_argument("--overlap", type=int, default=150)
    ap.add_argument("--min-chars", type=int, default=80)
    ap.add_argument("--source-id", help="source id for stdin (default: stdin)")
    a = ap.parse_args(argv)
    if a.overlap >= a.max_chars:
        ap.error("--overlap must be smaller than --max-chars")
    for f in a.files:
        if f == "-":
            text, source = sys.stdin.read(), a.source_id or "stdin"
        else:
            with open(f, encoding="utf-8") as fh:
                text = fh.read()
            source = a.source_id if a.source_id and len(a.files) == 1 else f
        for c in chunk_text(text, source, a.max_chars, a.overlap, a.min_chars):
            sys.stdout.write(json.dumps(c, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
