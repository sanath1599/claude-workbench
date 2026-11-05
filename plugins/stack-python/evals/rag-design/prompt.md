---
runs: 2
max_turns: 8
allowed_tools: Read, Glob, Grep, Bash, Skill
tags: [python, rag, positive]
---

We run a multi-tenant FastAPI support product on Postgres. Each customer uploads PDFs, Word files and web pages (some PDFs are scans), and their staff should be able to ask questions and get answers with sources. Different staff members can see different documents. Design the RAG system: ingestion, retrieval, answer generation and how we will know it works. Design only, no code to run.
