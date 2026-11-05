---
runs: 2
max_turns: 5
allowed_tools: Read, Glob, Grep, Edit, Bash, Skill
tags: [design, near-miss]
---

In src/components/Footer.css the link hover colour is #1d4ed8. Change it to use our existing token var(--color-primary) instead of the hex value.
