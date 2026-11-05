#!/usr/bin/env python3
"""Retrieval metrics from a JSONL file. Standard library only.

Input, one JSON object per line:
  {"question": "...", "relevant_ids": ["a", "b"], "retrieved_ids": ["x", "a", "y"]}
retrieved_ids are in rank order, best first. Relevance is binary.

Usage:
  python3 eval_retrieval.py results.jsonl [--k 1,3,5,10] [--per-question]
                            [--min-recall K=0.8] [--min-mrr 0.6] [--min-ndcg K=0.7]

Prints one JSON report. Questions with empty relevant_ids are unanswerable: they are
counted separately and excluded from the metrics. Exit code 1 when a gate fails
(for CI), 2 on malformed input.
"""
import argparse
import json
import math
import sys


def recall_at(rel, ret, k):
    return len(rel & set(ret[:k])) / len(rel)


def rr(rel, ret):
    for i, r in enumerate(ret, 1):
        if r in rel:
            return 1.0 / i
    return 0.0


def ndcg_at(rel, ret, k):
    dcg = sum(1.0 / math.log2(i + 1) for i, r in enumerate(ret[:k], 1) if r in rel)
    ideal = sum(1.0 / math.log2(i + 1) for i in range(1, min(len(rel), k) + 1))
    return dcg / ideal if ideal else 0.0


def load(path):
    rows = []
    with open(path, encoding="utf-8") as fh:
        for n, line in enumerate(fh, 1):
            if not line.strip():
                continue
            try:
                o = json.loads(line)
                rows.append((o["question"], set(o["relevant_ids"]), list(o["retrieved_ids"])))
            except (ValueError, KeyError, TypeError) as e:
                raise SystemExit(f"{path}:{n}: bad row ({e!r})") from None
    return rows


def parse_gate(s, default_k):
    k, _, v = s.rpartition("=")
    return (int(k) if k else default_k), float(v)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file")
    ap.add_argument("--k", default="1,3,5,10")
    ap.add_argument("--per-question", action="store_true")
    ap.add_argument("--min-recall", help="gate as K=VALUE or VALUE (uses the largest k)")
    ap.add_argument("--min-ndcg", help="gate as K=VALUE or VALUE (uses the largest k)")
    ap.add_argument("--min-mrr", type=float)
    a = ap.parse_args(argv)
    try:
        ks = sorted({int(x) for x in a.k.split(",")})
        rows = load(a.file)
    except (SystemExit, ValueError, OSError) as e:
        print(str(e), file=sys.stderr)
        return 2
    scored = [(q, rel, ret) for q, rel, ret in rows if rel]
    if not scored:
        print("no answerable questions", file=sys.stderr)
        return 2
    n = len(scored)
    report = {
        "questions": len(rows), "answerable": n, "unanswerable": len(rows) - n,
        "recall": {str(k): round(sum(recall_at(r, t, k) for _, r, t in scored) / n, 4) for k in ks},
        "ndcg": {str(k): round(sum(ndcg_at(r, t, k) for _, r, t in scored) / n, 4) for k in ks},
        "mrr": round(sum(rr(r, t) for _, r, t in scored) / n, 4),
    }
    if a.per_question:
        report["misses"] = [{"question": q, "relevant_ids": sorted(r), "retrieved_ids": t[:max(ks)]}
                            for q, r, t in scored if not (r & set(t[:max(ks)]))]
    failures, big = [], max(ks)
    for name, gate in (("recall", a.min_recall), ("ndcg", a.min_ndcg)):
        if gate:
            k, v = parse_gate(gate, big)
            got = report[name].get(str(k))
            if got is None:
                print(f"gate {name}@{k}: k not in --k", file=sys.stderr)
                return 2
            if got < v:
                failures.append(f"{name}@{k} {got} < {v}")
    if a.min_mrr is not None and report["mrr"] < a.min_mrr:
        failures.append(f"mrr {report['mrr']} < {a.min_mrr}")
    report["failures"] = failures
    print(json.dumps(report, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
