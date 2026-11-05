---
type: llm
weight: 3
arm: with_plugin
---
Pass if the design dedupes on the provider event id (or an idempotency key) enforced by a unique constraint or inbox table, explicitly saying delivery is at-least-once rather than promising exactly-once. Fail if duplicates are not addressed.
