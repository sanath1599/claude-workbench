---
type: tool_used
weight: 1
tool: Skill
input_match: '"skill"\s*:\s*"(?:[\w-]+:)?(?:stack-python|building-pydantic-ai-agents|orchestrating-with-temporal|searching-with-qdrant|modeling-data-in-postgres|calling-llms-reliably|building-voice-agents|building-fastapi-services)"'
min: 0
max: 0
arm: both
---

Pass if the Skill tool was NOT invoked for any stack-python skill (building-pydantic-ai-agents, orchestrating-with-temporal, searching-with-qdrant, modeling-data-in-postgres, calling-llms-reliably, building-voice-agents, building-fastapi-services).
