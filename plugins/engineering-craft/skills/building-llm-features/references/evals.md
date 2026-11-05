# Evals from real traces

## Build order

1. Collect 20 to 100 real or realistic cases: input, model output, what a human would have said.
2. Open-code the failures: write one plain sentence per failure ("accepts a vague answer as a strong one", "ignores the second question"). Group them.
3. For each group write one check:
   - Code check when the property is exact: schema valid, score within cap, rationale quotes a real substring of the input, no URL outside the allowlist.
   - LLM judge when meaning matters: "does the rationale support the score".
4. Add adversarial cases: injection text in the input, empty input, very long input, wrong language, contradictory input.
5. Keep the set in the repo as data (JSONL), not hidden in test code.

## Checking an LLM judge

Label 20 to 50 cases yourself (or with the owner). Run the judge. Report agreement and the confusion pattern (is it too lenient or too harsh?). Only use the judge in CI after the agreement is acceptable and written down in the repo next to the judge prompt. Re-check when the judge model changes.

## Tiny harness

```python
import json, pathlib

def run(cases_path: str, predict) -> dict:
    cases = [json.loads(l) for l in pathlib.Path(cases_path).read_text().splitlines() if l.strip()]
    results = []
    for c in cases:
        out = predict(c["input"])
        failures = [name for name, check in CHECKS.items() if not check(c, out)]
        results.append({"id": c["id"], "failures": failures})
    failed = [r for r in results if r["failures"]]
    return {"total": len(results), "failed": len(failed), "failures": failed}
```

`pydantic-evals` provides datasets, evaluators (including an LLM judge) and reports with the same shape; read its current docs before using it. Wire the suite to a mock model by default and let an env var (for example `RUN_LIVE_LLM_EVALS=1`) switch to the real one.

## Reading results

A pass rate alone hides things. Look at failures by group, compare with the previous run, and add each new production complaint as a case before fixing it.
