---
runs: 2
max_turns: 3
allowed_tools: [Read]
tags: [near-miss, negative]
---
What does this bash loop do?

for f in logs/*.log; do gzip -9 "$f" && mv "$f.gz" archive/; done
