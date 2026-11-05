# Design patterns that recur

## Status transition table with history

For any entity that moves through human and machine stages, write the transitions as one `Record<Status, Status[]>` table in a pure module with `canTransition`, `allowedNext` and `assertTransition`. Every persisted change writes a history row: from, to, actor type and id, reason. Add recovery edges on purpose (parse failure back to the start, expired schedule back to invited, a human re-invite from abandoned or declined). Unit-test that the table has no dead ends except terminal states. Keep derived facts (latest interview, review state) as separate columns rather than adding statuses; a couple of dozen statuses is workable, many more is not.

## Boundaries enforced by an AST test

When a design says "module A may not import B" or "only X holds the write-capable client", encode it as a test that walks the AST. Start from today's violations in an allowlist file that may only shrink: the test fails on a violation not listed and on a listed entry that is gone. A refactor can then migrate in steps without hiding new breaches.

## One rules engine, recomputed on the server

When users simulate changes in the browser, put the rules in one pure module that both the page and the server import (inline it into a single-file page at build time). Clients send only the change list. The server re-runs the same module on current server state, derives impact, warnings and email text itself, and caps list lengths and string sizes. Never store or email numbers the client computed.

## Cache paid lookups in a committed file

Data builders that call a paid API write results to a JSON cache keyed by the input, commit the cache, and fetch only missing keys behind an explicit flag. Raw source files that hold third-party data stay out of git; the built, anonymised output is committed.
