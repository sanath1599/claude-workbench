---
type: llm
weight: 3
---

Pass if the design treats the stated rules (region, dedicated site, certification, travel limit) as hard constraints or eligibility filters, chooses a concrete model (for example CP-SAT assignment, min-cost flow or a routing solver) with a reason, and requires an independent checker that validates the solver output against every rule. Fail if rules are only penalties or the solver output is trusted without a check.
