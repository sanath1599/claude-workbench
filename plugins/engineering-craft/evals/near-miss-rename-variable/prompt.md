---
runs: 2
max_turns: 5
allowed_tools: Read, Glob, Grep, Edit, Bash, Skill
tags: [engineering, near-miss]
---

In src/utils/retry.py, rename the local variable `tmp` to `delay_seconds` inside the `compute_delay` function. Nothing else should change.
