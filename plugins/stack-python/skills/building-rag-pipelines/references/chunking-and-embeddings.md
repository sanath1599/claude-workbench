# Chunking and embeddings

Contents: 1 Chunking strategies, 2 Sizes, 3 Tables and code, 4 Embedding models, 5 Re-embedding migrations, 6 Batching and cost.

## 1. Chunking strategies

| Strategy | How | Use when | Watch for |
|---|---|---|---|
| Structure-aware (default) | Split on headings, keep the heading path with the chunk, pack paragraphs inside a section up to a size cap | Manuals, policies, wikis, Markdown, converted DOCX/PDF | Sections of wildly different sizes: merge tiny ones, window the huge ones |
| Sliding window with overlap | Fixed size (characters or tokens), 10 to 20 percent overlap, cut on whitespace or sentence ends | Unstructured text, transcripts, OCR output | Overlap duplicates text, inflating index size and producing near-duplicate hits (dedupe after retrieval) |
| Semantic | Embed sentences, cut where adjacent-sentence similarity drops | Long unstructured prose where headings are absent | Costs an embedding pass at ingestion and is nondeterministic across model versions; measure against the cheap baselines before adopting |
| Parent/child (small-to-big) | Embed small child chunks (one paragraph or 200 to 400 tokens), store the larger parent (section or about 1,000 to 2,000 tokens); retrieve children, return parents | Precise matching is needed but the LLM needs surrounding context | Dedupe parents after retrieval; count the parent budget in the prompt, not the child count |
| Late chunking / contextual chunks | Prepend a short document or section context line to each chunk before embedding (heading path, title, or an LLM-written one-sentence situating summary) | Chunks that are ambiguous alone ("the fee is 5 percent") | An LLM-written context costs one call per chunk at ingestion; start with the free version, the heading path |
| Record-per-row | One chunk per row/FAQ/ticket | Spreadsheets, FAQs, catalogues | Fine; embed question and answer together |

Start with structure-aware plus heading-path prefix. Add parent/child when evals show right-document, wrong-passage misses. Try the others one at a time against the golden set.

`python3 scripts/chunk.py FILE --max-chars 1200 --overlap 150` demonstrates the structure-aware plus sliding-window combination with stable ids and hashes.

What to embed versus what to store: embed `"{title} > {section_path}\n\n{text}"`; store the raw `text` separately for display and citation. Keep the embedded string byte-identical between ingestion and re-embedding, and version the template.

## 2. Sizes

- Measure in tokens of the embedding model's tokenizer when you can; characters divided by 4 is a rough English estimate.
- Starting points, tuned on evals: 200 to 400 tokens for FAQ/precise lookup, 400 to 800 for manuals and policies, 1,000+ only with a long-context embedding model and a parent/child setup.
- Never exceed the embedding model's maximum input; most truncate silently, which loses the tail of the chunk. Check the model card for its limit and its recommended length (many perform best well below the maximum).
- Smaller chunks raise precision and index size; larger chunks raise recall of context and dilute the embedding. The golden set decides, not a rule of thumb.
- Set a minimum (about 50 to 100 characters) and merge fragments forward within the same section; a lone heading or a two-word chunk is noise.

## 3. Tables and code

- **Tables**: keep a table whole when it fits; otherwise split by rows and repeat the header row and caption in every piece. Render as Markdown (models read it well). For lookup tables with many rows, also consider row-per-chunk records. Tables that answer numeric questions belong in SQL, not in the index.
- **Code**: split on function/class boundaries (tree-sitter, or `ast` for Python), not on character counts; prefix each chunk with file path and symbol name; keep docstrings with their function. Embed with a model trained on code if code questions are the main use.
- **Never split inside a fenced block or table** unless a single block exceeds the cap; then split on line boundaries and repeat the fence/header.
- **Lists**: keep a list with its introducing sentence.
- **Figures**: embed the caption and nearby text; for diagrams that matter, store an LLM-written description as a separate retrievable chunk linked to the figure.

## 4. Embedding models

Choose by measuring on your golden set, with cost, latency, language coverage and data sensitivity as constraints. Check the current model cards and leaderboards (MTEB and its multilingual variants) before choosing, because the field moves monthly.

| Route | Examples (verify availability and dimensions) | Pros | Cons |
|---|---|---|---|
| Open source through Ollama | `bge-m3`, `nomic-embed-text`, `mxbai-embed-large`, `embeddinggemma`, `qwen3-embedding` (pull with `ollama pull`; embed with the `/api/embed` endpoint, which accepts a list of inputs) | Free per call, data stays local, same runtime as local LLMs | You host it; throughput is bounded by your hardware. Confirm whether Ollama Cloud serves an embedding model before assuming it does. |
| Open source through sentence-transformers or fastembed | Same families, plus `bge-*`, `e5-*`, `gte-*`; fastembed runs ONNX models on CPU with a small footprint and also supplies sparse (BM25) encoders | Fine-tunable, no network, deterministic | Memory and CPU/GPU capacity; load once per worker, not per request |
| Hosted API | Voyage, Cohere, OpenAI, Google embedding models | No ops, strong quality, long inputs | Per-token cost, data leaves your boundary, rate limits, vendor drift (model versions get retired) |

Decision rules:
- Default to an open-source multilingual model run locally or on the worker host unless evals show a hosted model is clearly better on your data.
- Prefer models with Matryoshka support when you want to trade dimensions for storage: truncate to a smaller dimension and re-normalise, then measure recall loss.
- Dimension drives storage and speed: 1024 float32 is 4 KB per vector. At 5 million chunks that is about 20 GB before index overhead. Use scalar int8 quantisation (Qdrant) or `halfvec` (pgvector) when memory is the constraint (`stack-python:searching-with-qdrant`).
- Respect the model's prefix conventions: many retrieval models need different prefixes for queries and documents (for example `query: ` and `passage: `, or a task instruction). Missing the prefix silently costs recall; put it in the one embedding function and test it.
- Normalise vectors when the model expects cosine similarity, and set the index distance to match.
- Record `embedding_model`, `embedding_dim` and a template `embedding_version` on every chunk.
- Query and document embeddings must come from the same model and version. Never mix.

## 5. Re-embedding migrations

Changing the model, the dimension, the prefix template or the chunker invalidates stored vectors. Do it as a blue/green migration:

1. Create a new collection (or table column / named vector) named with the generation, for example `docs_v2_bge_m3_1024`.
2. Backfill from Postgres (the source of truth) with a Temporal workflow; do not read vectors out of the old index.
3. Dual-write new and changed documents to both generations during the backfill.
4. Run the golden set against both. Promote only if the gates pass and latency and cost are acceptable.
5. Switch reads through a config value (an alias in Qdrant, a view or setting in Postgres), keep the old generation for a rollback window, then delete it.
6. Record the migration in the runbook with the old and new numbers.

Never update vectors in place in a live collection with a different model: queries would compare vectors from two spaces.

## 6. Batching and cost

- Batch inputs per call (Ollama `/api/embed` takes a list; hosted APIs have per-request token and item caps). Sort by length within a batch to cut padding in local models.
- Embed only new content hashes (the idempotency rules in the ingestion guide) and cache by `(model, content_hash)`.
- Estimate before a backfill: chunks x average tokens x price, or chunks / throughput for local models. State the number before running a paid backfill; paid resources need the owner's yes.
- Rate limits: bounded concurrency, exponential backoff with jitter, honour `Retry-After` (`stack-python:calling-llms-reliably`).
- Query-time embedding is on the latency path: keep the model warm, cache embeddings of repeated queries (hash of normalised query plus model version) with a short TTL.
