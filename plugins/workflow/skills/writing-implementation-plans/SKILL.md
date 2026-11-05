---
name: writing-implementation-plans
description: Use when an approved design or clear requirements exist for work of more than about five steps and code is about to be written, or the owner asks for "a plan", "task list" or "break this down". Not for deciding what to build (shaping-the-work) or for running the plan (executing-plans).
---

# Writing implementation plans

A plan is a set of small tasks, each with an exact deliverable and a command that proves it, written so that an agent who has not seen this conversation can do it.

## When to use

- A design or spec is approved and the build has several tasks.
- Work will be handed to subagents or to a cloud session, which know only what the repo and the brief say.
- The owner asks for a plan, a task list or a breakdown.

## When not to use

- A small change: just do it.
- The design is still open: shaping-the-work.
- Executing an existing plan: executing-plans.

## Procedure

1. **Read the inputs.** The spec, CLAUDE.md, the existing code that will be touched, and the decision notes. Copy the spec's project-wide constraints (versions, naming and copy rules, banned libraries, stack defaults) into a Global Constraints block that every task inherits.

   **Done when:** the constraints block exists and each line traces to the spec or to CLAUDE.md.

2. **Map the files.** List the files to create or change and the one responsibility of each. Follow the repo's existing patterns; split a file only if it is already unwieldy. Files that change together stay together.

   **Done when:** every task below can name the files it touches.

3. **Cut tasks by deliverable.** A task is the smallest unit that carries its own test and is worth a reviewer's attention. Fold setup, config and docs into the task that needs them. Split only where one task could be rejected while its neighbour is accepted. Each task ends with something runnable: a passing test, a page that loads, a command with output.

   Order tasks as small, visible increments. The first task should produce something the owner can look at or run. Independent tasks are marked so they can run in parallel, and each says which files it owns so parallel agents never touch the same file.

   **Done when:** each task has a one-sentence deliverable and a verification command.

4. **Write each task.** Use assets/plan-template.md. For each task: goal, files, the interface or signature when other tasks depend on it, the test to write first (when the task is test-first; see test-first-changes), the steps as single actions with a checkable result, the verification command with the expected output, and the commit message. Give real code only for interfaces and tricky logic; trust the implementer for the rest. Never write "add error handling" or "handle edge cases" without naming the cases.

   **Done when:** a reader can start any task without asking a question.

5. **Mark what the plan will not do.** Park stretch goals in NEXT_STEPS.md. List anything that needs the owner's machine or approval (production deploys, migrations on shared databases, paid resources, secrets) as its own final section, as scripts the owner can run, so no task silently depends on them.

   **Done when:** owner-only steps are in one clearly labelled section.

6. **Critique before executing.** For a plan of eight or more tasks, or any plan that spends money or touches shared state, dispatch the plan-critic agent (sonnet) with the spec and the plan. Fix what it finds: missing requirements, tasks that cannot be verified, hidden dependencies, two tasks owning one file. For small plans, re-read the plan once against the spec yourself.

   **Done when:** the critic returned no blocking finding, or each finding is fixed or answered in the plan.

7. **Save and hand off.** Save under `docs/plans/YYYY-MM-DD-<topic>.md` unless the repo already has a convention (use the existing one, for example `docs/superpowers/plans/`). Commit it on the working branch. Choose execution mode with the owner's default: subagent-driven with batched reviews, unless the tasks are tightly coupled or no subagent tool exists (executing-plans decides).

   **Done when:** the plan is committed and the next action is "execute".

## Quick reference

| Plan smell | Fix |
|---|---|
| Task says "implement the feature" | Split by deliverable, name the test |
| Task has no verification command | Add one or merge it into a neighbour |
| Two tasks edit the same file | Merge, or sequence them explicitly |
| Placeholders like "TBD" or "similar to task 3" | Write the content or remove the task |
| Plan needs a secret or prod access | Move to the owner-only section |
| Every task has a review step | Batch reviews; see executing-plans |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "The implementer will figure it out" | They have no context; name files, interfaces and the check. |
| "A long plan is safer" | Short tasks with proof beat long prose. Cut anything an implementer would do anyway. |
| "I'll fill in the verification later" | A task without proof cannot be accepted. |

## Verification

- [ ] The plan starts with the goal, the spec path and the Global Constraints.
- [ ] Every task names its files, deliverable and verification command.
- [ ] No two parallel tasks share a file.
- [ ] Owner-only steps are separated and contain no secrets.
- [ ] The plan is committed on a branch that is not main.

## References

| File | Load when |
|---|---|
| assets/plan-template.md | drafting the plan file |
