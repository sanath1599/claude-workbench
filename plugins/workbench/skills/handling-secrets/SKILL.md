---
name: handling-secrets
description: Use when a task needs API keys, tokens, passwords or connection strings, when creating or editing .env files, moving credentials into Vercel, LiveKit, GitHub Actions or a cloud environment, when the owner pastes a key into chat, or when a secret may have leaked. Not for app authentication design, which is stack-web:adding-auth.
---

# Handling secrets

Secrets never pass through Claude's output. They live in git-ignored env files on the owner's machine and in each platform's secret store, and they move by pipes and scripts that print nothing. Hooks block printing `.env`, committing or pushing secrets, and writing literal keys into tracked files.

## When to use
- Setting up env vars for a project, a deploy target or a cloud session.
- The owner pasted a key, or a scan found one.

## When not to use
- Designing login, sessions or permissions: stack-web:adding-auth.

## Procedure

1. **Lay out the files:**

   | File | Holds | Git |
   |---|---|---|
   | `.env` | the owner's real values; never overwrite it | ignored |
   | `.env.local` | generated or derived values for local runs | ignored |
   | `.env.example` | every variable name with a placeholder and a one-line comment | committed |

   When a key is needed, add it to `.env.example` and tell the owner the variable name: "create placeholders and I will fill them in". Never ask for the value in chat.

2. **Read without printing.** List names with `cut -d= -f1 .env`. Check one key with `grep -c '^RESEND_API_KEY=' .env`. Code reads `process.env` or pydantic-settings, never literals.

3. **Name production values distinctly** (for example `NEON_DATABASE_URL`, not `DATABASE_URL`) so tests and local scripts can't reach production by accident.

4. **Move secrets by pipe, not by echo:**
   - Vercel: `vercel env add NAME production --sensitive < <(grep '^NAME=' .env | cut -d= -f2-)`. Add `</dev/null` and a timeout for other CLI calls.
   - GitHub Actions: `gh secret set NAME < <(grep '^NAME=' .env | cut -d= -f2-)`.
   - LiveKit Cloud agent: `lk agent update-secrets --secrets-file <generated file>`, then delete the file.
   - A cloud session's environment: the owner pastes it. Give `! pbcopy < .env.cloud` (a generated, git-ignored file with only the variables the cloud needs). Prefer the environment's network secrets for API keys where available.
   When the classifier won't let you run a step, write `scripts/<step>.sh` that reads `.env` and pipes the values. It must never echo them. Hand it over as `! bash scripts/<step>.sh`.

5. **When a key is pasted or leaked:** don't repeat it. Move it into `.env`. Say in one line that it should be rotated because it is now in chat history or git history. If it was pushed, rotate first, then (with the owner's yes) rewrite history. Rewriting alone is not enough.

6. **Formatting gotchas:**
   - The Next.js env loader cuts values at `#` unless they are double-quoted.
   - systemd strips unquoted backslashes, so single-quote such values.
   - Multi-line PEM keys need quoting or a `\n` escape, depending on the consumer.

For long-term storage, sync and rotation (encrypted files in git, or a self-hosted vault) use ops-and-sre:keeping-secrets-in-a-vault; it is the preferred store once a project outgrows loose `.env` files.

## Rationalizations

| Excuse | Instead |
|---|---|
| "I'll just echo it to check it's set." | `grep -c` the name instead. |
| "It's only a test key." | Treat it as real; tests use mocks anyway. |
| "Put it in .mcp.json or CLAUDE.md for convenience." | Use `${ENV_VAR}` references only. |
| "It is only a seed password, put it in AGENTS.md" | Seed scripts read the password from env or generate one and print it once. Instruction files name the variable, never the value. |

## Verification
- [ ] No secret value appeared in any output, file or commit.
- [ ] `.env.example` lists every variable the code reads.
- [ ] Every transfer to a platform used a pipe or script, not an echo.
