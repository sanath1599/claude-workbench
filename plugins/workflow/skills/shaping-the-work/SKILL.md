---
name: shaping-the-work
description: Use when a request for something new or changed arrives and it is unclear how big it is, whether to ask questions, or whether a design is needed first. Triggers on "build", "add", "plan", "let's make", "help me set up". Not for a bug (debugging-systematically) or for UI mockup approval (design-studio:previewing-ui-before-building).
---

# Shaping the work

Decide the size of a request first, ask at most one batch of questions only if the answers change what gets built, then write the smallest design that lets someone build it.

## When to use

- A new feature, product, integration or change of behaviour is requested.
- The request is vague, large, or mixes several independent things.
- The owner pastes a long brief and says "build this".

## When not to use

- A bug or failing test: debugging-systematically.
- New UI with nothing approved yet: design-studio:previewing-ui-before-building (it owns the mockup gate).
- Starting a whole new repository: kickoff:starting-a-project (it owns the kickoff interview and cloud-handoff question).
- A written spec already exists and is approved: go straight to writing-implementation-plans.

## Procedure

1. **Size it.** Say the size in one line; the owner can override it.

   | Size | Signs | Output |
   |---|---|---|
   | Small | One file or one behaviour, the request names the outcome | No design. Do it, report what changed. |
   | Medium | Several files, one subsystem, a few real choices | A short design in chat (10 to 20 lines), then writing-implementation-plans if there are more than about five steps. |
   | Project | New product, several subsystems, new infrastructure | A written spec in the repo (see references/design-template.md), then a plan. If it is really several projects, say so and shape them one at a time. |

   **Done when:** the size is stated in a sentence.

2. **Read before asking.** Check the repo, CLAUDE.md, the docs folder, the decision files and the session notes. Anything found there is settled; never ask it again. If the project keeps a log of past owner decisions, read it before composing questions.

   **Done when:** you can list what is already known and what is genuinely open.

3. **Decide what is worth asking.** A question earns a place only if both are true: the answer changes what gets built, and being wrong is expensive to reverse. Everything else you decide yourself and record as "my call" in the design. Never ask for secrets (use .env, the environment UI or a `! command`), never ask the owner to explain a concept they do not track (explain it in plain words and offer "skip / decide for me"), and never ask for permission to take an in-scope, non-destructive step.

   **Done when:** each candidate question has been kept or turned into a stated default.

4. **Ask once.** One batch, at most 4 questions, each with a short header. Every option states its cost, scale and reversibility. Mark one option "(Recommended)" and make it the light, reversible path: the smallest first scope, existing infrastructure, a temporary measure that gets reverted. Offer multi-select for feature sets instead of a fifth option. After the answers, or after "go", "decide", "go crazy" or "think and decide", stop asking for the rest of the task.

   **Done when:** the batch is sent, or you have written "no questions needed" with the defaults you chose.

5. **Write the design.** Medium: in chat. Project: a file the owner can review, with sections for intent, goals and non-goals, constraints, decisions made (marked as the owner's or as your call), open items with defaults, and risks (each mentioned once, one line). Keep the verbatim brief as its own file and let later amendments override it explicitly. Give the owner a short list of the calls you made so they can check only those.

   **Done when:** the design exists and states which parts were decided by whom.

6. **Gate on approval only where it is expensive.** For a project spec or an outward-facing action, wait for "go". For small and medium work inside the repo, announce the plan in two lines and start; an unanswered "shall I proceed?" is a wasted turn.

   **Done when:** you either hold a go, or you started because nothing irreversible was next.

7. **Hand over.** Next step is writing-implementation-plans for medium or project work. When the design leaves a throwaway experiment as the cheapest way to learn, offer a spike, label it throwaway, and do not keep its code without re-shaping.

## Quick reference

| Situation | Do |
|---|---|
| Owner says "go crazy" or "decide" | Stop asking. Decide, record the call, build. |
| Two questions turn out unanswerable by the owner | Propose an answer and let them react. |
| A risk worries you | State it once in one line, then follow the decision. |
| Scope grows mid-task | Stop, say the new size, re-shape. |
| Stretch ideas appear | Park them in NEXT_STEPS.md, not in this build. |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "One more clarifying question won't hurt" | It costs a turn. Default it unless the answer changes what is built. |
| "I'll ask everything now so nothing is missed" | Ask the expensive-to-reverse ones only, max 4. |
| "The owner might change their mind" | Record the decision and move on; changes are cheap in small increments. |
| "A design doc for a one-file change is thorough" | Size it small and do it. |

## Verification

- [ ] The size was stated.
- [ ] No question repeats something found in the repo, the notes or an earlier answer.
- [ ] At most one batch, at most 4 questions, each option with cost and reversibility.
- [ ] The recommended option is the light, reversible one.
- [ ] Every default or guess is labelled as a call, not as the owner's decision.

## References

| File | Load when |
|---|---|
| references/design-template.md | writing a project spec or a medium design |
