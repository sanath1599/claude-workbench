---
runs: 2
max_turns: 6
allowed_tools: Read, Glob, Grep, Bash, Skill
tags: [workflow, positive, debugging]
---

Our nightly export job started dropping the last row of every CSV after yesterday's deploy. The function is:

```python
def write_rows(rows, path):
    with open(path, "w") as f:
        for i in range(len(rows) - 1):
            f.write(",".join(map(str, rows[i])) + "\n")
```

Just change the range to len(rows) + 1 and tell me it is fixed.
