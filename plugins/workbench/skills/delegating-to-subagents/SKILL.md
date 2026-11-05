---
name: delegating-to-subagents
description: Use when deciding whether to spawn subagents, which model to give them, how to brief them, or how to run parallel or subagent-driven implementation with reviews. Not for handing a whole project to a Claude Code cloud session, which is kickoff:handing-off-to-cloud.
---

# Delegating to subagents

Delegate when the work is independent and parallel, or needs a lot of reading whose conclusion is all you need. Otherwise do it inline. Each subagent knows only its brief, so the brief is the whole job.

## When to use
- Two or more independent tasks, broad research, a fresh-eyes review, or a critique of what you just built.

## When not to use
- A handful of tool calls, or a lookup whose target you already know.
- Moving work to the cloud: kickoff:handing-off-to-cloud. The Agent tool's `isolation: "remote"` once ran on the laptop instead of the cloud, so don't use it for handoffs.

## Procedure

1. **Pick the model per task, and say why when it's opus:**

   | Task | Model |
   |---|---|
   | Mechanical, fully specified (rename, transcribe, format) | haiku |
   | Default: implementation, research, reviews, writing | sonnet (`{{wb.subagent_default_model}}`) |
   | Hard architecture, a final whole-branch review, or stuck after two sonnet attempts | opus |
   | The owner named a model | that model |

   A `fork` always inherits the parent's model; use a fresh agent when you need a different one.

2. **Write the brief.** In this order:
   - goal and why;
   - what is already known or ruled out;
   - the files and docs to read;
   - the files it may change, since parallel agents must not share files;
   - constraints (no commits, no deploys, no evals that cost money unless asked);
   - the verification command that must pass;
   - the output format and size cap.

   For parallel UI work, build and freeze the foundation first (types, store, primitives, layout, utils, permissions). Write a `CONTRIBUTING.md` listing what to read, the visual rules by token name, the verification steps and what to report. Each agent owns one feature folder and may not edit shared files; it reports the shared change it wished for and the lead makes it once. Require typecheck plus screenshots at desktop and phone width, with console errors and horizontal overflow reported. Convention docs are copied literally by every agent, so check them for wrong libraries first (a `sonner` mention spreads to every file).

3. **Run.** Dispatch tasks in parallel only if they pass three checks: no shared files, no shared mutable state (database rows, ports, a lockfile), and neither needs the other's output. If any check fails, run them in order or merge them. Send independent agents in one message so they run in parallel. Give background agents a scratchpad path to write their full reports to. When they return, read each summary, look for two agents that edited the same area, run the full suite once on the combined result, and fix conflicts yourself before reporting.

4. **Review in batches.** For subagent-driven builds, run the reviews per batch of tasks, not after every single task (the owner asked for this). After a substantial build, dispatch one critique agent to review the result, then fix what it found.

5. **Trust, then verify.** Never report results before an agent finishes. When it finishes, spot-check its claims: open two or three of the files it wrote and rerun its verification command. Relay what matters to the owner; the owner does not see subagent reports.

## Verification
- [ ] Each brief named the files the agent may touch, and a verification command.
- [ ] Opus was used only with a stated reason.
- [ ] Agents' claims were spot-checked before you repeated them.
