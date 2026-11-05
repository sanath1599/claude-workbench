---
runs: 2
max_turns: 6
allowed_tools: Read, Glob, Grep, Bash, Skill
tags: [python, llm, positive]
---

Write a Python function that calls Ollama Cloud (gpt-oss:120b, bearer key from env) to extract a `Candidate` (name, skills list, years_experience) from resume text and returns a validated object. Show the code and how you would test it.
