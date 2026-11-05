# Ingestion

Contents: 1 Pipeline shape, 2 Loaders by format, 3 Normalisation, 4 Metadata schema, 5 Idempotent re-ingestion, 6 Incremental updates and deletions, 7 Temporal workflows, 8 PII and untrusted content.

## 1. Pipeline shape

```
discover -> fetch -> detect type -> load -> normalise -> chunk -> embed -> upsert -> reconcile
   |                                                                          |
   +-- manifest row per document (hash, status, error, versions) <-------------+
```

Every stage is a pure function of its input plus versions (`loader_version`, `chunker_version`, `embedding_model`). Store those versions on the manifest row so a later version bump can find exactly the documents to redo. Postgres holds the manifest and the chunk text; the vector index holds vectors plus ids and filter fields (`stack-python:searching-with-qdrant`, `stack-python:modeling-data-in-postgres`).

## 2. Loaders by format

Pick a loader per format behind one interface: `load(path_or_bytes) -> list[Element]`, where an `Element` has `kind` (heading, paragraph, table, code, list_item), `text`, `page`, `level`, and `bbox` when available. Chunkers consume elements, not raw strings, so structure survives.

| Format | Approach | Notes |
|---|---|---|
| PDF with a text layer | Extract with a layout-aware library (PyMuPDF, pypdf, or Docling for tables and reading order) | Keep page numbers. Strip repeated headers, footers and page numbers by detecting lines that repeat on most pages. Two-column pages need reading-order handling; check output on a real sample. See `docs-and-data:working-with-pdfs` for tool choice and licensing notes. |
| Scanned PDF or image | OCR first (Tesseract, or a vision-language model for hard layouts) | Detect scanned pages by near-empty extracted text. OCR quality bounds retrieval quality; sample and read the output, store a per-page confidence, and flag low-confidence pages for review. OCR with a hosted model sends the document to a third party: needs the owner's yes for sensitive files. |
| DOCX | `python-docx` or Docling; map Word styles (`Heading 1..n`) to heading levels | Tables become Markdown or row-wise records. Ignore tracked-change deletions. See `docs-and-data:producing-word-documents` for the file structure. |
| HTML | Parse with `selectolax` or BeautifulSoup, extract main content (`trafilatura` is built for this), then convert to Markdown | Drop nav, cookie banners, footers. Keep `<h1>`..`<h6>`, lists, tables, code. Store the canonical URL. Treat all text as untrusted (section 8). |
| Markdown | Parse headings and fences directly | Strip front matter into metadata. Keep fenced code whole. `scripts/chunk.py` is a dependency-free example. |
| Spreadsheets and CSV | One chunk per row (or per small group of rows) rendered as `column: value` lines with the sheet and header context | Whole-sheet chunks retrieve badly. For numeric questions (sums, filters, trends) prefer SQL over RAG; index the sheet's description only. |
| Transcripts (call, meeting, interview) | Segment by speaker turn, then group turns into windows of about 60 to 120 seconds with a few turns of overlap | Keep speaker, start and end timestamps so a citation can deep-link to the moment. Add a per-window summary line as extra retrievable text only if evals show it helps. |
| Email, chat exports | One message or thread per document; thread id and participants as metadata | Strip quoted reply chains and signatures; they duplicate content and dominate embeddings. |

Rules for every loader:
- Never fail the whole job on one bad file. Record `status=failed` with the error class and continue.
- Cap file size and page count, and run parsers with a timeout. Untrusted PDFs and archives are an attack surface; do not unpack archives without path and size checks.
- Prefer one extraction library per format and pin it; extraction changes alter chunk text and therefore ids.

## 3. Normalisation

Apply the same steps to every format, in this order, and version the function:

