---
name: executing-plans
description: Use when an approved implementation plan or a multi-task build is about to be carried out, or the owner says "build it", "go", "execute the plan", "sub agent driven". Covers inline versus subagent-driven, batched reviews and the post-build critique. Not for writing the plan (writing-implementation-plans) or merging (finishing-a-branch).
---

# Executing plans

Run the plan in small visible increments, keep a progress ledger that survives compaction, review in batches rather than per task, and finish with one independent critique.

## When to use

- A plan file exists and the owner wants it built.
- A request is large enough that tasks will be dispatched to subagents.

## When not to use

- Model choice and brief writing for a single delegation: workbench:delegating-to-subagents (this skill uses it for every dispatch).
- Handing the build to a cloud session: kickoff:handing-off-to-cloud.
- One small change: do it inline with no ceremony.

## Procedure

1. **Check the workspace.** Confirm you are on a feature branch, not main (working-in-parallel-sessions covers worktrees and peer sessions). Run the baseline checks once and note any failures that existed before you started.

   **Done when:** branch name and baseline test result are recorded.

2. **Open the ledger.** Create `.work/<plan-name>.md` (add `.work/` to .gitignore if it is not there) from assets/ledger-template.md, first line naming the plan file. After each finished task append one line: task number, commit hash, verification result. If the ledger already exists, trust it: tasks marked complete are done, resume at the first one without a line. Conversation memory does not survive compaction; the ledger does.

   **Done when:** the ledger exists and lists every task as pending or complete.

3. **Choose the mode.**

   | Situation | Mode |
   |---|---|
   | Several independent tasks, owner did not object | Subagent-driven (the owner's usual choice) |
   | Tightly coupled tasks sharing files and state | Inline |
   | No subagent tool available | Inline |
   | The owner said inline or subagent | That |

   State the mode in one line.

4. **Run the task loop.** For each task, or each independent group of tasks:
   - Subagent-driven: dispatch an implementer with a full brief (the task text, global constraints, owned files, the verification command, "commit when green, do not push"), default model sonnet, haiku for mechanical tasks. Independent tasks go out in one message. Never let two agents own one file. Do not report progress from an agent until it has finished, then spot-check its diff and rerun its command.
   - Inline: do the task, run its verification command, commit.
   - Follow test-first-changes where the plan marks a test first, and verifying-before-done for every claim.
   - Narrate at most one line between tool calls; the ledger carries the record. Keep the owner able to see progress: a commit and a ledger line per task.

   **Done when:** the task's verification command passed in this run and the ledger line exists.

5. **Review in batches.** After every three to five tasks, or at a natural seam such as a finished subsystem, dispatch one reviewer over the whole batch diff (reviewing-code-before-merge describes the pipeline; for a quick batch use the code-reviewer agent). Do not review every task separately; the owner asked for batching. Fix findings in one pass, rerun the checks, record the outcome in the ledger.

   **Done when:** each batch has a ledger line saying reviewed and fixed, or reviewed and clean.

6. **Rule, do not stall.** Conflicts between plan and reality, ambiguities, a defect in the plan: decide, write `Ruling: <what> / <why> / <cost if wrong>` in the ledger, and continue. Stop and ask only for: an irreversible or destructive action, a security-sensitive action, a side effect outside the repo that needs the owner (merge to main, production deploy, migration on a shared database, paid resource, real email), or a plan so broken that every path forward is a guess. Mention a risk once.

   **Done when:** the ledger holds every ruling and no question is pending that the four stop reasons do not cover.

7. **Critique pass.** After the last task, dispatch the plan-critic agent in build mode (or a fresh sonnet agent with the same brief): spec in one hand, the final diff and a run of the application in the other. It reports requirements not met, shortcuts, dead code and broken flows. Fix the real ones, rerun the full checks, and note the rest in NEXT_STEPS.md. One round; do not loop.

   **Done when:** critic findings are fixed or parked, and the full check suite passes in this run.

8. **Finish.** Go to finishing-a-branch. Report: what was built, evidence (test counts, URLs, commands), rulings made, anything parked, and anything only the owner can do, as `! <command>` lines.

## Quick reference

| Question | Answer |
|---|---|
| Review after every task? | No. Batch of three to five tasks. |
| Agent says "done"? | Open the diff, rerun its command, then believe it. |
| Plan step is wrong? | Rule, log it, continue. |
| Tests need real LLM, voice or email? | They must not; use mocks unless an env-guarded opt-in check. |
| Context getting long? | Ledger is the recovery map; keep going from it. |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "I'll check in with the owner after each task" | Continuous execution; they asked for the result. |
| "A per-task reviewer is safer" | Batched review plus the final critique costs far less for the same catch rate. |
| "The agent's summary is enough" | Summaries drift from diffs. Spot-check. |
| "I'll skip the ledger, todos are enough" | Todos vanish with context. Write the ledger. |

## Verification

- [ ] Ledger has one line per task with a commit hash and a verification result.
- [ ] Reviews ran per batch, not per task, and the critique ran once at the end.
- [ ] Every ruling is logged with its cost if wrong.
- [ ] Nothing was pushed, merged, deployed or migrated without the owner's go.
- [ ] The final report quotes real command output.

## References

| File | Load when |
|---|---|
| assets/ledger-template.md | opening the progress ledger |
