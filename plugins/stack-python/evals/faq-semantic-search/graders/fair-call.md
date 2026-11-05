---
type: llm
weight: 3
---

Pass if the answer weighs pgvector against Qdrant fairly and concludes that for roughly 2,000 entries already in Postgres, pgvector (or Postgres with an embedding column) is sufficient, naming concrete conditions that would justify adding Qdrant later (corpus size, filtered-search degradation, hybrid needs, tenancy, load contention). Fail if it recommends Qdrant by default without that reasoning.
