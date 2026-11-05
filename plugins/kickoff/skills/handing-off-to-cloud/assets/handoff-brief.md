# Handoff: <title>

Date: <YYYY-MM-DD> · Branch: `<branch>` · Environment: `<cloud environment name>`

The owner may be offline. Work autonomously. When a decision is needed, make the reasonable call, record it under "Decisions" in the report, and keep going.

## Goal
<One paragraph: what done looks like and why it matters.>

## Read first
1. `CLAUDE.md` (rules, commands)
2. `docs/requirements/original-brief.md`
3. `docs/specs/<spec>.md`. Amendments there override the brief. See the "Environment findings" and "Owner-machine work" sections.
4. `docs/notes/` (verified SDK notes; use them instead of recall)
5. `<approved preview, data, fixtures>`

## Current state
- <what exists> (verified by `<command>` on <date>)

## Tasks (in order)
1. <task> — done when <observable condition>
2. ...

## Hard limits
- Do NOT merge to main. Work on `<branch>`; push small commits often.
- Do NOT deploy to production, run migrations against any remote database, change DNS, provision paid resources, or run deploy CLIs (vercel --prod, lk agent deploy, az ...). These are owner-machine steps.
- Never print or commit secrets. If a key is missing, use the mock switch and note it.
- Tests use mocks; no real LLM, voice, email or payment calls.

## Verify before finishing
```bash
<install> && <typecheck> && <lint> && <tests> && <e2e> && <build>
```

## Report (leave it as `docs/handoff/<date>-<slug>-report.md` and in the PR description)
- What was built, and the verification output summary.
- Decisions made without the owner, one line each.
- Owner-machine steps now needed, as exact commands, in order.
- Known gaps and anything not verified.
