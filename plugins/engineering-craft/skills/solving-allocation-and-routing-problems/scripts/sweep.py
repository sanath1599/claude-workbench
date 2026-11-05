#!/usr/bin/env python3
"""Run a solver command over a parameter grid and collect metrics to CSV. Stdlib only.

Usage: python3 sweep.py CONFIG.json [--out results.csv]
CONFIG.json:
  {"command": ["python3", "solver.py", "--max-minutes", "{max_minutes}", "--seed", "{seed}"],
   "grid": {"max_minutes": [30, 45, 60], "seed": [1, 2]},
   "timeout": 120, "out": "sweep.csv"}
The command receives each combination via {name} placeholders (no shell). It must print a
JSON object of metrics as the last non-empty line of stdout. Exit 1 if any run failed.
"""
import csv
import itertools
import json
import subprocess
import sys
import time


def run_one(command, params, timeout):
    argv = [str(part).format(**params) for part in command]
    start = time.time()
    row = dict(params)
    try:
        proc = subprocess.run(argv, capture_output=True, text=True, timeout=timeout, shell=False)
        lines = [ln for ln in proc.stdout.splitlines() if ln.strip()]
        if proc.returncode != 0:
            row["status"] = f"exit_{proc.returncode}"
        elif not lines:
            row["status"] = "no_output"
        else:
            metrics = json.loads(lines[-1])
            row.update({f"m_{k}": v for k, v in metrics.items()})
            row["status"] = "ok"
    except subprocess.TimeoutExpired:
        row["status"] = "timeout"
    except (ValueError, OSError):
        row["status"] = "error"
    row["seconds"] = round(time.time() - start, 2)
    return row


def main(argv):
    args = argv[1:]
    out = None
    if "--out" in args:
        i = args.index("--out")
        out = args[i + 1]
        del args[i:i + 2]
    if len(args) != 1:
        print("usage: sweep.py CONFIG.json [--out results.csv]", file=sys.stderr)
        return 2
    with open(args[0], encoding="utf-8") as fh:
        cfg = json.load(fh)
    names = list(cfg["grid"])
    rows = []
    for combo in itertools.product(*(cfg["grid"][n] for n in names)):
        rows.append(run_one(cfg["command"], dict(zip(names, combo)), cfg.get("timeout", 120)))
    columns = []
    for r in rows:
        for k in r:
            if k not in columns:
                columns.append(k)
    out = out or cfg.get("out", "sweep.csv")
    with open(out, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
    failed = sum(1 for r in rows if r["status"] != "ok")
    print(json.dumps({"runs": len(rows), "failed": failed, "out": out}))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
