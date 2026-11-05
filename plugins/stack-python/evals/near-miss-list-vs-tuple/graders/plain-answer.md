---
type: llm
weight: 3
arm: with_plugin
---
Pass if the assistant gives a short, direct explanation (mutable vs immutable, hashability, typical use) and does not bring up Temporal, Pydantic AI, Qdrant, Postgres, FastAPI or any stack procedure. Fail if it pivots to the owner's stack.
