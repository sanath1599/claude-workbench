# Evaluating RAG

Contents: 1 Order of work, 2 Golden set, 3 Retrieval metrics, 4 Answer metrics, 5 LLM judge calibration, 6 Runnable harness, 7 CI gates, 8 Online feedback, 9 Library options.

## 1. Order of work

1. Evaluate retrieval alone first. If the right chunk is not in the top k, no prompt fixes the answer.
2. Then evaluate generation given the retrieved context.
3. Then end to end, with the real pipeline, on a schedule.
4. Change one thing per run (chunk size, model, reranker, prompt) and keep the report. A change without a before and after number did not happen.

## 2. Golden set

- Source the questions from reality: support tickets, search logs, chat transcripts, the owner's own questions. Synthetic questions generated from chunks are acceptable only as a supplement; they are easier than real ones because they echo the chunk's wording. Label how each row was made (`origin: real | synthetic`) and report metrics per origin.
- Start with 50 to 100 rows; 30 is enough to catch a broken pipeline. Grow it from every production failure.
- Row shape: `{id, question, tenant, relevant_ids, reference_answer, must_refuse, tags, origin}`.
- Label relevance on **stable ids** that survive re-chunking: use `source_id + section path` or a chunk hash prefix, and resolve to current chunk ids at eval time. Labels pinned to positional chunk ids break at the first chunking change.
- Include: multi-hop questions (two chunks needed), questions with near-duplicate distractors, questions whose answer is in a table, acronym-only queries, out-of-scope questions (`must_refuse: true`), and cross-tenant probes (a question that only tenant B can answer, asked as tenant A: the right result is a refusal).
- Split: keep a held-out 20 percent that you do not tune against.
- Store the set in the repo as JSONL, reviewed like code. No customer personal data in a public repo; redact or keep it in a private store.

## 3. Retrieval metrics

| Metric | Question it answers | Use for |
|---|---|---|
| recall@k | Did the needed chunk(s) appear in the top k? | The first gate; pick k as the number of chunks you pass to the LLM, and also report at the pre-rerank candidate depth. |
| MRR | How high is the first relevant chunk? | Single-answer lookup. |
| nDCG@k | Are relevant chunks ranked above irrelevant ones? | Multi-chunk answers, reranker comparisons. |
| precision@k / context precision | How much of the context is noise? | Cost and distraction. |
| hit rate on refusal rows | Did the system find nothing relevant when nothing exists? | Calibrating the score threshold. |

Compute them with `python3 scripts/eval_retrieval.py results.jsonl --k 1,3,5,10 --min-recall 5=0.85 --min-mrr 0.6` from rows of `{question, relevant_ids, retrieved_ids}`. The script excludes unanswerable rows and exits 1 when a gate fails. Report stage-wise numbers: dense only, sparse only, hybrid, hybrid plus rerank. The gap between recall@50 (candidates) and recall@5 (after rerank) tells you whether to fix retrieval or reranking.

## 4. Answer metrics

| Metric | Definition | How to measure |
|---|---|---|
| Faithfulness (groundedness) | Every claim in the answer is supported by the retrieved context | LLM judge over (context, answer), claim by claim |
| Citation validity | Every cited id was retrieved | Deterministic: set containment |
| Citation accuracy | The cited chunk actually supports the sentence it is attached to | LLM judge per (sentence, cited chunk) |
| Answer correctness | Matches the reference answer on the facts that matter | LLM judge against `reference_answer`, or exact checks for numbers and ids |
| Answer relevance | Answers the question asked | LLM judge |
| Refusal correctness | Refuses exactly when `must_refuse` | Deterministic on a structured `status` field |
| Tenant isolation | No cited or retrieved chunk belongs to another tenant | Deterministic: a hard zero-tolerance gate |

Prefer deterministic checks wherever the output is structured: have the model return `status: answered | insufficient_evidence` and `citations: list[str]`, then assert on those without a judge.

## 5. LLM judge calibration

A judge is a model under test. Trust it only after measuring it.

1. Hand-label 40 to 60 (context, answer) pairs as pass or fail, with a one-line reason. Two labelers if possible; resolve disagreements.
2. Run the judge on the same pairs. Report agreement, and the false-pass and false-fail rates separately. For RAG, a false pass (judge approves an unfaithful answer) is the dangerous one.
3. Read every disagreement and tighten the rubric: define the failure, give one passing and one failing example, require a quoted supporting span as evidence in the output.
4. Use a judge from a different model family than the generator when you can, and a stronger one than the generator for faithfulness.
5. Pin the judge model and rubric version in the report. Re-calibrate when either changes.
6. Judge outputs are structured (`pass: bool`, `evidence: str`, `reason: str`), temperature low, run twice on borderline cases.

## 6. Runnable harness

Verified to run with `uv run --with pydantic-evals python harness.py` (pydantic-evals 2.66.0, exit code 0 when every citation check passes). The toy `rag` function stands in for the real pipeline; replace it with a call that returns the same `RagOut` shape. `LLMJudge` can be added to `evaluators` for faithfulness once calibrated (see `stack-python:building-pydantic-ai-agents` references/patterns.md section 16); keep real-model runs behind an env var.

