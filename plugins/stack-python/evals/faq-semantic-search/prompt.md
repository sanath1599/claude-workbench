---
runs: 2
max_turns: 6
allowed_tools: Read, Glob, Grep, Bash, Skill
tags: [python, qdrant, postgres, positive]
---

Our Postgres-backed FastAPI support app has about 2,000 FAQ entries. Add semantic search so users can type a question and see the closest entries. Recommend the approach and the schema; design only.
