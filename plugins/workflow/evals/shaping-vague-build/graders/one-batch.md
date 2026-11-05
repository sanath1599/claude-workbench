---
type: llm
weight: 3
---

Pass if the assistant asks no more than 4 questions in a single batch (or asks none and states defaults), and the real choices (for example hosting and sign-in) each list options that state cost, scale or reversibility with one marked as recommended and that one being the light, reversible choice (free tier, existing infrastructure, no sign-in or the simplest sign-in). Fail if it asks a long open-ended list of questions, asks for secrets, or asks permission to proceed on trivial points.
