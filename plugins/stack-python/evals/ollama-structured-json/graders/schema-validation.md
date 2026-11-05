---
type: llm
weight: 3
---

Pass if the code embeds the JSON Schema (for example `Candidate.model_json_schema()`) in the prompt, validates the response with Pydantic, and retries by sending the validation error back, with a bounded number of attempts. Fail if it relies on `NativeOutput` or server-side `response_format` alone, since Ollama Cloud does not enforce JSON Schema.
