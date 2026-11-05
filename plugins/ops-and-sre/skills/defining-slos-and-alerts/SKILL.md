---
name: defining-slos-and-alerts
description: Use when setting reliability targets, choosing what to alert on, computing error budget or burn rate, reviewing noisy or missing alerts, or asked "is 99.9 enough" or "how long until we blow the budget". Not for adding the telemetry itself (instrumenting-services) or responding to a live alert (handling-incidents).
---

# Defining SLOs and alerts

Start from what the person on call needs to know, turn it into a measured indicator, set a target, and alert only on the rate at which the budget burns. Use the script for arithmetic; do not do burn-rate math in your head.

## When to use

- A new service needs targets or alerts.
- Alerts are noisy, late or missing.
- A question about availability maths, error budget, or burn rate.

## When not to use

- Emitting spans, logs and metrics: `ops-and-sre:instrumenting-services`.
- An alert is firing now: `ops-and-sre:handling-incidents`.

## Procedure

1. **Write the on-call questions.** List what someone woken at 3 am must be able to answer: Can users sign in? Do requests succeed and finish fast? Are jobs and workflows completing? Is the agent answering within its limit? Is a provider (LLM, email, LiveKit) failing? Is data fresh? Keep to five to eight. **Done when:** each question is a sentence a non-engineer would accept.
2. **Pick one SLI per question.** Define each as good events over valid events, measured where the user feels it: edge or load balancer, not an internal retry. Examples: successful non-5xx responses under 500 ms over all responses to `/api/*`; Temporal workflows completed without failure over those started; interviews that reach "connected" within 10 s. Exclude health checks, bots and known-bad input. **Done when:** each SLI names its numerator, denominator and data source, and the source exists today (otherwise raise an instrumentation task for `instrumenting-services`).
3. **Set SLO targets.** Start loose and honest: 99.5 or 99.9 for user-facing paths, lower for batch and internal tools; use a 30 day rolling window. Check the target against reality (last 30 days of the SLI) and against dependencies: you cannot beat the product of your providers. State the allowed bad minutes. **Done when:** each SLO is `SLI >= X% over 30 days` with the allowed outage minutes printed by the script.
4. **Compute the error budget.** Budget is `100% - SLO`. Run:
   `node scripts/burn-rate.mjs --slo 99.9 --window-days 30 --bad 40 --total 10000 --lookback-hours 1`
   It prints the burn rate (1.0x spends exactly the budget by window end), the share of budget consumed, hours to exhaustion, and the standard thresholds. Add `--ratio-1h 0.02 --ratio-5m 0.03` (also `6h`, `30m`, `1d`, `2h`, `3d`) to see which tiers fire. **Done when:** the output is pasted into the SLO doc as the worked example.
5. **Alert on burn rate with two windows.** Use the standard tiers: page when burn is at least 14.4x over 1 h and 5 m (2% of budget gone), page when at least 6x over 6 h and 30 m (5%); ticket when at least 3x over 1 d and 2 h, ticket when at least 1x over 3 d and 6 h. Both windows must exceed the threshold; the short window makes the alert reset fast. For low-traffic services, add a minimum request count or use a longer window, since three failures in ten requests is not a page. **Done when:** each tier is written as a rule in the monitoring tool the project uses (Logfire alerts, Vercel, Grafana, or a cron check).
6. **Hold every alert to four rules.** (a) Symptom-based: users are hurting or will within the budget, not "CPU is 80%". (b) Linked to a runbook in `docs/runbooks/` (`ops-and-sre:writing-runbooks`). (c) Owned: one named person or channel, written in the rule. (d) Test-fired once: trigger it on purpose (a fake failing check, a lowered threshold), see the page arrive, then restore. An alert missing any rule is a ticket to fix, not a page. **Done when:** a table lists each alert with runbook path, owner and the date it was test-fired.
7. **Review monthly.** Count pages that needed no action and delete or retune those. Update the SLO after budget burn or a postmortem. **Done when:** a dated entry sits in the SLO doc.

## Quick reference

| Tier | Burn rate (30 d) | Long / short window | Budget spent | Action |
|---|---|---|---|---|
| page-fast | 14.4x | 1 h / 5 m | 2% | page now |
| page-slow | 6x | 6 h / 30 m | 5% | page |
| ticket-day | 3x | 1 d / 2 h | 10% | ticket |
| ticket-slow | 1x | 3 d / 6 h | 10% | ticket |

| SLO | Allowed full outage per 30 days |
|---|---|
| 99% | 7.2 hours |
| 99.5% | 3.6 hours |
| 99.9% | 43.2 minutes |
| 99.95% | 21.6 minutes |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "Alert on CPU and memory too" | They are causes. Put them on a dashboard. |
| "100% uptime is the goal" | It has no budget and no releases. Pick a number. |
| "Skip the test-fire, the rule looks right" | Untested alerts fail silently. Fire it once. |
| "One window is simpler" | It pages late on slow burns and long after a fix. Use two. |
| "I'll work out the burn in my head" | Run the script. |

## Verification

- [ ] Every SLO has numerator, denominator, source, target, window
- [ ] Script output attached for at least one worked example
- [ ] Every alert is symptom-based, runbook-linked, owned, test-fired with a date
- [ ] Low-traffic guard considered

## References

| File | Load when |
|---|---|
| scripts/burn-rate.mjs | any budget or burn-rate arithmetic (run with `node`) |
