---
name: handling-incidents
description: Use when production is down, slow or wrong, users report errors, an alert fires, a deploy went bad, or the owner says "incident", "outage", "prod is broken" or asks for a postmortem. Not for planned releases (releasing-safely) or designing alerts (defining-slos-and-alerts).
---

# Handling incidents

Stop the harm first, understand it second. Everything done during the incident is written to a timeline file as it happens, so the postmortem uses evidence and not memory.

## When to use

- Users or the owner report breakage in a live system.
- An alert fired, a health check fails, a deploy just made things worse.
- After an incident, to write the postmortem.

## When not to use

- A bug in development with no live impact: a debugging skill.
- Tuning alerts after the fact: `ops-and-sre:defining-slos-and-alerts`.

## Procedure

1. **Open the timeline now.** Create `docs/incidents/YYYY-MM-DD-<slug>.md` (use `date -u` for the date; slug is two to four words) before investigating. Start from the template below. From here on, append a line `HH:MM:SSZ - <what you saw, did or decided>` after every action: commands run, outputs that mattered, hypotheses, decisions, owner messages. Use UTC and the owner's {{wb.timezone}} for the human summary. **Done when:** the file exists with a first entry.
2. **Set severity.** SEV1: production down or data loss or security exposure for all users. SEV2: a core flow broken or degraded for many users. SEV3: partial or workaround exists. SEV4: cosmetic. Write it in the file and revise it as facts change. Possible secret exposure is at least SEV2 and starts rotation planning with the owner. **Done when:** severity and the user-visible symptom are written in one sentence each.
3. **Tell the owner, in plain words.** Four lines: what users see, how many it affects (or "unknown"), what you are doing now, when you will update next. No jargon, no blame, no guesses stated as facts. Update at the time you promised even if nothing changed. **Done when:** the message is sent and logged.
4. **Mitigate before root-causing.** In order of speed and safety: turn off the feature flag; roll back the last deploy (`releasing-safely` step 8); scale or restart the affected process (remember Temporal workers too); fail over; block the bad traffic. Choose the least risky action that stops the harm. Anything that is a production change under the owner's rules (infra, DNS, migration, paid resource) still needs a yes; ask in one message with the effect and the undo. A rollback of code the owner already approved to be live is reversible and you may propose it with the same message. Back up config before changing it. **Done when:** the symptom is gone, verified by the same check that showed it (not by "it looks fine").
5. **Find the cause with evidence.** Collect before concluding: deploy and commit times, logs and traces (Logfire, `vercel logs`, `journalctl -u <unit>`, `pm2 logs`), metrics, config diffs, provider status pages, the first failing request. Build the timeline of what changed against when it broke. State the cause only if one piece of evidence points to it and an alternative was ruled out; otherwise write "unknown, leading hypothesis X". **Done when:** each claim in the timeline has a source.
6. **Resolve.** Confirm recovery with a side-effect-free check and a quiet period, set status resolved with the time, and message the owner: what happened, what fixed it, what is still open. **Done when:** resolution time is in the file.
7. **Write the postmortem in the same file** within a day: summary, impact (who, how long, how many), timeline (copy from the log, trimmed), root cause and contributing factors with evidence links, what went well, what went badly, where we got lucky. Blameless: describe systems and decisions, never people's faults. Action items each have an owner, a due date, a type (detect, mitigate, prevent) and a ticket or checkbox; include a runbook update and, if no alert caught it, an alert. **Done when:** every action item is specific enough to start without asking.

## Timeline template

```
# <Title>
Status: investigating | mitigated | resolved    Severity: SEV?
Detected: <time> by <alert|user|owner>    Resolved: <time>
Impact: <who, what, how long>

## Timeline (UTC)
- HH:MM:SSZ - <entry>

## Postmortem
### Root cause
### Contributing factors
### What went well / badly / luck
### Action items
- [ ] <action> - owner - due - detect|mitigate|prevent
```

## Rationalizations

| Excuse | Do instead |
|---|---|
| "I'll write it up afterwards" | Memory is wrong in hours. Append as you go. |
| "Find the cause first, then fix" | Mitigate first; the cause will still be there. |
| "Probably the last deploy" | Prove it with times and logs, or say unknown. |
| "Owner is busy, skip the update" | Send four plain lines. Silence is worse. |
| "Restart everything" | Restart the failing part and log it; keep evidence (logs) first. |
| "Whose fault was it" | Ask what let it happen. Blameless. |

## Verification

- [ ] Timeline file exists with timestamps for each action
- [ ] Severity set; owner informed in plain words and updated on time
- [ ] Recovery confirmed by the original failing check
- [ ] Postmortem cites evidence; action items owned and dated

## Related skills

- `ops-and-sre:writing-runbooks` when an action item says update the runbook.
- `ops-and-sre:defining-slos-and-alerts` when no alert caught the incident.
