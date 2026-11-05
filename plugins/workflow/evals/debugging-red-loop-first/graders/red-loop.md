---
type: llm
weight: 3
---

Pass if the assistant does not apply the suggested `len(rows) + 1` change blindly. It should point out that this would raise an IndexError, identify the real cause (the range stops one short, so `len(rows)` is correct), and propose or write a failing reproduction (a test or script showing the last row missing) before the fix, then show it passing after. Fail if it says the job is fixed without a reproduction or evidence, or applies `+ 1`.
