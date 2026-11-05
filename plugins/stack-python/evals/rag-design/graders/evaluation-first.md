---
type: llm
weight: 3
---

Pass if the design builds a golden set from real questions before or alongside the build, measures retrieval (recall@k, MRR or nDCG) separately from answers (faithfulness or groundedness, citation accuracy, refusal behaviour), calibrates any LLM judge against human labels, and gates changes in CI against a baseline. Fail if evaluation is only "try some questions manually" or relies on an uncalibrated LLM judge alone.
