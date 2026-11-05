# Reference architecture

Contents: 1 Diagram, 2 Repo layout, 3 Postgres schema, 4 Query path in FastAPI, 5 Pydantic AI agent with a retrieval tool, 6 Observability, 7 Operations, 8 Testing.

## 1. Diagram

```
                       sources (files, CMS, drive, email, webhooks)
                                     |
                      +--------------v--------------+
                      |   Temporal worker (ingest)  |  task queues: ingest, embed (throttled)
                      |  sync -> load -> chunk ->   |
                      |  embed -> upsert -> reconcile|
                      +------+-----------------+----+
                             |                 |
              chunks, manifest, ACLs      vectors + ids + filter fields
                             v                 v
                   +--------------------+  +---------------------------+
                   | Postgres           |  | Qdrant (dense+sparse)     |
                   | source of truth:   |  |   or pgvector in Postgres |
                   | documents, chunks, |  | rebuildable index         |
                   | manifest, ACL,     |  +-------------+-------------+
                   | eval logs          |                |
                   +---------+----------+                |
                             ^                           |
                             |  authoritative ACL check  |
    user --> FastAPI --> auth (tenant, principals) --> retrieval service
              |            |                              |  hybrid -> filter -> rerank
              |            |                              v
              |            +--> Pydantic AI agent / generator <-- fenced context
              |                         |
              |                  Ollama Cloud / Claude  (via one complete() function)
              v
        streamed answer + citations (chunk id -> source, page)

   Logfire/OTel spans on every box;  golden set + eval runs in CI and nightly.
```

When pgvector is the index, the two stores collapse into one Postgres and the "upsert index" activity becomes part of the same transaction as the chunk write. That is the simplest correct setup: start there (`stack-python:searching-with-qdrant` decision rule).

## 2. Repo layout

```
src/app/
  api/            FastAPI routers: /ask, /feedback, /admin/reindex (thin)
  rag/
    models.py     Pydantic types: Chunk, Citation, Answer, RetrievalResult
    retrieval.py  the only module that builds index queries; requires a Principal
    rerank.py
    generate.py   prompt, fencing, output type, refusal
    embed.py      one embedding function: prefixes, batching, normalisation
  ingest/
    loaders/      pdf.py docx.py html.py markdown.py sheet.py transcript.py
    normalise.py  chunk.py  manifest.py
    workflows.py  activities.py  worker.py   (Temporal)
  db/             SQLAlchemy models, Alembic migrations
evals/
  golden.jsonl    questions, relevant ids, reference answers
  harness.py      pydantic-evals dataset and evaluators
  baseline.json   committed metric baseline for CI gates
tests/            fake embedder, fake LLM, tenant isolation tests
```

## 3. Postgres schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document (
  id uuid PRIMARY KEY, tenant_id text NOT NULL, source_uri text NOT NULL,
  title text, doc_hash text NOT NULL, doc_version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',            -- pending | indexed | failed | deleted
  error text, loader_version text, chunker_version text,
  acl text[] NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (tenant_id, source_uri));

CREATE TABLE chunk (
  id uuid PRIMARY KEY,                                -- deterministic uuid5
  document_id uuid NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  tenant_id text NOT NULL, acl text[] NOT NULL DEFAULT '{}',
  chunk_no int NOT NULL, parent_id uuid, section_path text,
  page_start int, page_end int, text text NOT NULL, content_hash text NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
  embedding halfvec(1024), embedding_model text, embedding_version text);

CREATE INDEX chunk_tenant ON chunk (tenant_id, document_id);
CREATE INDEX chunk_acl ON chunk USING gin (acl);
CREATE INDEX chunk_tsv ON chunk USING gin (tsv);
CREATE INDEX chunk_hnsw ON chunk USING hnsw (embedding halfvec_cosine_ops);
```

Create it through an Alembic migration (`stack-python:modeling-data-in-postgres`), never `create_all`. Pick `vector(n)` or `halfvec(n)` by measured recall and memory. A model change means a new column or table and a backfill, not an `ALTER` of the dimension. Enable row-level security on `chunk` and `document` when the service connects with one shared role.

## 4. Query path in FastAPI

```python
from typing import Annotated
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

router = APIRouter()

