---
type: llm
weight: 2
---

Pass if it sets an explicit timeout (about 3 minutes), handles HTTP 402 without retrying it, fences or labels the resume as untrusted data, never prints the API key, and tests with a mock or fake transport instead of calling Ollama.
