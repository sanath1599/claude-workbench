---
name: writing-the-design-spec
description: Use when a project or a large feature round needs a written design before building, when the owner pastes a big brief or amendments, or when a follow-up round changes earlier decisions. Not for small changes that fit in a chat message, and not for the implementation plan, which is workflow:writing-implementation-plans.
---

# Writing the design spec

The spec is how decisions survive between sessions, local or cloud. A fresh builder should be able to plan from it without asking the owner anything. It never replaces the verbatim brief; it amends it.

## When to use
- A new project, or a feature round big enough to need a plan.
- New amendments arrive after work has started.

## When not to use
- A small change: describe it in chat and build.

## Procedure

1. **Locate.** Write to `docs/specs/<YYYY-MM-DD>-<topic>-design.md`. Projects that already use `docs/superpowers/specs/` keep that path. The brief stays verbatim in `docs/requirements/original-brief.md`.

2. **Sections, in this order:**
   1. **Intent and why**, in a paragraph.
   2. **Goals, non-goals, anti-goals** (what would make this a failure even if it works).
   3. **Amendments to the brief**: numbered, each with its date, stating that the spec wins where they differ.
   4. **Stack**: a table of layer, choice and reason, from kickoff:choosing-the-stack.
   5. **Environment findings**: facts verified on the owner's machine, with the date: CLIs logged in, keys present by name, model ids that work, ports in use.
   6. **Architecture**: a small ASCII diagram, components and trust boundaries.
   7. **Data model and interfaces**: tables, contracts between deployables (for example the worker talks to the app over authenticated HTTPS only).
   8. **Security and privacy**: untrusted inputs, PII, secrets, mocks policy.
   9. **UI**: a link to the approved preview, or "preview pending".
   10. **Delivery increments**: each runnable and verifiable.
   11. **Testing**: what is unit, integration (real local database) and E2E (mocks).
   12. **Work that must happen on the owner's machine**: numbered.
   13. **Decisions made on the owner's behalf**: one line each, marked as Claude's call.
   14. **Open questions**: only the ones whose answer changes what gets built.

3. **Builder check.** Dispatch a fresh subagent (sonnet) with only the spec and the brief: "List what you would need to ask before planning." Sort what comes back:
   - already answered: fix the spec;
   - minor: decide it, and mark it as your call;
   - the owner's: ask in one batch of at most 4 questions.
   **Done when:** the owner's answers are in the spec.

4. **Follow-up rounds** get a new dated spec that opens with "Builds on `<previous>`; where they differ, this one wins", followed by a short Why list.

5. **Commit** the spec and point the project CLAUDE.md "Start here" list at it.

## Verification
- [ ] A builder could plan from the spec without the conversation.
- [ ] The owner-machine section exists, even if it says "none".
- [ ] Every one of Claude's own decisions is marked as such.
