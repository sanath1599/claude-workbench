---
type: llm
weight: 3
---

Pass if the test uses a mock or injected transport (or a resend.dev test recipient) and never calls the real Resend API. Fail if the test needs a real API key or network. Bonus: the response says real sends need the owner's approval or an enable flag.
