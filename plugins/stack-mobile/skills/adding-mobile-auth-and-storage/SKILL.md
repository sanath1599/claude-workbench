---
name: adding-mobile-auth-and-storage
description: Use when a mobile app needs sign-in, OAuth or OIDC, magic links, passkeys, biometric unlock, token storage or refresh, calls to the owner's FastAPI or TanStack Start backend, or a local database or offline sync with SQLite. Not for web login (stack-web:adding-auth) or push tokens (sending-push-notifications).
---

# Adding mobile auth and storage

Pick the lightest sign-in that fits the audience, keep tokens only in the device keystore, and let the server make every access decision. A phone is an untrusted client: anything in the bundle or on disk can be read.

## When to use

- Login for a new Expo app, or adding SSO, magic link or passkeys.
- Storing tokens, unlocking with Face ID or fingerprint, refreshing sessions.
- Calling the owner's backend from the app.
- A local database, offline writes or sync.

## When not to use

- Cookies, CSRF and web sessions: `stack-web:adding-auth`.
- Push tokens and notification permission: `stack-mobile:sending-push-notifications`.
- Backend route design: `stack-python:building-fastapi-services`.

## Decision table

| Audience | Use | Notes |
|---|---|---|
| Internal tool, few trusted people | One shared passcode exchanged for a server-issued token | No accounts. Rate-limit on the server. |
| Business staff | Backend email + password or magic link, issued tokens | argon2 hashes on the server, never on device. |
| Enterprise client | The client's OIDC (for example Entra) via `expo-auth-session` | Their tenant; PKCE; no local passwords. |
| Consumers, low friction | Magic link or one-time code, then passkey | `references/flows.md` |
| Developer product | GitHub OAuth with PKCE | Users bring their identity. |

State the row in one line in the README. Ask only if the audience is truly unclear.

## Procedure

1. **Pick the row and the token model.** The app holds a short-lived access token (minutes) and a rotating refresh token (days to weeks). No cookies, no long-lived single token. **Done when:** the README names audience, method, and token lifetimes.
2. **Browser-based sign-in uses PKCE.** `expo-auth-session` with `useAuthRequest` and `makeRedirectUri({ scheme })`; PKCE with S256 is the default, never turn it off. Register every redirect URI with the provider: the development build and Expo Go differ, and the `scheme` must exist in the installed build. Prefer a provider's own native library when one exists. Exchange the code with the backend or the provider token endpoint, never embed a client secret in the app. Code in `references/flows.md`.
3. **Store tokens in the keystore.** `expo-secure-store` (Keychain on iOS, Keystore-encrypted storage on Android) for refresh and access tokens only. Not AsyncStorage, not MMKV, not SQLite, not query-cache persistence. Keep values small. On iOS, Keychain items can survive an uninstall: clear them on first launch after a fresh install (track with a non-secret flag in AsyncStorage). **Done when:** a grep of the app for token writes shows only SecureStore.
4. **Refresh once, centrally.** One API client wraps `fetch`: attach `Authorization: Bearer`, on 401 refresh with a single in-flight promise shared by concurrent requests, retry once, and on refresh failure clear tokens and route to sign-in. The server rotates the refresh token on every use and revokes the family on reuse. Code in `references/flows.md`.
5. **Biometric unlock is a local gate, not auth.** `expo-local-authentication` checks `hasHardwareAsync` and `isEnrolledAsync`, then `authenticateAsync` before revealing the app or a sensitive screen after backgrounding for N minutes. The session stays valid on the server. For stronger binding, store the refresh token with `requireAuthentication: true` in SecureStore. Always offer the device passcode fallback. Add the `NSFaceIDUsageDescription` text through the config plugin.
6. **Passkeys where supported.** They need an OS version that supports them, associated domains (iOS) and a Digital Asset Links file (Android) hosted on `{{wb.domain}}`, plus a server WebAuthn implementation. Offer them as an upgrade after a first sign-in, never as the only path. Check the current library status before choosing one; they need a development build.
7. **Talk to the backend through one typed client.** Base URL from `EXPO_PUBLIC_API_URL`; Zod-parse responses; surface errors as typed results; send an `X-Client-Version` header so the server can force-upgrade old builds. FastAPI verifies tokens on every route; TanStack Start server functions do the same. Never trust a role or user id sent by the client. TLS only; no cleartext exceptions in release.
8. **Sign-out and revocation.** Sign-out calls the server to revoke the refresh token, then deletes SecureStore items, the query cache and the local database. Account deletion is required by both stores for apps with sign-up: provide an in-app path.
9. **Local database (only when queries or offline writes need it).** `expo-sqlite` for relational data; Drizzle ORM with its Expo SQLite driver is an option for typed queries and migrations. Key-value preferences go to AsyncStorage or MMKV. Encrypt sensitive tables with SQLCipher only when the data warrants it. Details and the sync checklist in `references/local-data-and-sync.md`.
10. **Test auth without real providers.** A mock token endpoint in tests; expiry, refresh-race, revoked-token and offline-start cases in unit tests; Maestro flow for sign-in against a staging backend with a test account (see `stack-mobile:testing-mobile-apps`). Tests never call real identity or email providers.
    **Done when:** a fresh install signs in, survives a kill and relaunch, refreshes after the access token expires, and signs out cleanly, with the evidence from a device run.

