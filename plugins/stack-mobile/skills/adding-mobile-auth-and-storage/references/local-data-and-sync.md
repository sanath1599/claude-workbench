# Local data and sync

Docs: https://docs.expo.dev/versions/latest/sdk/sqlite/ , https://orm.drizzle.team/docs/connect-expo-sqlite

## Do you need a local database?

| Need | Use |
|---|---|
| Last-seen lists for offline reading | TanStack Query persisted cache |
| Settings and flags | AsyncStorage |
| Search across thousands of local rows, joins, offline creation | SQLite |
| Secrets | SecureStore, never a database |

## Setup

- `npx expo install expo-sqlite`. Open one database with `openDatabaseSync` (or the async API) in a provider; enable WAL mode.
- Migrations: numbered, forward-only, run at startup before the UI renders. With Drizzle: define the schema in TypeScript, generate SQL with `drizzle-kit`, and bundle the migrations (read the Expo SQLite page of the Drizzle docs for the Metro and Babel setup).
- Keep the schema aligned with the API's Zod types; share the types from `packages/`.

## Sync checklist

1. Every row has a client-generated id (UUID v7 or ULID), `updated_at`, and `deleted_at` for soft deletes.
2. Writes go to the local database first and into an outbox table (`id, op, payload, attempts, created_at`).
3. A single sync worker drains the outbox in order when online (NetInfo + app foreground), with exponential backoff, and marks rows done only after a 2xx.
4. The server endpoint is idempotent on the client id.
5. Pull by cursor (`updated_since`), apply in a transaction, tombstones included.
6. Conflicts: last-write-wins by server timestamp unless the domain needs field-level merge; write down the choice.
7. Show sync state in the UI (synced, syncing, offline, failed with retry). A failed item never disappears silently.
8. Test: create offline, kill the app, relaunch, reconnect; edit on two devices; server returns 500 mid-batch.

## Safety

- Clear the database on sign-out and on account deletion.
- iOS file protection and Android app-private storage are the default; avoid writing user data to shared storage.
- Do not log row contents.
