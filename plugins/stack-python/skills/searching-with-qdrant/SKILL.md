---
name: searching-with-qdrant
description: Use when adding semantic or hybrid search, RAG retrieval, embeddings storage or similarity search, or when asked whether to use Qdrant or pgvector. Postgres stays the system of record. Not for relational schema work, which is stack-python:modeling-data-in-postgres.
---

# Searching with Qdrant

Start with Postgres (pgvector for small corpora). Add Qdrant only when a real requirement shows up, and then treat it as a rebuildable index, never the source of truth.

## When to use

- "Add semantic search", "RAG over our docs", "find similar items".
- A pgvector setup is slow under filters, or hybrid sparse+dense search is needed.
- Multi-tenant vector search at scale.

## When not to use

- Exact-match, prefix or Postgres full-text search is enough: use SQL (`tsvector`).
- Fewer than a few hundred thousand vectors, with relational joins or permissions on the results: pgvector.
- Table design and migrations: `stack-python:modeling-data-in-postgres`.

## Procedure

1. **State the requirement in numbers.** Corpus size (chunks, not documents), growth, queries per second, filters, tenants, hybrid need, freshness. Ask only what you cannot find in the repo.
   **Done when:** the numbers are written in the design note.
2. **Apply the decision rule.**
   - Choose **pgvector** when: under roughly 1 to 5 million chunks, results must join relational rows or permissions, one small team runs ops, lexical needs are modest (Postgres FTS plus RRF in SQL covers many cases). 2,000 FAQ entries is a pgvector job.
   - Choose **Qdrant** when any of these hold: filtered ANN recall or latency degrades at your scale; you need server-side hybrid with sparse or multi-vector (ColBERT); multi-tenant isolation at scale; quantization is needed to fit memory; vector load would contend with OLTP Postgres; the corpus passes about 10 million vectors. These thresholds are rules of thumb; benchmark on your data.
   **Done when:** the note says which and cites the number that decided it.
3. **Design the collection** (below) and write the ingestion as an idempotent job.
   **Done when:** running ingestion twice leaves the same point count.
4. **Keep Postgres the source of truth.** The payload holds ids and filter fields only; text and ACLs stay in Postgres. A Temporal workflow or an outbox writes to Qdrant so retries are safe (`stack-python:orchestrating-with-temporal`).
   **Done when:** dropping the collection and re-running the backfill restores search.
5. **Test** with a local container and a deterministic fake embedder (below). No real embedding provider in tests.
   **Done when:** `uv run pytest` passes with Qdrant in Docker or `:memory:` mode.

## Collection design

- **Named vectors:** one collection, several vectors per point: `dense`, `sparse`, optionally a multivector for late interaction. Sparse config `Modifier.IDF` for BM25-style weighting.
- **Hybrid query:** prefetch sparse and dense, fuse server-side.
- **Payload indexes:** create one on every field you filter on (keyword, integer, datetime, text). Filters combine with ANN in the HNSW traversal.
- **Multitenancy:** one collection plus a tenant keyword field indexed with `is_tenant=True`; filter on tenant in every query, enforced in one data-access function, never at call sites. Collection-per-tenant does not scale (Cloud caps collections).
- **Quantization:** scalar int8 as the default (about 4x smaller, small recall loss); keep originals on disk and use `rescore` with oversampling. Binary and product quantization only with a measured need. Check the docs for the newer TurboQuant options before choosing.
- Match client and server minor versions.

```python
from qdrant_client import AsyncQdrantClient, models

client = AsyncQdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key.get_secret_value())

await client.create_collection(
    "faq",
    vectors_config={"dense": models.VectorParams(size=1024, distance=models.Distance.COSINE)},
    sparse_vectors_config={"sparse": models.SparseVectorParams(modifier=models.Modifier.IDF)},
    quantization_config=models.ScalarQuantization(
        scalar=models.ScalarQuantizationConfig(type=models.ScalarType.INT8, always_ram=True)),
)
await client.create_payload_index("faq", "tenant_id", models.KeywordIndexParams(
    type=models.KeywordIndexType.KEYWORD, is_tenant=True))
await client.create_payload_index("faq", "updated_at", models.PayloadSchemaType.DATETIME)

hits = await client.query_points(
    "faq",
    prefetch=[
        models.Prefetch(query=models.SparseVector(indices=idx, values=vals), using="sparse", limit=50),
        models.Prefetch(query=dense_vec, using="dense", limit=50),
    ],
    query=models.FusionQuery(fusion=models.Fusion.RRF),
    query_filter=models.Filter(must=[models.FieldCondition(key="tenant_id", match=models.MatchValue(value=tenant))]),
    limit=10,
)
```

