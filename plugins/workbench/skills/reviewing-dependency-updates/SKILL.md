---
name: reviewing-dependency-updates
description: Use when the session-start note lists dependency updates waiting for a decision, when the owner asks what changed in a library, whether to upgrade, or to check changelogs, or before a large feature built on a fast-moving package (Pydantic AI, Temporal, TanStack, Vite, Qdrant). Not for pinning a security fix during an incident, which is ops-and-sre:handling-incidents.
---

# Review dependency updates

At the start of each session the owner wants every newer release of the stack's key packages checked: can the app benefit? Adopt what helps. Record each decision, including every decline with its reason, in the repo. The SessionStart hook finds the candidates; this skill turns them into decisions.

## When to use
- The session context contains "Dependency updates waiting for a decision".
- The owner asks "anything new in X?", "should we upgrade?" or "check the changelogs".

## When not to use
- Updating the workbench's own skills. A daily GitHub Action does that (see the repo's maintenance/README.md).

## Procedure

1. **List.** Run `node ../../scripts/check-updates.mjs --report` from this skill's directory (or take the list from the session note). Order the work: security fixes first, then major versions, then minors.
   **Done when:** you have the list. If it is empty, stop.

2. **Read the changelog** for the range installed → latest of each package. Sources, in order: the project's CHANGELOG or release notes page, then GitHub releases (`gh api repos/<owner>/<repo>/releases --jq '.[0:10][] | {tag_name, published_at, body}'`), then the docs changelog. Check the official docs rather than relying on memory.

3. **Map to this app.** Grep how the repo uses the package (`rg -n "<import or API name>"`). For each change, note whether it is breaking, a security fix, a deprecation affecting code we use, or a feature we could use (name the file or feature that would benefit).

4. **Decide per package:**

   | Decision | When |
   |---|---|
   | Adopt now | security fix; a small, safe upgrade; or a feature with clear value. Tests exist to prove it. |
   | Plan | valuable but large (a major version, a migration). Write the plan in NEXT_STEPS.md. |
   | Decline | no benefit to this app, too risky now, or blocked by another package. The reason is required. |

5. **Adopt.** Work on a branch: upgrade, update the lockfile with the repo's package manager, fix deprecations, run the full test suite and the build, then commit per the project's policy. Keep one package or one tightly coupled group (for example all `@tanstack/*`) per commit.

6. **Record every decision** in `docs/dependency-decisions.md`. Create it if missing:
   ```markdown
   | Date | Package | From | To | Decision | Reason | Notable changes |
   |---|---|---|---|---|---|---|
   | 2026-11-05 | pydantic-ai | 2.61.0 | 2.66.0 | adopt | fallback now covers refusals; fixes a high-severity advisory | ModelFallback refusals; WebFetch fix |
   ```
   The hook stops listing a package once a row contains its name and the latest version.
   **Done when:** every listed package has a row.

7. **Report** in at most 5 lines: what was adopted (with test results), what was planned, what was declined and why, and any security item first.

## Rationalizations

| Excuse | Instead |
|---|---|
| "Nothing relevant, skip writing it down." | Declines are recorded too, with the reason. That is the owner's rule. |
| "I know this library; no need to read the changelog." | Fast-moving packages rename APIs between minors. Read the changelog. |
| "Upgrade everything at once." | One package or coupled group per commit, with tests between. |
| "The owner asked for something else, so ignore updates." | Do the urgent request first, then the review, in the same session. |

## Verification
- [ ] Every listed package has a decision row with a reason.
- [ ] Adopted upgrades pass the tests and the build.
- [ ] Security fixes were reported to the owner first.
