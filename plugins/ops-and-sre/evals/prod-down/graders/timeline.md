---
type: llm
weight: 3
arm: with_skill
---
Pass only if the response (1) creates or starts a file named like docs/incidents/YYYY-MM-DD-<slug>.md before investigating and appends timestamped entries, (2) sets a severity, (3) proposes mitigation (rollback, flag off, restart including the worker) before hunting the root cause, (4) gives the owner a short plain-words update, (5) asks for a yes before any production change that needs one. Fail if it spends its turns root-causing with no timeline file or mitigation step.
