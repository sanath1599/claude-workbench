---
name: adding-auth
description: Use when an app needs login, sign-in, sessions, route guards, passwords, an admin area, or "who can access this". Picks the lightest auth that fits the audience before writing code. Not for deployment protection settings on Vercel, which is deploying-on-vercel.
---

# Adding auth

Choose the lightest auth that works for the audience, state the choice in one line, then build it. Do not reach for Clerk or an identity provider when a shared password is enough; the owner has declined that before.

## When to use

- A new app needs a login, or an existing one has none and holds data.
- Protecting routes, API endpoints or an admin area.
- "Add a password", "sign in with GitHub", "use the client's SSO".

## When not to use

- Making a Vercel deployment private: that is a Vercel project setting, see `stack-web:deploying-on-vercel`.

## Decision table

| Audience | Use | Notes |
|---|---|---|
| Internal tool, a few trusted people | One shared password, signed cookie | No user table. Accepted over Clerk. |
| Multi-user developer product | GitHub sign-in (OAuth) + GitHub App for repo access | Users bring their own GitHub identity. |
| Business app with named staff | Local accounts provisioned by an admin | No public sign-up. argon2 hashes. |
| Enterprise client | The client's OIDC, for example Entra | Use their tenant; no local passwords. |
| Applicants or guests, no accounts | Random token, hash stored, cookie per resource | `references/variants.md` |
| Staff with roles, instant revocation | Database sessions | `references/variants.md` |
| Internal tool, org already has sign-in | Verify once, then your own 8-hour signed cookie | `references/variants.md` |

Ask only if the audience is truly unclear, in the same batch as other open questions.

## Procedure

1. **Pick the row** and record it in the README. **Done when:** one line states audience and method.
2. **Passwords.** Hash with argon2id (npm `argon2` or `@node-rs/argon2`; Python `argon2-cffi`). Never store, log or return plaintext. Compare in constant time. For the shared-password variant, store one hash or compare against an env secret with a constant-time check.
3. **Sessions are HMAC-signed cookies.** Payload holds user id (or a fixed marker) and an expiry; sign with HMAC-SHA256 using `SESSION_SECRET` from env (32+ random bytes); verify signature and expiry on every request. Cookie flags: `HttpOnly`, `Secure` (always except local http), `SameSite=Lax` (or `Strict`), `Path=/`, explicit `Max-Age`. Rotate by changing the secret (this signs everyone out). For anything needing instant revocation, keep a server-side session row instead.
4. **CSRF.** Any cookie-authenticated, state-changing request needs protection: `SameSite` plus an Origin check on non-GET requests, and a per-session token for form posts. JSON APIs using bearer headers instead of cookies skip this.
5. **Rate-limit login.** Limit by IP and by account (for example 5 attempts per 15 minutes), return the same error for unknown user and wrong password, and add a small constant delay. Back it with the database or Redis; an in-memory counter is only acceptable on a single long-lived process.
6. **Frontend guard (TanStack Router).** Put the check in `beforeLoad` of a layout route: read the session (a `/api/me` call through the query client or `context.auth`), and `throw redirect({ to: "/login", search: { next: location.href } })` when missing. Guards improve UX only; the API must enforce access itself.
7. **Backend guard (FastAPI).** A dependency (`Depends(current_user)`) that verifies the cookie and returns the user or raises 401; an admin dependency wraps it and raises 403. Apply it at the router level so new endpoints are protected by default.
8. **GitHub OAuth + GitHub App outline.** Register a GitHub App (not just an OAuth App) with minimal permissions. Flow: redirect to GitHub with a random `state` stored in a short-lived cookie; on callback verify `state`, exchange the `code` server-side, fetch the user, create your session cookie. For repo access, store the installation id and mint short-lived installation tokens server-side; never ship tokens to the browser. Permissions, token minting and setup flow are in `references/variants.md`. Read https://docs.github.com/en/apps before implementing.
9. **Provisioned accounts.** An admin creates users and an invite or temporary-password flow sets their own password. Disable sign-up routes entirely. Log admin actions.
10. **Test.** Cover: wrong password, expired or tampered cookie, missing cookie on a protected route (401 or redirect), CSRF origin rejection, and rate-limit lockout. Tests use a fixed `SESSION_SECRET` and never real identity providers.
    **Done when:** those tests pass and an unauthenticated request to every protected endpoint is rejected.

## Rationalizations

| Excuse | Instead |
|---|---|
| "Add Clerk to be safe" | Match the audience. Shared password for a few people. |
| "The route guard is enough" | Enforce on the server for every request. |
| "Store the session in localStorage" | Use an HttpOnly cookie; script cannot read it. |
| "Sign-up can stay open for now" | Business apps provision users; no public sign-up. |

## Verification

- Method matches the table row; no unneeded provider added.
- Secrets (`SESSION_SECRET`, OAuth secrets) in env only.
- Cookie flags checked in a real response.
- Server rejects unauthenticated calls independent of the frontend.

## References

| File | Load when |
|---|---|
| references/variants.md | accountless links, role-based DB sessions, org sign-in with your own cookie, or a GitHub App |

## Versions

- argon2 (npm) 0.45.2, @node-rs/argon2 2.2.2 (verified 2026-11-05, https://registry.npmjs.org/argon2/latest)
- GitHub Apps docs (verified 2026-11-05, https://docs.github.com/en/apps)
