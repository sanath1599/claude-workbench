---
name: designing-systems
description: Use when asked to design a system, service, feature architecture or data flow, choose between architectures, size capacity or cost, or write an ADR. Not for choosing the base stack (stack:choosing-the-stack), hardening an existing design against failures (hardening-distributed-systems) or API contracts (designing-apis).
---

# Designing systems

A design is finished when someone else can see what was chosen, what was rejected and why. Interview first, size it with numbers, compare at least two real alternatives, then record the decision.

## When to use

- "Design X", "how should we architect Y", "monolith or services", "which queue/store/cache".
- A feature that adds a new store, a new async path, a new external dependency or a new trust boundary.
- Someone asks "will it scale" or "what will it cost".

## When not to use

- Picking the language, framework or host for a new project: `stack:choosing-the-stack`.
- Making an existing design survive retries, partial failure and duplicates: `hardening-distributed-systems`.
- Long-running workflow mechanics: `stack-python:orchestrating-with-temporal`. Schema design: `stack-python:modeling-data-in-postgres`.
- Rolling it out: `ops-and-sre:releasing-safely`. Targets and alerts: `ops-and-sre:defining-slos-and-alerts`.

## Procedure

### 1. Interview

Read the repo first (README, CLAUDE.md, `docs/adr/`, existing glossary). Ask only what the repo cannot answer, in one batch of at most 4 questions. Give each option its cost, scale and reversibility, and recommend the lightest reversible one. Cover: who uses it, the one workflow that must never fail, expected scale in 12 months, and any fixed constraint (existing stack, deadline, budget).

If the owner already said "decide", do not ask. Write assumptions into the document and flag them.

**Done when:** you can state the problem in two sentences and list the assumptions you made.

### 2. Requirements and non-goals

Write functional requirements as observable behaviours. Write quality requirements as numbers (latency p95, availability, durability, recovery point, data retention). Write non-goals explicitly: what this design will not do, so nobody assumes it does.

**Done when:** each requirement is testable, and there are at least two non-goals.

### 3. Numbers

Run the estimator with the interview figures. Prefer stating ranges: run it once at expected load and once at 10x.

```bash
node scripts/estimate.mjs --dau 20000 --requests-per-user 40 --record-kb 4 --response-kb 12
node scripts/estimate.mjs --file load.json --json
```

Read `references/numbers.md` for latency and throughput orders of magnitude and which prices to override. The default prices are placeholders: replace them with the real plan prices before quoting a cost.

State the conclusion the numbers force. "Peak 28 QPS, 150 GB in a year: one Postgres instance, no sharding, no cache" is a result. A table of numbers with no conclusion is not.

**Done when:** the output table is pasted in the design and at least one decision is justified by it.

### 4. Alternatives

Produce at least two designs that could really be chosen, including the boring one (usually: one service, one Postgres, a Temporal workflow for the long part). Do not include a strawman. Compare in a table on the dimensions that matter for this problem, not a stock list:

| Dimension | A: boring | B: ambitious |
|---|---|---|
| Meets the numbers | | |
| Failure modes added | | |
| Operational burden | | |
| Time to first working version | | |
| Cost per month | | |
| Reversibility | | |

Design the interface of the riskiest component twice before choosing. Prefer a few deep modules (small interface, much behaviour) over many shallow ones.

**Done when:** the table has no empty cells and the recommended option names what it gives up.

### 5. Decide and record

Copy `assets/adr-template.md` to `docs/adr/NNNN-short-title.md` (next free number, four digits). Fill every section, including Consequences and the condition that would make you revisit. Add new domain words to `docs/glossary.md` (create it from `assets/glossary-template.md` if missing) and use those exact words in code and docs.

If the design adds failure-prone paths (queues, retries, webhooks, multi-step writes), run `hardening-distributed-systems` before calling it final.

**Done when:** the ADR file exists, its status is Proposed or Accepted, and the glossary has every new term.

## Quick reference

| Question | Default answer until numbers say otherwise |
|---|---|
| Services | One deployable. Split only on a different scaling, team or failure boundary. |
| Database | Postgres. Add Qdrant only for a real vector-search requirement. |
| Async work | Temporal for multi-step, long or human-in-the-loop. A plain table-backed job for fire-and-forget. |
| Cache | None until a measured read problem. Then cache with a TTL and a stampede plan. |
| Queue | Postgres `SKIP LOCKED` below roughly 100 jobs/s. A broker above that or across services. |
| Realtime | Server-sent events before websockets. LiveKit for voice and video. |
| Entity with stages | One `Record<Status, Status[]>` table in a pure module plus a history row per change. See `references/patterns.md` |
| "Module A may not import B" | An AST test with a shrink-only allowlist, not a convention. See `references/patterns.md` |
| Browser "what if" plus a server decision | One pure rules module imported by both; the server recomputes. See `references/patterns.md` |
| Paid lookups (routing, geocoding) | JSON cache keyed by input, committed; fetch only missing keys behind `--refresh` |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "We will need to scale" | Run the estimator at 10x. If one instance holds, write the trigger for revisiting and stop. |
| "Only one option is viable" | Write the second option anyway. If it truly fails, say which requirement it violates. |
| "An ADR is overhead" | Ten lines now saves the next session re-deriving the decision. Keep it short, not absent. |
| "Microservices for isolation" | Name the failure boundary. If you cannot, it is a module. |

## Verification

- [ ] Estimator output included, with at least one conclusion drawn from it.
- [ ] Non-goals listed.
- [ ] Two or more alternatives with a filled trade-off table.
- [ ] ADR written at `docs/adr/NNNN-*.md`; glossary updated.
- [ ] Open assumptions and risks named once, each in a single line.

## References

| File | Load when |
|---|---|
| references/numbers.md | sizing, choosing prices, sanity-checking an estimate |
| assets/adr-template.md | writing the ADR |
| assets/glossary-template.md | creating or extending the glossary |
| references/patterns.md | modelling status flows, enforcing boundaries, sharing rules between browser and server |
