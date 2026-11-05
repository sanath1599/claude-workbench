---
type: llm
weight: 3
arm: with_plugin
---
Pass if the agent is built with Pydantic AI, uses a Pydantic model as `output_type`, and is made durable with the `TemporalDurability` capability (with a stable agent `name`) or an equivalent explicit activity-per-LLM-call design. Fail if it uses LangChain, a hand-written retry loop around the LLM, or the deprecated `TemporalAgent` without noting it is deprecated.
