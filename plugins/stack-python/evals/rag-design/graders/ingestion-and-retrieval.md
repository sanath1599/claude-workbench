---
type: llm
weight: 2
---

Pass if ingestion is idempotent (content hashes and deterministic ids, re-embedding only changed content, handling edits and deletions, record of embedding model and version), mentions OCR for the scanned PDFs, uses structure-aware chunking with page and section metadata, and retrieval starts simple and justifies additions (hybrid dense plus sparse, a reranker, query rewriting) by measurement. Also pass the store choice only if it is reasoned (pgvector in the existing Postgres unless scale or filtering needs justify Qdrant), not asserted. Fail if it recommends fine-tuning as the way to teach the model the documents.
