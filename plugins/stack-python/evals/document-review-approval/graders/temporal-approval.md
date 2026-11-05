---
type: llm
weight: 3
arm: with_plugin
---
Pass if the design runs the flow as a Temporal workflow that waits for the manager through a signal or update with a timeout of about 3 days (for example `workflow.wait_condition(..., timeout=timedelta(days=3))`) and defines what happens on timeout (reminder, escalation or default). Fail if it uses polling a database, a cron job or an in-process sleep.
