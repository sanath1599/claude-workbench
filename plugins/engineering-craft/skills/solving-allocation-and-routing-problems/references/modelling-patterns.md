# Modelling patterns

Each pattern is a compact OR-Tools sketch (`from ortools.sat.python import cp_model`, `from ortools.graph.python import min_cost_flow`, `from ortools.constraint_solver import pywrapcp, routing_enums_pb2`). Names are generic: `people`, `sites`, `minutes[p][s]` (integer travel minutes). Read the current OR-Tools docs for signatures before extending. Every pattern ends with the independent checker; none of these results is trusted until it passes.

## 1. Assignment with hard eligibility

One person per site, each person up to `cap[p]` sites, only eligible pairs, minimise total travel.

```python
m = cp_model.CpModel()
x = {(p, s): m.new_bool_var(f"x_{p}_{s}")
     for p in people for s in sites if eligible(p, s)}   # region, skill, gender rules live in eligible()
for s in sites:
    m.add(sum(x[p, s] for p in people if (p, s) in x) == 1)
for p in people:
    m.add(sum(x[p, s] for s in sites if (p, s) in x) <= cap[p])
m.minimize(sum(minutes[p][s] * v for (p, s), v in x.items()))
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 60
solver.parameters.relative_gap_limit = 0.01
status = solver.solve(m)   # report status name and gap, see the skill
```

Filter ineligible pairs out of the variable set instead of adding constraints: the model is smaller and the rule cannot be violated by construction.

## 2. Pairing within a distance limit

Two people share a site pair only if each can reach both within `limit` minutes.

```python
pair = {}
for s in sites:
    for p, q in itertools.combinations(people, 2):
        if minutes[p][s] <= limit and minutes[q][s] <= limit:
            pair[p, q, s] = m.new_bool_var(f"pair_{p}_{q}_{s}")
for s in shared_sites:   # sites that need two people
    m.add(sum(v for (p, q, t), v in pair.items() if t == s) == 1)
for p in people:
    m.add(sum(v for (a, b, t), v in pair.items() if p in (a, b)) <= pair_cap[p])
```

Count pairs with `combinations` only when the eligible set is small. For hundreds of people, pre-filter by the distance limit first, or model "person p works site s" and add `sum(...) == 2` for shared sites.

## 3. Capacity-balanced pools via min-cost flow

Supply nodes are people, demand nodes are pools or sites, arc cost is travel time, arc capacity is how many a person may send. Min-cost flow is integral and fast, so use it when the rules are only capacities and costs.

```python
mcf = min_cost_flow.SimpleMinCostFlow()
# nodes: people 0..P-1, pools P..P+K-1
for p in range(P):
    for k in range(K):
        if reach[p][k]:
            mcf.add_arc_with_capacity_and_unit_cost(p, P + k, cap[p], minutes[p][k])
for p in range(P):
    mcf.set_node_supply(p, supply[p])
for k in range(K):
    mcf.set_node_supply(P + k, -need[k])
status = mcf.solve()
assert status == mcf.OPTIMAL   # INFEASIBLE means total supply or reach cannot meet need: report which pools starve
flows = [(mcf.tail(a), mcf.head(a), mcf.flow(a)) for a in range(mcf.num_arcs()) if mcf.flow(a)]
```

Costs and capacities must be integers (use whole minutes). Balance pools by adding a convex cost per pool or by solving once per pool-size target and comparing.

## 4. Coverage (facility location)

Choose at most `k` locations so the most sites sit within `limit` minutes of one.

```python
open_ = {f: m.new_bool_var(f"open_{f}") for f in facilities}
cov = {s: m.new_bool_var(f"cov_{s}") for s in sites}
for s in sites:
    m.add(cov[s] <= sum(open_[f] for f in facilities if minutes[f][s] <= limit))
m.add(sum(open_.values()) <= k)
m.maximize(sum(weight[s] * cov[s] for s in sites))
```

Report the sites that lose coverage between two plans as a list, not only a count.

## 5. Vehicle routing basics

Use the routing library when people visit several stops in a day with time limits.

```python
manager = pywrapcp.RoutingIndexManager(len(matrix), n_vehicles, depot)
routing = pywrapcp.RoutingModel(manager)
cb = routing.RegisterTransitCallback(lambda i, j: matrix[manager.IndexToNode(i)][manager.IndexToNode(j)])
routing.SetArcCostEvaluatorOfAllVehicles(cb)
routing.AddDimension(cb, 0, max_day_minutes, True, "time")   # hard cap per route
params = pywrapcp.DefaultRoutingSearchParameters()
params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
params.time_limit.seconds = 30
solution = routing.SolveWithParameters(params)   # None means no feasible routes under the caps
```

Add service time to the transit callback, time windows with `CumulVar(...).SetRange`, and optional stops with `AddDisjunction(nodes, penalty)` so an infeasible stop is dropped and reported instead of failing the whole solve.

## 6. Fairness and workload caps

Cap the spread, not only the total, or the cheapest plan overloads one person.

```python
load = {p: sum(x[p, s] for s in sites if (p, s) in x) for p in people}
hi = m.new_int_var(0, len(sites), "max_load")
lo = m.new_int_var(0, len(sites), "min_load")
for p in people:
    m.add(load[p] <= hi)
    m.add(load[p] >= lo)
m.add(hi - lo <= max_spread)            # hard fairness rule from the owner
m.minimize(total_minutes + 100 * (hi - lo))   # or soft: a stated weight, never a hidden one
```

Total travel and worst individual travel conflict; show both in the sweep.

## 7. Gender or skill matching as hard constraints

Match in `eligible()` (pattern 1), never as a penalty. Penalties let the solver trade a rule away silently.

```python
def eligible(p, s):
    return (region[p] == region[s]                       # never across regions
            and required_skill[s] in skills[p]
            and (need_gender[s] is None or need_gender[s] == gender[p]))
unmatchable = [s for s in sites if not any(eligible(p, s) for p in people)]
# report unmatchable sites before solving: they are data or staffing problems, not solver problems
```

## 8. Exceptions list

Rules need documented exceptions. Keep them as data, not code branches.

```python
exceptions = [{"rule": "max_minutes", "site": "S4", "person": "P2", "reason": "approved by the owner"}]
def waived(rule, s, p):
    return any(e["rule"] == rule and e["site"] in (None, s) and e["person"] in (None, p) for e in exceptions)
# allow the pair in eligible(), and pass the same list to the checker so it reports the pair as waived, not clean
```

Every exception carries a reason and an approver. A plan with exceptions is reported as "valid with N waived rules", never as "valid".
