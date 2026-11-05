# Calibration: fair, not generous

## Score structure

```python
from pydantic import BaseModel, Field

class CriterionScore(BaseModel):
    criterion: str
    score: int = Field(ge=0, le=4)          # anchored bands, not a free 1-10
    evidence: str | None                    # exact quote from the input; None means no evidence
    rationale: str

class Judgement(BaseModel):
    criteria: list[CriterionScore]
    insufficient_evidence: bool = False
```

Code, not the model, produces the final number:

```python
WEIGHTS = {"technical_depth": 0.4, "problem_solving": 0.3, "communication": 0.3}

def total(j: Judgement) -> float:
    raw = sum(WEIGHTS[c.criterion] * c.score for c in j.criteria) / 4 * 100
    return min(raw, cap_for(j))

def cap_for(j: Judgement) -> float:
    caps = [100.0]
    by = {c.criterion: c for c in j.criteria}
    if any(c.evidence is None and c.score > 1 for c in j.criteria):
        caps.append(60.0)                    # claims without evidence cannot score high
    if by["technical_depth"].score <= 1:
        caps.append(45.0)                    # a failed must-have caps the overall result
    if j.insufficient_evidence:
        caps.append(50.0)
    return min(caps)
```

Log every cap that fires, with the reason, next to the score.

## Rubric anchors

For each criterion write what 0, 2 and 4 look like in observable behaviour. Example for problem solving:
- 0: no attempt, or restates the question.
- 2: proposes one workable approach but does not test it or mention trade-offs.
- 4: compares approaches, states assumptions, checks edge cases, corrects an error unprompted.

Tell the model: most real answers sit at 1 to 2; 4 requires explicit evidence; absence of evidence is not evidence of ability.

## Calibration test

Keep a labelled fixture set: at least 5 clearly weak, 5 average and 5 strong inputs, plus 3 adversarial ones (flattery, injection, padded filler). Run against a recorded model response for CI and the real model in an env-guarded test.

```python
def test_scores_are_calibrated(scored):  # scored: dict[label, list[float]]
    assert max(scored["weak"]) < 40
    assert min(scored["strong"]) > 65
    assert mean(scored["strong"]) - mean(scored["weak"]) > 30
    assert mean(scored["average"]) < 75          # not generous
    assert stdev(all_scores) > 10                # not clustered
    assert max(scored["adversarial"]) < 50       # flattery and injection do not pay
```

Repeat each fixture 3 to 5 times in the opt-in test; assert the spread per input stays within about 10 points.

## Drift

Re-run the calibration set when the prompt, the rubric, or the model changes. Treat a shift in the mean score of more than a few points as a regression until a human confirms otherwise.

## Verify evidence quotes in code

Ask for evidence as verbatim quotes with a pointer to the source answer. In code, normalise whitespace and case and confirm each quote is a substring of the stored transcript (try the pointed answer first, then search all). Drop quotes that fail. A criterion left with zero verified quotes becomes Not Assessed (`None`), not a low score, and is excluded from the weighted total rather than counted as zero. This is the check that stops the model inventing support.

## Caps that scale with proof (1 to 5 scale)

- A 4 needs at least two verified quotes, else 3.
- A 5 needs quotes from at least two different answers, else 4.
- If live per-answer analysis rated every answer on the criterion shallow or none, cap at 3.
- Store an `adjustment` text beside the final score ("Model scored 5; capped at 4: one verified quote") and show it to the reviewer.

Tell the model to pick the lower level when torn between two, and to treat a criterion nobody asked about as Not Assessed.

## Normalise rubric weights

When the model proposes the rubric, do not trust its keys or weights. In code: slugify names into unique `[a-z][a-z0-9_]` keys (suffix `_2` on collision), cap the count (for example 10), scale weights to integers that sum to exactly 100 with largest-remainder rounding, and give every criterion at least 1. Unit-test odd inputs: all zero, NaN, one item.
