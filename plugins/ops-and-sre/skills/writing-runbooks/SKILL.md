---
name: writing-runbooks
description: Use when writing or updating a runbook, DEPLOYMENT.md, on-call guide or owner-machine script, or when an incident action item says document this. Triggers on "runbook", "DEPLOYMENT.md", "how do I redeploy". Not for incident response itself (handling-incidents) or the VPS procedure (deploying-to-a-vps).
---

# Writing runbooks

A runbook is a list of commands someone can run half asleep. It states what is true now, with no hedging, and it has been read cold by someone who has never seen the system.

## When to use

- A procedure was done by hand twice and will be done again.
- `DEPLOYMENT.md` is missing, stale or vague.
- An alert needs a runbook link, or a postmortem names one.
- The owner must run a step on their own machine (auth, secrets, production).

## When not to use

- Responding to a live incident: `ops-and-sre:handling-incidents`.
- Deciding alert content: `ops-and-sre:defining-slos-and-alerts`.

## Procedure

1. **Match the project's format.** Read the existing `DEPLOYMENT.md` and `docs/runbooks/` first and keep their headings, tone and file layout. Use `assets/runbook.md` only when nothing exists. Documents describe the current system in plain sentences: no "should", "might", "we plan to", no history of how it got this way. **Done when:** your draft would not look out of place in the existing file.
2. **Write the runbook sections.** Title and one line of purpose; when to use it (the alert name or symptom); prerequisites (access, tools, which machine); numbered steps, each one a single action; a check after every risky step with the expected output; rollback; who to tell. **Done when:** each step is one command or one decision.
3. **Use exact commands.** Full commands with real flags, host aliases and paths, ready to paste. Placeholders are marked `<LIKE_THIS>` and explained once. State the working directory. Name what a good result looks like (an exit code, a line of output, an HTTP status and version marker). Never include secret values, tokens or connection strings; refer to the variable name and where it is stored. **Done when:** a reader never has to guess a flag, path or host.
4. **Write owner-machine steps as scripts.** Anything needing the owner's auth, a secret or production access becomes `scripts/<name>.sh` that: starts with `set -euo pipefail`; reads secrets from the environment or a prompt with `read -rs`, never from arguments; never echoes secrets (no `set -x`, no `env`, no printing URLs with credentials); prints each step and what it verified; backs up what it overwrites; stops with a clear message when a precondition fails. Document it as: `! bash scripts/<name>.sh`. Run `bash -n` and `shellcheck` on it. **Done when:** the script runs with no secrets in its output, checked by reading a dry run.
5. **Cold read.** Spawn the `runbook-cold-reader` agent with the runbook path (a fresh subagent, no other context). It returns every ambiguous step, missing command and hidden assumption. Fix each finding in the runbook, not in your head, then run the agent again on the fixed version until it reports none or only items you reject with a reason. **Done when:** the last cold read returned no unresolved findings.
6. **Prove one step.** Run any safe, read-only step yourself and paste its real output into the runbook as the expected result. Never run a production step to "test" the doc. **Done when:** at least one expected output came from a real run.
7. **Link it.** Add the runbook path to the alert rule, to the README's operations section and to `DEPLOYMENT.md`. Add a "last verified: YYYY-MM-DD" line and update it when you re-run the cold read. **Done when:** an alert or index entry points at the file.

## Quick reference

| Do | Do not |
|---|---|
| `ssh {{wb.vps_hosts}}` style alias in the command | "log into the server" |
| "Expected: HTTP 200 and `sha` equals the deployed commit" | "check that it works" |
| `! bash scripts/rotate-key.sh` | paste a key into the doc |
| One action per step | "restart the services and verify" |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "Everyone knows the host" | A cold reader does not. Write the alias and the path. |
| "Add a few maybes to be safe" | State what is true now. Hedging hides ignorance. |
| "Paste the .env so it is complete" | Name the variables and where they live. |
| "Cold read is overkill" | It is cheap and finds the missing step every time. |

## Verification

- [ ] Matches the project's existing format
- [ ] Every step has an exact command and an expected result
- [ ] No secrets in the document or in script output
- [ ] Cold read passed; date recorded
- [ ] Linked from the alert or the index

## References

| File | Load when |
|---|---|
| assets/runbook.md | no runbook format exists in the project |
| assets/owner-script.sh | writing an owner-machine script |
