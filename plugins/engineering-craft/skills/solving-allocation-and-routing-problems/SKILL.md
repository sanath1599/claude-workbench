---
name: solving-allocation-and-routing-problems
description: Use when assigning scarce people, vehicles or capacity to many sites under rules (assignment, scheduling, routing, coverage, staffing, facility location, bin packing), comparing scenarios, or letting an assistant propose changes. Not for generic system design (designing-systems) or spreadsheet-only questions (docs-and-data:analysing-tabular-data).
---

# Solving allocation and routing problems

Rules first, solver second, independent checker always. A plan is only as good as the rules written down with the owner and the checker that proves every one holds.

## When to use

- "Who should cover which site", "how many people do we need", "which depots to keep", "route these visits".
- Hard rules: skill or gender matching, never across regions, one dedicated person for priority sites, pairs within a travel limit, pooled cover for small sites.
- Questions of the form "what happens to coverage if the limit drops to 30 minutes".
- An assistant must propose plan changes that a rule engine validates.

## When not to use

- A greedy rule or sort gives an answer the owner accepts, there are fewer than about 30 items, or the rules are a lookup. Use a spreadsheet: `docs-and-data:producing-spreadsheets` and `docs-and-data:analysing-tabular-data`. Say so and stop.
- Designing a service or data flow: `designing-systems`.
- Rendering the maps: `stack-web:building-map-apps`.

## Procedure

### 1. Capture the rules

Write each rule in the owner's words, then classify it **hard** (never broken) or **soft** (traded off, with a stated weight). Ask for exceptions that already exist and who approves them. Record them in `docs/rules.md` with an id per rule.

**Done when:** the owner has confirmed the list, and every rule has an id, a type and a checkable definition.

### 2. Audit the data

Check missing or swapped coordinates, duplicate sites or people, units (sites per person, hours, headcount), people without a region, sites with no eligible person, and capacity that is below total demand. Report counts and the named rows.

**Done when:** a data-audit note lists the issues found and the owner has decided each (fix, drop, flag).

### 3. Build the travel-time matrix

Pick a source with the table in `references/travel-times.md` (self-hosted OSRM or Valhalla, or a paid routes API with caching), fix one departure rule, estimate cost before any paid call, cache every answer, and validate the matrix.

**Done when:** a cached integer-minute matrix exists with its source and date recorded, and the owner has approved any paid-call cost.

### 4. Choose the model

| Situation | Model |
|---|---|
| Pairs are eligible or not, capacities and costs only | min-cost flow (`SimpleMinCostFlow`) |
| Eligibility plus side rules (pairs, dedicated sites, spread caps) | CP-SAT assignment/MIP |
| Choose which locations to open or keep | CP-SAT coverage model |
| Several stops per person per day, time limits | OR-Tools routing (VRP) |
| Over about 100,000 binary variables, no proof needed | clustering plus local search, then repair and check |
| Simple rule, small size | greedy plus the checker |

Start with the simplest row that holds every hard rule. Patterns and code sketches are in `references/modelling-patterns.md`.

**Done when:** the chosen model and the rejected alternatives are named in two lines in the run notes.

### 5. Solve with limits

Set a time limit, a relative gap, and a seed. Print solver status (optimal, feasible, infeasible, unknown), objective and gap with the result. On infeasible, find the cause (drop rules one at a time, or list sites with no eligible person) and report it; never relax a hard rule silently.

**Done when:** the run prints status, objective, gap and time, and any non-optimal status is explained.

### 6. Validate independently

Write the plan as JSON and run the checker, which shares no code with the model:

```bash
python3 scripts/validate_plan.py plan.json rules.json
```

It exits 1 and prints violations as JSON for capacity, travel limit, attribute match, region, coverage and dedicated sites, and reports waived exceptions separately. Fix the model, not the checker, when they disagree. Add any rule the script lacks as a local check beside it.

