---
name: ask-the-owner
description: Use when someone asks what {{wb.owner_name}} would want, decide, prefer or say ("ask the owner", "what would the owner do", "how does the owner like X done", "would the owner approve"), or when Claude must make a call on the owner's behalf while they are offline. Not for changing a preference (workbench:update-skill) or for facts about one project, which come from that project's files.
argument-hint: "<question>"
---

# Ask the owner

Answer as the owner most likely would, from the evidence the workbench holds: house rules, the preference catalogue, the persona notes, the skills and the project's own docs. Say how sure you are and where the answer comes from. Never invent facts about the person, commit them to anything, or speak for them where only they can answer.

## When to use
- A teammate or collaborator asks how the owner wants something done, or which option they'd pick.
- Claude needs a decision while the owner is unavailable (for example in a cloud session).

## When not to use
- The owner states a new preference: workbench:update-skill.
- The question is about availability, money, hiring, people, or a promise to a client. Those are the owner's alone. Say so and suggest asking them directly.

## Procedure

1. **Classify the question:** a preference (how they like things), a decision (which option), a style question (how to write or present something), a technical choice, or a question for the owner only (see "When not to use").
2. **Gather evidence**, nearest first:
   1. the current project's CLAUDE.md, design spec and `.claude/workbench.json`;
   2. `plugins/workbench/rules.md` and the session's profile values;
   3. `docs/preferences.md` (the catalogue, with each entry's strength);
   4. the relevant skill: run `node scripts/find-skill.mjs "<keywords>"` from the workbench repo;
   5. `references/persona.md` for how they decide and communicate.
   **Done when:** you have at least one cited source, or know there is none.
3. **Answer in this shape:**
   ```
   the owner's likely answer: <one or two direct sentences, in his decisive style>
   Why: <the rule or pattern, with its source, e.g. docs/preferences.md · Design>
   Confidence: stated rule | strong pattern | inference
   Check with the owner: <only when confidence is inference, the answer commits money or production, or sources conflict>
   ```
   With no evidence at all, say "Not something I have on record", give the closest principle, and recommend asking him.
4. **When acting on his behalf** (offline decisions), choose the light, reversible option, record it as "decided on the owner's behalf" in the handoff report or spec, and keep going.

## Rules that always hold
- Don't reveal secrets, personal contact details beyond what the profile publishes for work, or client-confidential details.
- Don't put words in his mouth on people, clients, money or commitments.
- When the evidence conflicts, the newest dated entry wins, and the project's own docs beat the general catalogue.
- Don't argue with a stated rule because a different approach looks better. Report the rule; you may add one line of trade-off.

## Verification
- [ ] Every answer cites a source, or says there is none.
- [ ] The confidence label is honest.
- [ ] Owner-only questions were routed to the owner.

## References
| File | Load when |
|---|---|
| `references/persona.md` | judging how he would decide or phrase something |
| `../../../../docs/preferences.md` (in the workbench repo) | any preference question |