Notes: RRF is the safe default; DBSF and weighted RRF need an eval set to tune. A prefetch `limit` must be at least `limit + offset`. Since Qdrant 1.20, server-side BM25 on a full-text payload index can replace client-side sparse encoders; check the release notes. Verify exact model class names against the installed client (they have been stable, but the client moves monthly).

## Ingestion idempotency

Use deterministic point ids so reruns overwrite instead of duplicating.

```python
import uuid
NS = uuid.UUID("6f1c0a52-3c6e-4b8e-9a1f-0d5d2f6a9c11")   # fixed namespace for this collection

def point_id(source_id: str, chunk_no: int, content_hash: str) -> str:
    return str(uuid.uuid5(NS, f"{source_id}:{chunk_no}:{content_hash}"))

await client.upsert("faq", points=[models.PointStruct(id=point_id(s, i, h),
    vector={"dense": d, "sparse": models.SparseVector(indices=si, values=sv)},
    payload={"source_id": s, "tenant_id": t, "updated_at": ts})], wait=True)
```

Include the content hash so an edited chunk gets a new id; delete stale ids for a source with a filter delete (`source_id == s` and `hash != current`). Batch 100 to 500 points. Record the embedding model name and dimension in the payload or a config row; changing the model needs a new collection (or new named vector) and a backfill.

## Cloud vs local

- Local: `docker run` a `qdrant/qdrant` container bound to `127.0.0.1` on a free port (default 6333 and 6334; check `docker ps` and `lsof -i :6333`), data in a named volume. Name it `<project>_qdrant`.
- Qdrant Cloud has a free tier (one small node, no SLA, about 1 GB RAM and 4 GB disk when checked). Confirm the current limits and any inactivity policy on the pricing page before relying on it. Paid clusters need the owner's yes.
- Self-host on the VPS only with the owner's yes; it adds backups and upgrades to maintain.
- Secrets: `QDRANT_URL`, `QDRANT_API_KEY` in env; production names are distinct from test names.

## Tests

- Unit: fake embedder that hashes text into a fixed-size vector (deterministic), `AsyncQdrantClient(":memory:")` or a throwaway container with a per-test collection name.
- Never call a real embedding API in tests; real-provider checks are opt-in behind an env var.
- Assert idempotency (upsert twice, count once), tenant isolation (tenant A cannot see B), and that deleting a source removes its points.

## Rationalizations

| Excuse | Do instead |
|---|---|
| "Vector DB is the standard for RAG" | Run the decision rule. Small corpora belong in pgvector. |
| "Store the document text in Qdrant too" | Store ids; fetch text from Postgres so ACLs and edits stay in one place. |
| "One collection per customer" | One collection, tenant field with `is_tenant`. |
| "Random UUIDs are fine" | Reruns then duplicate. Use deterministic ids. |

## Verification

- [ ] Decision rule applied with numbers, written down.
- [ ] Postgres remains the source of truth; backfill rebuilds the index.
- [ ] Payload indexes exist for every filter; tenant filter enforced centrally.
- [ ] Ingestion is idempotent; stale points are removed.
- [ ] Tests use a fake embedder and local Qdrant; no real providers.
- [ ] Client and server versions match; Versions block updated.

## References

None. Official docs: https://qdrant.tech/documentation/ (hybrid queries, multitenancy guide, quantization guide).

## Versions

- qdrant-client 1.20.0, Python >= 3.10 (verified 2026-11-05, https://pypi.org/project/qdrant-client/)
- Qdrant server v1.20.0 (verified 2026-11-05, https://github.com/qdrant/qdrant/releases)
- pgvector v0.8.7: `vector` indexed up to 2,000 dims, `halfvec` 4,000 (verified 2026-11-05, https://github.com/pgvector/pgvector)
- pgvector Python package 0.5.1 (verified 2026-11-05, https://pypi.org/project/pgvector/)
- Free-tier limits: unverified live; read https://qdrant.tech/documentation/cloud/ before quoting.
