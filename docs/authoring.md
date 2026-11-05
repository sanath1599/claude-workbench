# Authoring guide

Every skill, agent, hook and connector in this marketplace follows these rules. Read this before adding or changing anything. The `workbench:update-skill` skill follows it too.

## What earns a skill

A skill exists when it changes what Claude does by default. That means a preference of the owner's, a decision procedure Claude would otherwise skip, or a gotcha that has bitten a real project. Generic knowledge Claude already has does not earn a skill. If a rule can be checked mechanically (a regex, a validator, a script), put it in a hook or script, and keep the skill for the judgment calls.

Ideas come from studying other marketplaces. Text never does. Write everything in your own words. Never copy text from share-alike or no-derivatives sources (for example trailofbits/skills or hesreallyhim/awesome-claude-code).

## Layout

```
plugins/<plugin>/
  .claude-plugin/plugin.json      name, version (semver), description, author, license
  skills/<skill-name>/SKILL.md     one directory per skill
  skills/<skill-name>/references/  heavy reference, loaded only when the SKILL.md table says so
  skills/<skill-name>/scripts/     deterministic helpers (Node 18+ .mjs or Python 3 stdlib), no deps
  skills/<skill-name>/assets/      templates to copy
  agents/<agent-name>.md           subagents
  hooks/hooks.json                 only for rules that must be enforced
  .mcp.json                        connectors (remote HTTP + OAuth, or ${ENV} values; never literal secrets)
  evals/<case>/prompt.md + graders/*.md
```

References sit one level deep: a reference never sends the reader on to another reference.

## SKILL.md

Frontmatter:

```yaml
---
name: verb-ing-the-thing          # lowercase, hyphens; gerund or verb-first
description: Use when <situation, symptoms, words the owner says>. Not for <near-miss>, which is <other-skill>.
---
```

- The description says **when** to use the skill, never **what it does step by step**. Agents follow a summarised workflow instead of reading the body. Keep it under 500 characters, in third person, with a not-for clause naming the sibling skill.
- Add `disable-model-invocation: true` for workflows that should only run when the owner types the command (setup, handoff, launches).
- Optional: `argument-hint`, `allowed-tools`, `model`, `effort`.

Body, in this order. Leave out a section only when it has nothing to say.

1. `# Title`, then one or two sentences: the core principle.
2. `## When to use`: symptoms and situations. `## When not to use`: near-misses, each pointing at the right skill.
3. `## Procedure`: numbered phases. Each phase ends with **Done when:** and an observable condition (a command run and its output, a file written, an answer from the owner).
4. `## Quick reference`: a table or a short list for scanning.
5. `## Rationalizations`: for discipline skills only. A table of the excuse and what to do instead.
6. `## Verification`: a checklist run before saying the work is done.
7. `## References`: a "load when" table, for example `| references/patterns.md | choosing a Temporal pattern |`.

Length: aim for 400 to 1,500 words in SKILL.md and stay under 500 lines. Move catalogues, API detail and long examples into `references/`.

## Facts that age

- Put version-specific facts (package versions, API names, limits, endpoints) in a `## Versions` block at the end of the SKILL.md, or in `references/versions.md`. Write each one as `name x.y.z (verified YYYY-MM-DD, <source URL>)`. Add every package to `maintenance/tracked-packages.json` so the daily job can keep it current.
- Name Claude models by alias (`sonnet`, `haiku`, `opus`). Add an exact id only in a Versions block.
- Prefer "read the current docs at <URL> before using X" to pasting API surfaces that go stale.

## Profile tokens

Owner-specific values are written as tokens, so `/workbench:setup` can render a personalised copy and the SessionStart hook can resolve them at runtime: `{{wb.domain}}`, `{{wb.owner_email}}`, `{{wb.git_author_email}}`, `{{wb.github_owner}}`, `{{wb.github_orgs}}`, `{{wb.hosting}}`, `{{wb.dns_provider}}`, `{{wb.email_provider}}`, `{{wb.email_from}}`, `{{wb.vercel_scope}}`, `{{wb.vps_hosts}}`, `{{wb.timezone}}`, `{{wb.package_manager}}`, `{{wb.subagent_default_model}}`, `{{wb.llm_default}}`. Never hardcode the owner's email, domain or account names. Use the token.

## Style

- Plain words and short sentences. Name things concretely: the file, the command, the flag.
- Write instructions as standing rules ("Run X before Y"), not as a story about one session.
- One excellent example beats several mediocre ones. Examples are TypeScript for frontend skills and Python for agent and backend skills.
- No emojis. No marketing adjectives. No invented metrics.
- Call bundled scripts through their interpreter (`node scripts/x.mjs`, `python3 scripts/x.py`), never by a bare path.
- Cross-reference other skills by name (`stack-python:orchestrating-with-temporal`), never with `@` file links.

## Agents

```yaml
---
name: qa-auditor
description: Use when <situation>. <What it returns>.
model: sonnet          # default; haiku for mechanical work; opus only when the task warrants it
tools: Read, Grep, Glob, Bash
---
```

The body is a procedure with a fixed output format, not a persona. No "You are a world-class...".

## Evals

Each plugin ships `evals/` cases for the skills that change default behaviour. A case is `evals/<case>/prompt.md` (frontmatter: `runs`, `max_turns`, `allowed_tools`, optional `tags`) plus `graders/*.md` (`type: llm | regex | tool_used`, `weight`, `arm`). Include at least one near-miss case per plugin: a prompt that must **not** trigger the skill. Run with:

```bash
claude plugin eval plugins/<plugin> --runs 2 --model sonnet --no-publish
```

## Before you commit

```bash
npm test                                  # hook and script unit tests
claude plugin validate . --strict         # marketplace
for p in plugins/*; do claude plugin validate "$p" --strict; done
node scripts/bump-version.mjs <plugin> patch|minor|major
```