1. Unicode NFC; replace non-breaking spaces and zero-width characters.
2. Repair hyphenation at line ends in PDFs (`inter-\nnational` becomes `international`) only when the joined word is plausible.
3. Collapse runs of blank lines and trailing spaces. Do not collapse whitespace inside code or tables.
4. Remove boilerplate (headers, footers, legal disclaimers repeated on every page, "Page 3 of 9").
5. Keep structure markers: render headings as `#`-lines, tables as Markdown tables, lists as `-` lines.
6. Compute the content hash after normalisation, so cosmetic differences in the source do not cause re-embedding.

## 4. Metadata schema

Store this on every chunk (Postgres columns, with the filterable subset duplicated into the vector payload).

| Field | Type | Purpose |
|---|---|---|
| `chunk_id` | uuid (deterministic, section 5) | Primary key, also the vector point id |
| `document_id` | uuid | Stable id of the logical document |
| `tenant_id` | text | Isolation boundary; indexed; mandatory |
| `acl` | text[] of principals (user ids, group ids) or a `visibility` enum plus an ACL table | Per-user filtering (see the multi-tenancy section of the retrieval guide) |
| `source_uri` | text | Where it came from (path, URL, message id); shown in citations |
| `title` | text | Document title for citations |
| `section_path` | text | `Chapter > Section`, from headings |
| `page_start`, `page_end` | int, nullable | Citation page numbers |
| `chunk_no`, `parent_id` | int, uuid nullable | Order and small-to-big parent link |
| `doc_version` | int or text | Which revision of the source this came from |
| `content_hash` | text | Hash of the normalised chunk text |
| `doc_hash` | text | Hash of the whole normalised document |
| `embedding_model`, `embedding_dim`, `embedding_version` | text, int, text | Needed for re-embedding migrations |
| `chunker_version`, `loader_version` | text | Needed for targeted reprocessing |
| `lang` | text | Language filter and analyser choice |
| `doc_type`, `tags` | text, text[] | Optional filters (policy, manual, ticket) |
| `created_at`, `updated_at`, `valid_from`, `valid_to` | timestamptz | Freshness and "as of" queries |
| `deleted_at` | timestamptz nullable | Soft delete until the index is reconciled |

Keep `tenant_id` and ACL out of the text that gets embedded and out of anything the model sees.

## 5. Idempotent re-ingestion

Deterministic ids make a rerun overwrite rather than duplicate.

```python
import hashlib, unicodedata, uuid

NS = uuid.UUID("00000000-0000-0000-0000-000000000000")  # replace once with a random uuid4, then commit it

def normalise(text: str) -> str:
    return unicodedata.normalize("NFC", text).strip()

def content_hash(text: str) -> str:
    return hashlib.sha256(normalise(text).encode()).hexdigest()[:32]

def chunk_id(document_id: str, chunk_no: int, chash: str) -> str:
    return str(uuid.uuid5(NS, f"{document_id}:{chunk_no}:{chash}"))
```

Decision rules:
- `doc_hash` unchanged and versions unchanged: skip the document entirely. This is the cheap path; make it a single indexed lookup.
- `doc_hash` changed: re-chunk, then compare chunk hashes to the stored set. Embed only new hashes; delete stored chunks whose hash is gone. Inserting a paragraph shifts `chunk_no` for everything after it, which changes ids under the formula above. If that churn matters, derive the id from `(document_id, section_path, content_hash)` instead and accept that identical text repeated in one section collapses to one chunk (add an occurrence counter to keep both).
- Embedding is the expensive step; cache vectors by `(embedding_model, content_hash)` so identical text (boilerplate, duplicated documents) is embedded once.
- Upsert in batches of 100 to 500 with `wait=True`/transaction commit, then update the manifest row. If the process dies between the two, the rerun is harmless because ids are deterministic.
- Near-duplicate documents (same policy in two folders): detect with a normalised-text hash, or MinHash for fuzzy matches, and keep one canonical document with several `source_uri` values.

## 6. Incremental updates and deletions

