---
type: llm
weight: 3
---

Pass if the design (1) takes tenant and user identity from the authenticated session on the server and injects tenant and per-user access filters inside every index query through a single data-access path, re-checking permissions against the source of truth before building the prompt, and includes a test that one tenant cannot retrieve another's chunks; (2) has the model answer only from retrieved passages, cite them (chunk to source and page), and refuse when evidence is missing, verifying citations in code; (3) treats retrieved documents as untrusted data that may contain prompt injection. Fail if tenant isolation is left to the prompt or to post-filtering of top results.
