---
type: tool_used
weight: 1
tool: Skill
input_match: '"skill"\s*:\s*"(?:[\w-]+:)?(?:shaping-the-work|writing-implementation-plans|executing-plans|debugging-systematically|test-first-changes|reviewing-code-before-merge|simplifying-code|finishing-a-branch|working-in-parallel-sessions)"'
min: 0
max: 0
arm: both
---

Pass if the Skill tool was NOT invoked for any workflow skill (shaping-the-work, writing-implementation-plans, executing-plans, debugging-systematically, test-first-changes, reviewing-code-before-merge, simplifying-code, finishing-a-branch, working-in-parallel-sessions).
