---
type: llm
weight: 3
---

Pass if the design runs the CLI without the owner's own settings, plugins, hooks and connectors (for example `--setting-sources ""` and an empty strict MCP config, and not `--bare`, which drops the OAuth login), confines tool calls with a hook or allowlist that enforces folders, and limits what a team member's request can cause on the Mac to read-only work. Fail if member messages can trigger shell or SSH on the Mac, or if the run inherits the owner's configuration.