```python
"""Minimal RAG eval harness: retrieval metrics plus a deterministic groundedness check.

Run: uv run --with pydantic-evals python harness.py
Swap `retrieve` and `answer` for the real pipeline. No network, no real model.
"""
import asyncio
import re
from dataclasses import dataclass

from pydantic import BaseModel
from pydantic_evals import Case, Dataset
from pydantic_evals.evaluators import Evaluator, EvaluatorContext


class RagIn(BaseModel):
    question: str
    tenant: str = "t1"


class RagOut(BaseModel):
    answer: str
    cited_ids: list[str]
    retrieved_ids: list[str]


class RagExpected(BaseModel):
    relevant_ids: list[str]
    must_refuse: bool = False


CORPUS = {
    "c1": "Refunds are issued within 14 days of purchase.",
    "c2": "Support is open Monday to Friday.",
}


STOP = {"the", "is", "a", "of", "to", "do", "how", "what", "are", "within"}


def toks(text: str) -> set[str]:
    return set(re.findall(r"\w+", text.lower())) - STOP


async def rag(inp: RagIn) -> RagOut:  # replace with the real pipeline
    q = toks(inp.question)
    hits = sorted((i for i in CORPUS if q & toks(CORPUS[i])), key=lambda i: -len(q & toks(CORPUS[i])))
    if not hits:
        return RagOut(answer="I cannot answer from the provided documents.", cited_ids=[], retrieved_ids=[])
    return RagOut(answer=f"{CORPUS[hits[0]]} [{hits[0]}]", cited_ids=[hits[0]], retrieved_ids=hits)


@dataclass
class RecallAtK(Evaluator[RagIn, RagOut, RagExpected]):
    k: int = 5

    def evaluate(self, ctx: EvaluatorContext[RagIn, RagOut, RagExpected]) -> dict[str, float]:
        rel = set(ctx.expected_output.relevant_ids)
        if not rel:
            return {}
        return {f"recall@{self.k}": len(rel & set(ctx.output.retrieved_ids[: self.k])) / len(rel)}


@dataclass
class CitationsValid(Evaluator[RagIn, RagOut, RagExpected]):
    """Every cited id must have been retrieved; refusals must cite nothing."""

    def evaluate(self, ctx: EvaluatorContext[RagIn, RagOut, RagExpected]) -> dict[str, bool]:
        out, exp = ctx.output, ctx.expected_output
        ok = set(out.cited_ids) <= set(out.retrieved_ids)
        if exp.must_refuse:
            ok = ok and not out.cited_ids
        return {"citations_valid": ok}


dataset = Dataset[RagIn, RagOut, RagExpected](
    name="rag-golden",
    cases=[
        Case(name="refund-window", inputs=RagIn(question="How long do refunds take?"),
             expected_output=RagExpected(relevant_ids=["c1"])),
        Case(name="unanswerable", inputs=RagIn(question="What is the CEO's salary?"),
             expected_output=RagExpected(relevant_ids=[], must_refuse=True)),
    ],
    evaluators=[RecallAtK(k=5), CitationsValid()],
)

if __name__ == "__main__":
    report = asyncio.run(dataset.evaluate(rag))
    report.print(include_input=False, include_output=False)
    failed = [c.name for c in report.cases if not c.assertions.get("citations_valid", None) or not c.assertions["citations_valid"].value]
    raise SystemExit(1 if failed else 0)
```

For retrieval-only runs without any library, use `scripts/eval_retrieval.py`.

## 7. CI gates

- Per pull request: retrieval metrics against a fixed small set with the deterministic fake embedder or a recorded fixture of embeddings; fail on any drop below the stored baseline minus a tolerance (for example recall@5 down more than 0.03). Also fail on: any cross-tenant hit, any invalid citation, any answered `must_refuse` row.
- Nightly or on demand: the full set with real models, judge-based metrics, cost and latency per question. Opt-in behind an env var (for example `RUN_RAG_EVAL=1`); never in the default test run.
- Store the baseline JSON in the repo; update it in the same pull request that justifies the change.
- Report variance: LLM-based metrics move between runs. Run twice, or gate on a band, not a point.

## 8. Online feedback loop

- Log per answer: question, tenant (hashed if needed), retrieved ids with scores, cited ids, status, latency per stage, token counts, model and prompt versions.
- Collect thumbs up or down plus an optional reason, and "no answer" events (refusals, zero hits, low top score).
- Weekly: sample the worst-rated and refused questions, label them, and add them to the golden set with the ids that should have been found. This is the main source of new golden rows.
- Watch drift: top-1 score distribution, refusal rate, share of answers with no citation. A sudden shift usually means an ingestion regression, not a model change.
- Privacy: apply the same retention and redaction rules to logged questions as to documents.

## 9. Library options

| Option | Fit | Fair note |
|---|---|---|
| `pydantic-evals` | Default here. Same ecosystem as Pydantic AI, typed cases, custom evaluators, `LLMJudge`, Logfire integration. | Few ready-made RAG metrics; you write retrieval and citation evaluators (about 20 lines each). |
| Ragas | Ready-made RAG metrics (faithfulness, context precision and recall, answer relevancy) and synthetic test-set generation. | Metric APIs and defaults have changed between minor versions; pin the version and read its docs. Last release on PyPI was January 2026 when checked, so confirm it is maintained and compatible with your Python before adopting. Its judge prompts are generic; calibrate them like any other judge. |
| DeepEval | pytest-style RAG metrics, large catalogue. | Heavier, with a commercial platform alongside; check which features need the hosted service. |
| TruLens | Tracing plus feedback functions. | Overlaps with Logfire; adopt only if you want its dashboards. |

Rule: borrow metric definitions freely, but own the golden set and the judge calibration whichever library you use. A library score you cannot explain is not a gate.
