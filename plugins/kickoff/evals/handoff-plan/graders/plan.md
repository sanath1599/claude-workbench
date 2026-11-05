---
type: llm
weight: 3
---

PASS if the plan:
- pushes everything first, because cloud sessions only see the pushed repo;
- vendors rules, skills and hooks into the repo, because cloud sessions do not load plugins or ~/.claude;
- lists owner-machine steps the cloud must not do (production deploys, remote migrations, paid resources);
- provides mocks or a local database for missing keys and services;
- creates or selects the environment in the claude.ai web UI;
- writes a handoff brief with hard limits;
- launches with claude --cloud or a routine, and proves the start with evidence (session URL plus branch activity or a reply).
FAIL if it would claim the session started without evidence, or if it relies on local plugins being available in the cloud.
