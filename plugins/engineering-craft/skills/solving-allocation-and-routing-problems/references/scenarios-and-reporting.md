# Scenarios and reporting

## Sweep design

A sweep answers "how much does the answer depend on the rules we chose". It is not a hunt for the best-looking row.

1. List the knobs that are real decisions (travel limit, pool size, pair cap, number of people) and fix everything else.
2. Pick levels the owner could actually choose, usually 3 to 6 per knob. Hundreds of combinations are fine for a fast solver; more is noise.
3. Fix the random seed and the time limit per run. Record both.
4. Run with `python3 scripts/sweep.py config.json --out sweep.csv`. The solver command prints one JSON line of metrics (covered sites, total minutes, worst minutes, people used, solver status, gap).
5. Mark infeasible and timed-out cells explicitly. A hole in the grid is information.
6. Check monotonicity: a looser limit should never make the objective worse. A violation means a bug or a timeout, not a discovery.

## Metrics worth reporting

Sites covered, sites uncovered (list), total and 90th percentile travel minutes, worst single assignment, people used and their load spread, rules waived, solver status and gap.

## Pareto views

Plot two conflicting metrics (for example total travel against uncovered sites) and keep only non-dominated scenarios. Show 3 to 5 named options, each with one sentence on who benefits and who loses. Charts follow `design-studio:styling-charts-and-data-displays`.

## Before and after

For two plans, produce a diff table: site, old person, new person, old minutes, new minutes, reason. Then roll it up: counts of sites better, worse and unchanged; the sites that cross a threshold ("97 sites lose 30-minute reach"); the people whose load changes most. Always list the named sites behind a headline count, in an appendix sheet or a click-through.

## Excel outputs with live formulas

Follow `docs-and-data:producing-spreadsheets`. Put knobs (limits, weights, caps) on an Assumptions sheet and drive summaries from formulas, so the owner can change a threshold and see counts update. Layout: Summary (formulas), Assignments (values), Diff (values), Exceptions (values with reasons), Assumptions (inputs), Run info (date, source of times, seed, solver status). Solver output is values; counts and totals over it are formulas such as `COUNTIFS` and `SUMIFS`. Analysis of the sweep table itself follows `docs-and-data:analysing-tabular-data`.

## Map outputs

Build with `stack-web:building-map-apps`. Show two synced panes or a toggle for before and after; colour by change (better, same, worse), draw assignment lines on hover or select only (hundreds of lines at once is unreadable), and add a filter for region and for changed sites. A guided walkthrough for executives follows `design-studio:presenting-guided-demos`.

## Explaining to non-technical stakeholders

- Lead with the decision and the cost of each option in their terms: sites, people, minutes.
- One impact table per option: "what changes for whom". Name the groups (field engineers, small sites, priority sites).
- Say what the rules forced. "The plan cannot cover these 12 sites because no eligible person is within the limit" is more useful than a score.
- State assumptions once: departure time, source of drive times, exceptions in force.
- Avoid solver words (feasible, gap, relaxation) in the main body; keep them in the run-info sheet.
