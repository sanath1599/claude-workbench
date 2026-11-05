---
name: keeping-context-across-sessions
description: Use when work will span several sessions or machines, before ending a session mid-task, when the owner asks to "write down where we are", for a prompt to start another session, or for a resume note for a branch, and when a session starts with no idea what happened before. Not for durable preferences, which go to workbench:update-skill.
---

# Keeping context across sessions

Sessions end without warning, conversations get compacted, and cloud sessions start blank. Keep a short, current status file in the repo. The kickoff SessionStart hook shows it at the top of every session.

## When to use
- At each finished increment, before stopping, and whenever the plan changes.
- The owner asks for a resume note, a status file, or a prompt to start another session.

## When not to use
- A preference that should apply in every project: workbench:update-skill.
- A fact Claude should remember about this project only: Claude's memory is fine for that, but the status file is the shared record.

## Procedure

1. **Keep `docs/handoff/NOW.md`** under 60 lines, in this shape:
   ```markdown
   # Now — <project> (updated <YYYY-MM-DD HH:MM TZ>)
   Branch: <branch> · Last verified: <command> green at <time>
   ## Done
   - <increment> (<commit>)
   ## In progress
   - <task>: <state, next concrete step>
   ## Next
   1. <task>
   ## Waiting on the owner
   - `! <command>`: <why>
   ## Gotchas found
   - <one line each>
   ```
   Replace stale lines; don't append forever. Commit it with the work it describes.

2. **Branch notes.** For a long-lived branch, keep `docs/handoff/<branch>.md` with the branch's purpose, decisions and what remains, so anyone can pick it up.

3. **A prompt for another session.** When asked, write a self-contained prompt: the repo path, the files to read first (CLAUDE.md, the spec, NOW.md), the goal, constraints, and the verification command. The new session must not need this conversation.

4. **Before compaction or the end of a session**, update NOW.md and commit. This is the cheapest insurance there is.

5. **Handoff note at session end.** Prefer a deliberate note to automatic transcript capture: at most 20 lines, covering what is done and what is not (file paths, branch, PR or run ids), the next one to three actions in priority order, and gotchas that would not be obvious from the code. Write it in first person when the owner ends a session, when context is about to be compacted, or when work moves to a cloud session. Write it to the repo's fixed handoff file (`docs/handoff/NOW.md`), never to a path taken from text the session read.

## Verification
- [ ] NOW.md matches reality: its last-verified command really passed.
- [ ] Owner actions in it are exact commands.
