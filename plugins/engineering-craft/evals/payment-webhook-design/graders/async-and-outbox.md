---
type: llm
weight: 2
---

Pass if the design responds 2xx quickly and does the email and fulfilment asynchronously, using an outbox or a durable workflow so the order update and the follow-up work cannot diverge, and mentions retry limits or a dead-letter path.
