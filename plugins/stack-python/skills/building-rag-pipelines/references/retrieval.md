# Retrieval

Contents: 1 Stage layout, 2 Hybrid search, 3 Metadata filters, 4 Multi-tenancy and ACLs, 5 Reranking, 6 Query transformation, 7 MMR and dedupe, 8 Score thresholds and refusal, 9 Context assembly.

## 1. Stage layout

```
query -> [rewrite?] -> embed -> dense top 50  \
                      -> sparse top 50        /-> fuse (RRF) -> filter by ACL (in the query) -> rerank top 30 -> top 5-8 -> dedupe/MMR -> assemble context
```

Every stage has a metric (see the evaluation guide) and a span. Add a stage only when the golden set shows the previous stage's recall is the limit.

## 2. Hybrid search

Dense vectors capture meaning but miss exact tokens (part numbers, names, error codes, acronyms). BM25 or other sparse retrieval catches those. Use both by default for knowledge bases; pure dense is acceptable for conversational FAQ text.

- **Qdrant**: named `dense` and `sparse` vectors, two `Prefetch` branches fused server-side with `FusionQuery(Fusion.RRF)`. Sparse vectors come from fastembed's BM25 encoder or SPLADE, or from the server's own text index in recent versions; verify the current option in the release notes. Full example in `stack-python:searching-with-qdrant`.
- **Postgres**: a `tsvector` generated column with a GIN index for lexical search plus an HNSW index on the `vector` column, fused with RRF in SQL. Stock `ts_rank` is not BM25; it is usually good enough, and extensions that provide BM25 exist if evals show you need them.

```sql
WITH dense AS (
  SELECT id, row_number() OVER (ORDER BY embedding <=> $1) AS r
  FROM chunk WHERE tenant_id = $2 AND acl && $3
  ORDER BY embedding <=> $1 LIMIT 50),
sparse AS (
  SELECT id, row_number() OVER (ORDER BY ts_rank_cd(tsv, q) DESC) AS r
  FROM chunk, websearch_to_tsquery('english', $4) q
  WHERE tenant_id = $2 AND acl && $3 AND tsv @@ q
  ORDER BY ts_rank_cd(tsv, q) DESC LIMIT 50)
SELECT id, sum(1.0 / (60 + r)) AS score
FROM (SELECT * FROM dense UNION ALL SELECT * FROM sparse) u
GROUP BY id ORDER BY score DESC LIMIT 30;
```

- RRF with k = 60 needs no score calibration and is the safe default. Weighted fusion needs the golden set to tune.
- On pgvector, a selective `WHERE` can starve an HNSW scan of results; enable iterative scans (`hnsw.iterative_scan`, available since pgvector 0.8) or, for a few large tenants, use partial indexes or partitions. Test recall with filters on, not only without. Check the pgvector README for current settings.
- Language: choose the text-search configuration per document language; do not push mixed-language content through `english`.

## 3. Metadata filters

- Filter inside the index query (pre-filter), never after retrieval: post-filtering the top 10 can leave zero results.
- Index every filtered field (Qdrant payload indexes, Postgres btree/GIN).
- Typical filters: `doc_type`, `lang`, date range, `valid_to is null`, `source`. Let the caller or an LLM-extracted filter set them, but validate against an allow-list of fields and values. An LLM must never supply `tenant_id` or ACL values.
- Self-query ("policies from 2024") is a query-rewrite step that returns a Pydantic model of filters; evaluate it separately because wrong filters silently drop the right chunk.

## 4. Multi-tenancy and ACLs

Leaking one tenant's chunk into another's answer is the worst RAG failure. Design so it cannot happen by accident.

1. **Derive tenant and principals from the authenticated session** on the server (`stack-python:building-fastapi-services` dependency), never from request bodies, query params or model output.
2. **One data-access function** builds every retrieval query and always injects the tenant filter and the ACL filter. Call sites cannot pass a raw filter that omits them. Make the function signature require a `Principal` object.
3. **Index-level isolation**: one collection with an indexed tenant field (Qdrant `is_tenant=True`), or Postgres row-level security keyed on a session variable set per request. For regulated or very large tenants, a separate collection or database is acceptable.
4. **ACL model**: store allowed principals (user ids and group ids) on the chunk, filter with `acl && :principals` (any-of). Public documents carry a sentinel principal. Prefer filtering by group over per-user lists so permission changes touch fewer rows.
5. **Authoritative check after retrieval**: re-verify the returned document ids against the source of truth (a Postgres join on current permissions) before building the prompt. The index payload may lag a permission change; this closes the gap.
6. **Caches** (query embeddings, retrieval results, answers) must include tenant and principal-set in the key, or they leak.
7. **Prompts and logs**: the context for tenant A never contains tenant B text; logs of retrieved text follow the tenant's retention policy.
8. **Tests that must exist**: (a) a question only tenant B can answer, asked as tenant A, returns a refusal and zero retrieved ids from B; (b) a revoked user stops seeing a document after the sync; (c) a fuzz test where the query text contains another tenant's id or "ignore the filter" has no effect; (d) the data-access function cannot be called without a principal. Run (a) in the golden set as a zero-tolerance gate.

