---
type: llm
weight: 2
---

Pass if the design adds the extension and column through a migration (not db push), keeps Postgres the source of truth, makes embedding generation idempotent (re-embedding on content change, recording the embedding model), and tests with a fake embedder rather than a real provider.
