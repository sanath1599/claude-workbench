---
type: llm
weight: 3
---
Pass if the code sends through Resend with an idempotency key tied to the user (such as `welcome/<user id>`), handles the SDK's `{ data, error }` result without assuming it throws, and takes the sender from configuration rather than hardcoding an address.
