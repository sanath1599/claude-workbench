---
name: running-cloud-routines
description: Use when setting up recurring or delayed unattended Claude work (a daily publish, a nightly report, maintenance, a one-off run at a set time), when a scheduled run stopped producing output, or when choosing between a cloud routine, an in-session cron, launchd and a CI schedule. Not for a one-time interactive handoff, which is kickoff:handing-off-to-cloud.
---

# Running cloud routines

Unattended runs fail quietly: a disabled routine, a cron that expired with its session, two copies of a session firing the same job, PRs piling up that nobody merges. Pick the trigger that matches what the run needs. Make every run idempotent and bounded. Prove the first run worked.

## When to use
- "Every day at…", "twice a day…", "run this tomorrow at 9", "why did nothing publish?".

## When not to use
- A one-time build in the cloud: kickoff:handing-off-to-cloud.

## Procedure

1. **Decide what runs where.**

   | Trigger | Runs without the laptop | Reaches local services and logins | Lifetime | Use for |
   |---|---|---|---|---|
   | Cloud routine (`/schedule`, RemoteTrigger) | yes | no: repo and allowlisted HTTPS only | until disabled | drafting, checking, opening PRs |
   | CI schedule (GitHub Actions with claude-code-action and an OAuth token secret) | yes | only the repo's secrets | until disabled | repo maintenance, reports, version checks |
   | launchd or cron with headless `claude -p` | no; the Mac must be awake | yes | until removed | steps that need local tools or logins |
   | In-session `CronCreate` | no | yes | dies with the session and expires after 7 days | a stopgap only |

   A cloud routine has no local services, CLI logins or GPU, so the prompt says so ("no local Postgres, no Vercel login; do not try to set them up"). Let the cloud draft, check and open a PR. Do the privileged release (a production push, a migration, a newsletter send) from a machine or CI job that holds the credentials, and name that step in the prompt.

2. **Check for what already exists:** `RemoteTrigger list` (or `/schedule list`), `CronList`, `ListAgents` (peer sessions in this repo), and `crontab -l` / `launchctl list | grep <label>`. Extend an existing routine rather than adding a second one.

3. **Write the routine prompt:**
   - The runbook path to read first, then the task.
   - Idempotency: check whether this slot's output already exists (a file, a PR, a published item) and stop if it does. Never backdate.
   - Hard limits:
     - one release per run;
     - touch only named paths;
     - no dependency, config, DNS, secret, database or email changes;
     - never force-push (if a push is rejected, push `<prefix>/<slug>` and report);
     - never bypass a failing check;
     - on any failure, stop and leave production unchanged.
   - Kill switch: if a committed `PAUSED` file exists, log "paused" and stop.
   - Output: a PR or branch, plus one log line (below).

4. **Configure the trigger:**
   - Model `sonnet`.
   - The environment id for cloud routines.
   - Connectors restricted to what the run needs; by default a routine inherits every account connector.
   - Narrow allowed tools and a budget cap (`--max-budget-usd` for headless runs).
   - For launchd, ship the plist as a template and let the owner install it.
   - Disable one-time routines after they fire.

5. **Prove the first run.** Trigger it now or wait for the slot. Then read the run (`RemoteTrigger` run list and log, `gh run view`, the log file) and confirm the output exists. Report the evidence.
   **Done when:** one real run succeeded and you showed it.

6. **Close the loop.** Decide who merges the routine's PRs, and when. If the answer is "a person", add a weekly sweep: list open routine PRs, merge or close them, and note duplicates. For an in-session cron, write its expiry date in the log.

## Quick reference: failure modes

| Failure | Counter |
|---|---|
| Routine silently disabled | check its last-run date whenever output stops |
| In-session cron expired or its session closed | use a durable trigger; otherwise re-create weekly and log the expiry |
| Two copies of a resumed session fire the same cron | `CronList` at session start; keep exactly one owner; stand down if `git status` shows staged files you didn't stage |
| PRs pile up, duplicates get published | one PR per slot, an idempotency check, a weekly sweep |
| Run failed but nobody noticed | a log line every run, and an alert on failure (email via Resend from CI) |

## Verification
- Each run appends one line to a committed log: date, slot, what shipped, evidence opened, checks run, checks **not** run, anything blocked.
- [ ] No duplicate trigger exists.
- [ ] The kill switch is in place, and so are idempotency and hard limits.
- [ ] The first run's output was shown.