## 5. Reranking

A cross-encoder reads the query and each candidate together, so it is much more precise than vector distance but too slow for the whole corpus. Retrieve 30 to 100 candidates, rerank, keep 5 to 8.

- Open source first: `BAAI/bge-reranker-v2-m3` (multilingual) via `sentence-transformers` `CrossEncoder`, or a smaller `bge-reranker-base` / `ms-marco-MiniLM` variant on CPU. fastembed also ships ONNX rerankers. Hosted rerankers (Cohere, Voyage, Jina) are an option when you cannot host a model.
- Cost: latency grows with candidates times chunk length. Batch the pairs, cap chunk length, run on GPU if you have one, and measure p95. Load the model once per worker.
- LLM-as-reranker (ask a model to order the candidates) works for tiny candidate sets but is slower, costlier and less stable; use only if a cross-encoder fails your evals.
- Evaluate: recall@5 and nDCG@5 with and without it, and the added milliseconds. If the gain is under your threshold, drop the stage.
- Reranker scores are not probabilities; calibrate a refusal threshold on the golden set (section 8).

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("BAAI/bge-reranker-v2-m3", max_length=512)   # load once at startup

def rerank(query: str, cands: list[Chunk], top_n: int = 6) -> list[Chunk]:
    scores = reranker.predict([(query, c.text) for c in cands], batch_size=16)
    ranked = sorted(zip(cands, scores), key=lambda p: p[1], reverse=True)
    return [c for c, _ in ranked[:top_n]]
```

Run the blocking model call off the event loop (`asyncio.to_thread` or a worker process) inside a FastAPI service.

## 6. Query transformation

Justify each with a measured gain; each adds an LLM call to the latency path.

| Technique | Helps with | Skip when |
|---|---|---|
| Conversational rewrite (standalone question from chat history) | Follow-ups like "and for contractors?" | Single-turn search. This one is almost always worth it for chat. |
| Multi-query (3 paraphrases, union, fuse) | Vocabulary mismatch between users and documents | Hybrid search already recovers the miss |
| HyDE (embed a hypothetical answer instead of the query) | Short queries against long, dense documents | The model lacks domain knowledge (it hallucinates a wrong hypothesis); corpus is jargon heavy |
| Decomposition (split a multi-part question, retrieve per part) | Comparison and multi-hop questions | Simple lookups |
| Step-back (ask a more general question first) | Narrow queries whose answer sits in general context | |
| Metadata self-query | Date, product, region constraints in the question | You have no filterable metadata |

Use a small fast model with a Pydantic output type, a low token cap and a timeout; fall back to the original query on failure. Keep the original query in the fused set so a bad rewrite cannot make things worse than baseline.

## 7. MMR and dedupe

- Overlapping chunks and near-duplicate documents fill the top k with the same text. Dedupe by `content_hash`, by parent id, and by high cosine similarity between candidates.
- Maximal Marginal Relevance picks results that are relevant but dissimilar to those already chosen: `score = lambda * sim(q, d) - (1 - lambda) * max sim(d, selected)`, with lambda about 0.7. Use it when answers need breadth (summaries, multi-source questions); skip it for single-fact lookup where it can bump the one right chunk.
- Cap chunks per document (for example 3) so one long document cannot crowd out others.

## 8. Score thresholds and refusal

- Decide "not enough evidence" before generation where possible: if the best reranker score is below a threshold tuned on the golden set (including `must_refuse` rows), return the refusal without calling the LLM. This saves cost and removes a hallucination path.
- Also let the model refuse: the output type has a `status` field (`SKILL.md`, generation section), and the evals check both paths.
- Log the top score per query; its distribution is a drift signal.

## 9. Context assembly

- Order: highest-scored first, or grouped by document in reading order when the answer needs a narrative; test both, since models weigh the start and end of long contexts more than the middle.
- Label each chunk with a short handle (`[1]`, `[2]`, or the chunk id) plus title, section and page. The model cites handles; code maps handles back to sources.
- Budget tokens: reserve the answer and the system prompt first, then fill context up to the budget. Prefer fewer, better chunks over a full window; measure answer quality against context size.
- Expand to the parent chunk or neighbouring chunks for the top hits when using small-to-big.
- Fence the chunks as untrusted data (`SKILL.md`, generation section).
