# Auth variants

Detail for the rows of the decision table in `SKILL.md`. Each variant keeps the core rules there (argon2id, constant-time compare, cookie flags, CSRF, rate limits).

## Accountless users (applicants, guests)

- Issue a 32-byte random token and store only `sha256("<app>:v1:" + token)`. Send the token in an `HttpOnly` cookie scoped to the resource (per campaign, per link) and check it on every API call.
- Reject malformed tokens with a regex before any database lookup.
- Links sent by email carry their own single-purpose, expiring tokens.
- Test that user A's token cannot read user B's record.

## Database sessions for staff with roles

Use a session table instead of a signed cookie when staff have roles (admin, recruiter, viewer) and an account must be revocable at once.

- A random token whose hash is stored; idle and absolute expiry (for example 8 h and 24 h); the row is deleted on logout or deactivation.
- Hash passwords with argon2id. When the email does not exist, still verify against a hash of a random password so response time does not reveal which emails are registered.
- Pass `algorithm: 2` to the argon2 binding rather than importing its `const enum` under `isolatedModules`.
- Record the staff member's name, not just an id, in the audit log.

## Internal tool inside an org that already has sign-in

Verify the user's credential against the org's API once, then issue your own signed, `HttpOnly`, 8-hour cookie.

- Fail startup in production if `AUTH_SECRET` is shorter than 32 characters. Outside production a missing secret may fall back to a random per-process one, but every restart then signs everyone out; pin it in the deploy env.
- Any `AUTH_DISABLED` escape hatch must check `NODE_ENV !== "production"` in code.
- Without an allow-list, any holder of an org credential can view. State the audience (any employee, or a group) in the handoff and keep the data low-sensitivity or add a group check.

## GitHub App with read-only, per-repository tokens

- Repository permissions: Contents read, Metadata read, nothing else. Leave the webhook inactive unless you handle events. Turn on "Expire user authorization tokens". Callback `/api/auth/github/callback`; Setup URL is your "choose repositories" page.
- Mint an App JWT (RS256, `iat` 30 s in the past, `exp` under 10 minutes), then request an installation token with `repositories: [one]` and the permissions repeated explicitly, so the token is narrower than the installation.
- Put the private key in env on one line with `\n` escapes; in a systemd `EnvironmentFile=` wrap it in single quotes (see `ops-and-sre:deploying-to-a-vps`).
- After sign-in, if no repository is installed yet, send the user to setup and poll until the installation appears; do not show an empty list.
- Never send GitHub or personal access tokens to a model or a connector. The server clones; the model reads files through tools.
