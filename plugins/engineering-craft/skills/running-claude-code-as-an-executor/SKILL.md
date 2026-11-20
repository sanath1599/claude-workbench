---
name: running-claude-code-as-an-executor
description: Use when an app, bot or agent shells out to the `claude` CLI (`claude -p`) to do work, on a server or on the owner's Mac on his own login, or hands tasks to a local Claude Code over a queue. Not for calling the Claude API from code, which is stack-python:calling-llms-reliably, nor for cloud sessions, which is kickoff:handing-off-to-cloud.
---

# Running Claude Code as an executor

Each headless `claude -p` run does one task, and the caller decides what it may touch, not the user's own Claude setup. On the owner's machine, that setup has bypass permissions, plugins, hooks and connectors. Turn all of it off, confine every tool call with a hook, and prove the confinement with canaries before any real task runs.

## When to use

- A bot or service runs `claude -p` as a worker: diagnosis, PR review, an approved change, a deploy.
- Work goes from a remote agent to Claude Code on the owner's Mac, which uses his subscription login.
- A run must survive the Mac sleeping, a network drop or the caller giving up.

## When not to use

- Direct Messages API calls, retries and structured output: stack-python:calling-llms-reliably.
- Pydantic AI agents and their tools: stack-python:building-pydantic-ai-agents.
- Handing a whole project to a cloud session: kickoff:handing-off-to-cloud.

## Procedure

1. **Decide the kinds of task and who can cause each.**
   - Write a table of kind, who may trigger it, tools, folders and model.
   - A member's message must never be able to cause shell access on the owner's machine. Give members read-only kinds, and give write kinds only to the owner or to owner-approved tasks.
   - **Done when:** the table is in the design doc and the owner has agreed it.
2. **Isolate the run.** Pass:
   - `--setting-sources ""`: no user, project or local settings, so no plugins, hooks or permission bypass;
   - `--strict-mcp-config --mcp-config '{"mcpServers":{}}'`: no MCP servers and no claude.ai connectors;
   - `--permission-mode manual --permission-prompts none`;
   - `--allowedTools` for the kind, and `--disallowedTools mcp__* Task Agent`;
   - `--settings` with a PreToolUse hook (step 3);
   - `--add-dir` for each folder the run may use.

   Also:
   - Use a neutral, empty working directory. For a review, use the stripped checkout.
   - Strip `ANTHROPIC_*` and `CLAUDE_CODE_OAUTH*` from the environment, so the keychain login is used.
   - Do not use `--bare`: it never reads OAuth or the keychain.
   - **Done when:** the run's `system/init` event shows no MCP servers, `apiKeySource: none` and none of the user's plugins.
3. **Confine every tool call in a hook**, written in stdlib Python and failing closed.
   - Allowlist the tools for each kind, and check `file_path`, `path` and `notebook_path` with `realpath` against the allowed folders.
   - Keep read-only folders apart from writable ones: runbooks and knowledge are readable, and only the work folder is writable.
   - For shell kinds, deny commands that mention keys, secrets folders, credential files, the keychain, browser or app data, Claude's own folder, `sudo`, `osascript` or starting another `claude`. This denylist is best effort; for write kinds the real gate is the approval.
   - **Done when:** unit tests cover a symlink escape, a write to a read-only folder, an MCP tool and each denied command.
4. **Make the hand-off trustworthy.**
   - If the queue is reachable by other software (for example a Temporal server on a shared Docker network with no auth), HMAC-sign each task over its canonical JSON, give it an expiry, and keep a local "already ran" list.
   - Mark a task as run before starting it, so a crash never causes a second run.
   - Never retry a write task automatically.
   - **Done when:** tests show that a tampered, expired, wrongly kinded or replayed task never reaches the CLI.
5. **Handle interruptions honestly.**
   - Heartbeat while the CLI runs.
   - Kill the child process in `finally` when the wait is cancelled, so nothing carries on unreported.
   - If a tunnel carries the queue, rebuild only the tunnel when it drops, and let the worker reconnect.
   - Report three cases separately: "offline the whole wait", "went quiet mid-task (check before re-running)" and "failed".
   - **Done when:** a live test drops the connection mid-task, the task still finishes and reports, and a cancelled run leaves no orphan.
6. **Run canaries on the real machine** before any real task, through the same service manager it will run under.
   - Ask a run to read `~/.ssh`, print a private key, write outside its folder, use a connector and read the secrets folder; every one must be blocked.
   - Also ask it to SSH to a known host and write in its work folder; both must work.
   - Repeat for the read-only kind.
   - **Done when:** the transcript shows each step blocked or allowed as designed.
7. **Prove each kind live** end to end: owner, approved change, read and review. Prove both failure paths too: the machine stopped while a task waits, and the connection dropped mid-task. A kind that hasn't run live is not done.

## Quick reference

| Gotcha | Fix |
|---|---|
| `--output-format json` returns a list of events in 2.1.x | Take the last item whose `type` is `result` |
| `--bare` ignores OAuth and the keychain | Isolate with setting sources and an empty strict MCP config instead |
| Relative paths in the prompt resolve against the working directory | Run reviews inside the checkout; strip `CLAUDE.md`, `.mcp.json` and `.claude/` first |
| `launchctl bootout` returns before the job is gone | Wait until `launchctl print` fails, then bootstrap, retry, and check for `state = running` |
| launchd has a minimal PATH | Write the tool folders into the plist's `EnvironmentVariables` |
| A foreground `sleep` in Bash is refused | Expected; the CLI runs it in the background |

## Verification

- [ ] The kinds-and-triggers table is agreed; members can cause read-only kinds only.
- [ ] Isolation flags are in place, `--bare` is absent, and the init event is clean.
- [ ] Hook tests pass, and the canaries ran on the real machine under its service manager.
- [ ] Tasks are signed, expire and run once; write tasks are never retried.
- [ ] Kill-on-cancel and a dropped-connection run were tested live.
- [ ] Every kind was proven live, and the report says which.

## Versions

- Claude Code 2.1.326: `--setting-sources`, `--strict-mcp-config`, `--permission-prompts none`, and JSON output as an event list (verified 2026-11-20, `claude --help` and a live run).
