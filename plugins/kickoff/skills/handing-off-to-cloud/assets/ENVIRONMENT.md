# Cloud environment for <project>

Create once at https://claude.ai/code, using the environment selector under the message box. The CLI cannot create environments. Then run `/remote-env` in a Claude Code session to make it the default.

| Setting | Value |
|---|---|
| Name | `<project>` |
| Network access | Trusted, plus these custom hosts: <hosts> |
| Setup script | see below (cached; keep it under ~5 minutes) |

## Environment variables (names only)
Values come from `.env.cloud`. Generate it with `node <kickoff>/skills/handing-off-to-cloud/scripts/make-cloud-env.mjs --from-example`, then copy it with `pbcopy < .env.cloud` and paste it into the dialog. Anyone who can use the environment can read these values. Prefer network secrets for API keys where the plan offers them.

<variable names>

Not for the cloud: production database URLs, deploy tokens, and anything listed under "Owner-machine work" in the spec.

## Setup script
```bash
#!/bin/bash
# System tools only; project dependencies install in .claude/hooks/cloud-setup.sh at SessionStart.
<extra apt or uv tool installs, if any>
```
