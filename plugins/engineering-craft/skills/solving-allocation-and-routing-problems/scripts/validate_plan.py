#!/usr/bin/env python3
"""Independent rule checker for an allocation plan. Stdlib only.

Usage: python3 validate_plan.py PLAN.json RULES.json
Prints JSON {"ok", "violations", "waived", "checked"}; exit 1 on violations.

PLAN.json:
  {"people": {"P1": {"region": "N", "capacity": 3, "attrs": {"gender": "f"}}},
   "sites":  {"S1": {"region": "N", "demand": 1, "attrs": {"gender": "f"}}},
   "assignments": [{"site": "S1", "person": "P1", "minutes": 25}]}
RULES.json (all keys optional):
  {"max_minutes": 60, "default_capacity": 5, "same_region": true,
   "match_attributes": ["gender"], "require_coverage": true,
   "dedicated_sites": ["S9"],
   "exceptions": [{"rule": "max_minutes", "site": "S4", "person": "P2", "reason": "approved"}]}
"""
import json
import sys
from collections import defaultdict


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def check(plan, rules):
    people = plan.get("people", {})
    sites = plan.get("sites", {})
    assigns = plan.get("assignments", [])
    found = []

    def add(rule, site=None, person=None, detail=""):
        found.append({"rule": rule, "site": site, "person": person, "detail": detail})

    by_site = defaultdict(list)
    load_by_person = defaultdict(float)
    sites_by_person = defaultdict(set)
    for a in assigns:
        s, p = a.get("site"), a.get("person")
        if s not in sites:
            add("unknown_reference", s, p, "site not in plan.sites")
            continue
        if p not in people:
            add("unknown_reference", s, p, "person not in plan.people")
            continue
        by_site[s].append(a)
        load_by_person[p] += float(sites[s].get("demand", 1))
        sites_by_person[p].add(s)
        mins = a.get("minutes")
        limit = rules.get("max_minutes")
        if limit is not None:
            if mins is None:
                add("max_minutes", s, p, "no travel time supplied")
            elif mins > limit:
                add("max_minutes", s, p, f"{mins} > {limit} minutes")
        if rules.get("same_region", False) and sites[s].get("region") != people[p].get("region"):
            add("region", s, p, f"site {sites[s].get('region')} vs person {people[p].get('region')}")
        for attr in rules.get("match_attributes", []):
            want = sites[s].get("attrs", {}).get(attr)
            have = people[p].get("attrs", {}).get(attr)
            if want is not None and want != have:
                add("attribute_mismatch", s, p, f"{attr}: site {want} vs person {have}")

    default_cap = rules.get("default_capacity")
    for p, used in load_by_person.items():
        cap = people[p].get("capacity", default_cap)
        if cap is not None and used > cap:
            add("capacity", None, p, f"load {used:g} > capacity {cap:g}")

    if rules.get("require_coverage", True):
        for s in sites:
            if not by_site.get(s):
                add("unassigned_site", s, None, "no person assigned")

    for s in rules.get("dedicated_sites", []):
        staff = {a["person"] for a in by_site.get(s, [])}
        if len(staff) > 1:
            add("dedicated", s, None, f"{len(staff)} people on a dedicated site")
        for p in staff:
            if len(sites_by_person[p]) > 1:
                add("dedicated", s, p, "person also covers other sites")

    waivers = rules.get("exceptions", [])
    violations, waived = [], []
    for v in found:
        hit = next((w for w in waivers if w.get("rule") == v["rule"]
                    and w.get("site") in (None, v["site"])
                    and w.get("person") in (None, v["person"])), None)
        if hit:
            waived.append({**v, "reason": hit.get("reason", "")})
        else:
            violations.append(v)
    checked = {"sites": len(sites), "people": len(people), "assignments": len(assigns)}
    return {"ok": not violations, "violations": violations, "waived": waived, "checked": checked}


def main(argv):
    if len(argv) != 3:
        print("usage: validate_plan.py PLAN.json RULES.json", file=sys.stderr)
        return 2
    try:
        result = check(load(argv[1]), load(argv[2]))
    except (OSError, ValueError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 2
    print(json.dumps(result, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
