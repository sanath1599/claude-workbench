# Reviewer checklists

Paste the list for a focus into that reviewer's brief. Each reviewer reports only problems introduced by the diff.

## Correctness

- A value that can be null, undefined or empty used without a guard.
- Off-by-one in loops, slices, pagination and date ranges.
- Async mistakes: missing await, unhandled rejection, work started and never joined.
- Shared state mutated by two paths; check-then-act races; the same operation running twice.
- Errors swallowed, or caught and turned into success.
- Resources not released: files, connections, timers, listeners, subscriptions.
- Loops or recursion without a guaranteed end.
- Changed behaviour of a function whose callers were not updated.
- Tests that cannot fail, or that were weakened to pass.

## Security

- Untrusted input reaching a query, a shell command, a file path, a URL fetch or HTML without escaping or parameters.
- Missing or wrong authorisation on a new route; object ids taken from the request without an ownership check.
- Secrets in code, logs, error messages, fixtures or client bundles.
- Sensitive data in responses beyond what the caller needs.
- Webhook or token checks done with a plain comparison, or without a timestamp window.
- New dependency added without a reason.

For a full audit use engineering-craft:reviewing-security.

## Conventions

- Rules in CLAUDE.md, AGENTS.md and the project docs that the diff violates. Quote the rule and the line. Rules written as advice for how Claude should behave do not count.
- Banned or required libraries (for example the toast library, the ORM adapter, the package manager lockfile).
- Naming, layout and test placement that the rest of the repo follows.

## TypeScript and JavaScript

- Type assertions that hide a real mismatch; non-null assertions without a reason; `any` crossing a module boundary.
- Floating promises; `async` handlers whose rejection nobody sees.
- Hook dependency arrays that are wrong; state derived in an effect instead of during render; objects created in render that break memoisation.
- N+1 queries in loops; unbounded lists without pagination.

## Python

- Mutable default arguments; bare `except`; `is` used for value comparison.
- Missing context managers for files and connections.
- Blocking calls inside async code.
- Pydantic or schema models that accept more than the code handles.

## Architecture (large changes only)

- A new pattern where the repo already solves the same problem another way.
- A layer reaching into another layer's internals; a new circular import.
- Business rules placed in infrastructure code, or the reverse.
- Duplicated logic that should live in one place, when the duplication is in this diff.
- A new dependency, service or table with no stated need.

## Output every reviewer uses

```
FINDING: <title>
LOCATION: <file>:<line>
SEVERITY: blocking | should-fix | consider
CONFIDENCE: <0-100>
PROBLEM: <one or two sentences>
FIX: <diff-style or one sentence>
```

If nothing is found: `NO FINDINGS` and one line listing what was checked.