@router.post("/ask")
async def ask(body: AskIn, principal: Annotated[Principal, Depends(current_principal)],
              rag: Annotated[RagService, Depends(get_rag)]):
    async def events():
        async for ev in rag.answer_stream(body.question, principal):   # yields token and final events
            yield f"data: {ev.model_dump_json()}\n\n"
    return StreamingResponse(events(), media_type="text/event-stream")
```

Rules: tenant and principals come from `current_principal` only; `RagService` creates the Logfire root span, applies timeouts per stage and a total deadline, and sends the final event with `status`, `citations` and `usage`. Load the embedder, reranker and clients in the lifespan handler and share them; run blocking model calls in a thread pool. See `stack-python:building-fastapi-services` for settings, lifespan, SSE and error mapping.

## 5. Pydantic AI agent with a retrieval tool

Use an agent with a `search_docs` tool when the model must decide whether and how many times to search (multi-hop, follow-up questions). Use a fixed pipeline (retrieve, then generate) when every question needs exactly one search: cheaper, faster and easier to evaluate.

```python
from dataclasses import dataclass
from pydantic_ai import Agent, RunContext

@dataclass
class Deps:
    retrieval: RetrievalService
    principal: Principal

agent = Agent(settings.llm_model, deps_type=Deps, output_type=Answer,
              instructions=GROUNDED_INSTRUCTIONS)

@agent.tool
async def search_docs(ctx: RunContext[Deps], query: str) -> str:
    """Search the knowledge base. Returns numbered passages; cite them by number."""
    hits = await ctx.deps.retrieval.search(query, ctx.deps.principal, k=6)
    return render_fenced(hits)
```

The tool receives the principal through `deps`, never as a model-supplied argument. `Answer` is defined in `SKILL.md` (generation section). Check the current Pydantic AI docs for model-string syntax and output validators (`stack-python:building-pydantic-ai-agents`); use a `ModelRetry` in an output validator when citations reference ids that were not retrieved.

## 6. Observability

One trace per question with child spans: `rag.rewrite`, `rag.embed_query`, `rag.dense`, `rag.sparse`, `rag.fuse`, `rag.rerank`, `rag.assemble`, `rag.generate`, `rag.verify_citations`. Span attributes: tenant (hashed), candidate counts, top scores, chunk ids (not text, unless policy allows), model and prompt versions, token counts, cost estimate, cache hit. Enable `logfire.instrument_pydantic_ai()` and the FastAPI and HTTPX instrumentation; any OTel backend works. Dashboards: p50/p95 per stage, refusal rate, zero-hit rate, citation-invalid rate, cost per answer, ingestion lag, queue depth.

## 7. Operations

- **Budgets** (set per product, then alert): retrieval p95, time to first token, full answer p95, cost per answer. Typical levers: fewer candidates, smaller reranker, cache, smaller model for rewrites.
- **Caching**: query-embedding cache, retrieval cache keyed by `(tenant, principal-set hash, normalised query, index generation)`, and prompt prefix caching (`stack-python:calling-llms-reliably`). Invalidate retrieval caches on index generation change; short TTL otherwise. Never cache across tenants.
- **Freshness SLA**: write it down per source ("a changed document is searchable within 10 minutes"); measure `now - document.updated_at` for the newest unindexed change; alert on breach.
- **Reindex runbook**: (1) create new generation, (2) backfill workflow, (3) dual-write, (4) compare with the golden set, (5) flip the alias or config, (6) keep old for a rollback window, (7) delete, (8) record numbers. Include "how to roll back" and "how to pause ingestion".
- **Backfills** run on the throttled embed queue, off-peak, with a progress query on the workflow and an owner's yes if provider cost is material.
- **Failure handling**: dead-letter documents with `status=failed` and an admin view; a retry button triggers the workflow again.

## 8. Testing

- Fake embedder: deterministic hash-to-vector function; fake LLM through the `mock` provider; Qdrant `:memory:` or a throwaway container; Postgres container with the real migration.
- Unit tests: chunker (stable ids, idempotent), loaders on small fixtures, RRF fusion, ACL filter builder, citation verifier.
- Integration: ingest a fixture folder twice (same count), edit one file (only its chunks change), delete one (its chunks vanish from both stores), tenant isolation, revoked-permission propagation.
- No real Ollama, Claude or embedding provider in tests; real-provider checks are opt-in behind an env var.
