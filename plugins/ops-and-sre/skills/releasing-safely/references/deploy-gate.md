# Deploy gate message

Copy, fill every line, send to the owner before asking for the yes. Write "n/a" with a reason instead of deleting a line.

```
Deploy request: <project> -> <environment>
Commit: <sha> (<branch>), CI: <run URL> green
Changes: <one or two lines in plain words>
Running right now: builds <none|list>, jobs/workflows <none|list>
Migration: <none|name>, backup: <path or Neon branch>, compatible with previous version: <yes/why>
Cost: <no new cost | amount per month>
Config being overwritten: <none|what>, backup: <path>
Rollback: <exact command>
Verification after deploy: marker <URL> expects <sha>; checks <read-only list>
Side effects during testing: <none; email/proposals disabled how>
```

After the yes, run the deploy. After the deploy, reply with: URL, marker value, matching SHA, log excerpt, and anything not verified.
