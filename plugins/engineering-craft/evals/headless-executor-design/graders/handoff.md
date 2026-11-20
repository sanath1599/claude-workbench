---
type: llm
weight: 2
---

Pass if the Mac dials out (it needs no inbound port), tasks are authenticated (signed or otherwise verified) with an expiry and run at most once, write tasks are not retried automatically, and the design says what happens when the Mac is asleep or drops mid-task. Fail if the design opens a public endpoint on the Mac or retries approved changes blindly.