**Done when:** the checker exits 0 on the final plan and on each scenario you present.

### 7. Sweep and test sensitivity

Vary the real decisions on a grid with `python3 scripts/sweep.py config.json --out sweep.csv`. Design, Pareto views and monotonicity checks are in `references/scenarios-and-reporting.md`.

**Done when:** a sweep CSV exists with failed and infeasible cells marked, and a shortlist of 3 to 5 scenarios is named.

### 8. Explain the result

Produce, per option: an impact table ("what changes for whom"), the named sites behind each headline number, before/after on a map, and a workbook with live formulas. State assumptions once (departure time, time source, exceptions in force). Reports and charts follow `docs-and-data:producing-spreadsheets`, `design-studio:styling-charts-and-data-displays` and, for a guided walkthrough, `design-studio:presenting-guided-demos`.

**Done when:** a non-technical reader can say what changes for them, and every headline count has its list.

### 9. Hand changes to an assistant (only if asked)

The model proposes, the engine validates, a human confirms any rule break. Build three tools: `find_candidates`, `try_changes`, `stage_changes`, per `references/llm-in-the-loop.md`.

**Done when:** a test with a mocked model shows a rule-breaking proposal is refused without a human confirmation token.

## Quick reference

| Question | Answer |
|---|---|
| Hard rule or penalty? | Hard rules go in eligibility or constraints, never in the objective |
| Solver says optimal; done? | No. Run the independent checker |
| Straight-line distance? | Screening only. Use road minutes for any rule stated in minutes |
| Paid routes API? | Count elements, sample, cache, get the owner's yes on cost |
| Headline number? | Always with the named list behind it |
| Exceptions? | Data with a reason and an approver, reported as waived |

## Rationalizations

| Excuse | Instead |
|---|---|
| "The solver proved it optimal, skip the checker" | Optimal for the model, which may be wrong. Run the checker. |
| "Make the rule a big penalty" | Penalties get traded away. Make it a constraint. |
| "Straight-line distance is close enough" | Rules in minutes need road times; use it only to prune. |
| "One scenario is enough" | Sweep the real decisions and show the trade-off. |
| "It is infeasible, relax a bit" | Report what blocks it and let the owner choose. |

## Verification

- [ ] Every rule has an id, hard or soft, and the owner's wording.
- [ ] Data audit done; decisions recorded.
- [ ] Matrix source, departure rule and date recorded; paid cost approved.
- [ ] Solver status, gap, time limit and seed printed.
- [ ] `validate_plan.py` exits 0 for every presented plan; waived rules listed.
- [ ] Sweep results saved; infeasible cells shown.
- [ ] Each headline count links to named sites.
- [ ] Any assistant tool path refuses unconfirmed rule breaks.

## References

| File | Load when |
|---|---|
| references/modelling-patterns.md | writing the model: assignment, pairing, flow, coverage, VRP, fairness, matching, exceptions |
| references/travel-times.md | building or costing the drive-time matrix |
| references/scenarios-and-reporting.md | sweeps, Pareto views, before/after, Excel and map outputs |
| references/llm-in-the-loop.md | an assistant proposes changes that the engine validates |

## Versions

- ortools 9.15.6755 (verified 2026-11-05, https://pypi.org/project/ortools/)
- networkx 3.7 (verified 2026-11-05, https://pypi.org/project/networkx/), optional, only for graph cross-checks
- osrm-backend v26.11.0 (verified 2026-11-05, https://github.com/Project-OSRM/osrm-backend/releases/latest)
- valhalla 3.9.1 (verified 2026-11-05, https://github.com/valhalla/valhalla/releases/latest)
- googlemaps 4.10.0 (verified 2026-11-05, https://pypi.org/project/googlemaps/)
- Google Routes API docs checked 2026-11-05 (https://developers.google.com/maps/documentation/routes); pricing and element limits change, read them before sizing a run.

Read the current docs of each tool before using options not shown here.