## Quick reference

| Need | Use |
|---|---|
| OAuth / OIDC | `expo-auth-session`, PKCE, `makeRedirectUri` |
| Open the system browser | `expo-web-browser` |
| Token storage | `expo-secure-store` |
| Biometric gate | `expo-local-authentication` |
| Random values / hashing on device | `expo-crypto` |
| Local relational data | `expo-sqlite` (+ Drizzle) |
| Secrets in the app | none; use the backend |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "AsyncStorage is easier for the token." | It is plaintext on disk. Use SecureStore. |
| "Long-lived token so users never re-login." | Short access + rotating refresh. |
| "Client secret in the app, it is minified." | PKCE public client, or exchange on the backend. |
| "Hide the admin tab for non-admins." | Enforce on the server; the UI is a convenience. |
| "Biometrics means we can skip the server session." | It only unlocks local access. |

## Verification

- Tokens only in SecureStore; none in logs, query cache, crash reports or analytics.
- PKCE on; redirect URIs registered for every runtime in use; no client secret in the bundle.
- Single-flight refresh tested with parallel 401s; refresh failure signs out.
- Sign-out revokes server-side and wipes local data; account deletion path exists.
- Biometric prompt has a passcode fallback and a usage string.
- Offline start shows cached data and does not log the user out on a network error.

## References

| File | Load when |
|---|---|
| references/flows.md | writing OAuth, magic link, refresh client, biometric gate |
| references/local-data-and-sync.md | adding SQLite, Drizzle, offline writes or sync |

## Versions

- expo-auth-session 58.0.17, PKCE S256 default, scheme changes need a new build (verified 2026-11-05, https://docs.expo.dev/versions/latest/sdk/auth-session/)
- expo-secure-store 58.0.2 (verified 2026-11-05, https://docs.expo.dev/versions/latest/sdk/securestore/)
- expo-local-authentication 58.0.2 (verified 2026-11-05, https://docs.expo.dev/versions/latest/sdk/local-authentication/)
- expo-web-browser 58.0.7, expo-crypto 58.0.7 (verified 2026-11-05, https://docs.expo.dev/versions/latest/)
- expo-sqlite 58.0.15 (verified 2026-11-05, https://docs.expo.dev/versions/latest/sdk/sqlite/)
- drizzle-orm 0.45.4, drizzle-kit 0.31.11 (verified 2026-11-05, https://orm.drizzle.team/docs/connect-expo-sqlite)
