---
type: tool_used
weight: 1
tool: Skill
input_match: '"skill"\s*:\s*"(?:[\w-]+:)?(?:engineering-craft|designing-systems|hardening-distributed-systems|designing-apis|building-llm-features|running-qa-passes|reviewing-security|planning-tests|answering-pr-reviews)"'
min: 0
max: 0
arm: both
---

Pass if the Skill tool was NOT invoked for any engineering-craft skill (designing-systems, hardening-distributed-systems, designing-apis, building-llm-features, running-qa-passes, reviewing-security, planning-tests, answering-pr-reviews).
