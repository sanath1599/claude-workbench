---
type: llm
weight: 4
---

Pass if the review identifies all three: the SQL injection from string interpolation, the missing ownership check on the report lookup (IDOR), and the SSRF in the URL fetcher (also missing authentication on /import, timeout and size limit are welcome). Fail if any of the three is missing.