- **Discovery** produces `(source_uri, etag or mtime or content_hash)`. Compare to the manifest: new, changed, unchanged, missing.
- **Webhooks** (storage events, CMS publish) enqueue one document; a **nightly sweep** lists everything and repairs what webhooks missed. Run both; webhooks alone drift.
- **Deletion**: a document missing from two consecutive sweeps (guards against a transient listing failure) is soft-deleted (`deleted_at`), its chunks are removed from the vector index immediately, and the rows are purged after the retention window. A failed listing must never be read as "everything was deleted": abort the sweep if the listing is empty or shrinks by more than a set fraction (for example 20 percent) and alert instead.
- **Permission changes** are updates: ACL change on the source means rewrite the `acl` payload on its chunks without re-embedding (payload-only update). Test that a revoked user stops seeing the chunks within the freshness SLA.
- **Versioned documents**: keep the latest by default (`valid_to is null` filter); keep history only if "as of" questions are a requirement.
- **Right to erasure**: delete by `document_id` or by data subject across Postgres, the vector index, caches and eval logs. Write a runbook entry and a test.

## 7. Temporal workflows

Use Temporal when ingestion is long, must resume after a crash, or fans out over thousands of documents (`stack-python:orchestrating-with-temporal` for determinism, versioning and testing rules).

```
SyncSourceWorkflow(source_id)
  activity list_changes(source_id) -> manifest diff (ids only, not content)
  for batch in batches(changed_ids, 50):            # bounded fan-out
      start_child IngestBatchWorkflow(batch)        # or execute activities with a concurrency cap
  activity reconcile_deletions(source_id)
  continue_as_new when history grows (large sources)

IngestDocumentWorkflow(document_id)
  activity fetch_and_load   -> stores normalised elements in object storage or Postgres, returns a key
  activity chunk            -> returns chunk keys/count (no large payloads in history)
  activity embed_batch x N  -> heartbeats per batch, idempotent
  activity upsert_index
  activity mark_done(manifest)
```

Rules:
- Pass ids and keys between activities, never document bodies or vectors: payloads live in the event history and have size limits.
- Heartbeat inside any activity that loops over batches (embedding, OCR pages), record progress in the heartbeat details, and resume from them on retry. Set `heartbeat_timeout` to a small multiple of one batch time.
- Give every activity `start_to_close_timeout` and a `RetryPolicy`; classify failures: parse errors on a corrupt file are non-retryable (`non_retryable_error_types`), provider 429/5xx are retryable with backoff.
- Throttle embedding with a task queue dedicated to embedding and `max_concurrent_activities` on that worker, so a backfill cannot starve interactive traffic or exhaust provider quota.
- Workflow id = `ingest:{source_id}:{doc_hash}` makes duplicate triggers collapse (`WorkflowIDReusePolicy` and conflict policy as appropriate).
- Use a Schedule for the nightly sweep; use signals for "reindex now".
- Reindex-everything is a workflow with a `generation` parameter that writes to the new collection (blue/green migration in the chunking-and-embeddings guide).
- Test with the Temporal time-skipping test environment and a fake embedder; no real provider in tests.

## 8. PII and untrusted content

- Documents, web pages, emails and transcripts are data written by third parties. Never let their text change control flow in ingestion (no "if the document says X").
- Decide PII policy at ingestion, not at answer time: classify (regex plus NER such as Presidio) and either redact before embedding, tag chunks `contains_pii` for filtering, or exclude the document class. Embeddings can leak content; treat the vector index with the same sensitivity as the text.
- Do not send sensitive documents to a hosted embedding or OCR provider without the owner's yes; prefer a local model (Ollama, sentence-transformers) for those.
- Strip hidden text (white-on-white, zero-size fonts, HTML comments, alt-text stuffing) during extraction; it is a common prompt-injection carrier. Flag chunks that contain instruction-like phrases ("ignore previous instructions") for review, but still fence everything at generation (`SKILL.md`, generation section).
