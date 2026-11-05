import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = "plugins/engineering-craft/skills/solving-allocation-and-routing-problems/scripts";
const tmp = mkdtempSync(join(tmpdir(), "alloc-"));
const put = (name, obj) => { const p = join(tmp, name); writeFileSync(p, typeof obj === "string" ? obj : JSON.stringify(obj)); return p; };
const py = (script, ...args) => spawnSync("python3", ["-I", join(dir, script), ...args], { encoding: "utf8" });

const people = {
  P1: { region: "N", capacity: 2, attrs: { gender: "f" } },
  P2: { region: "S", capacity: 1, attrs: { gender: "m" } },
};
const sites = {
  S1: { region: "N", attrs: { gender: "f" } },
  S2: { region: "N", attrs: { gender: "f" } },
  S3: { region: "S", attrs: { gender: "m" } },
};
const rules = { max_minutes: 60, same_region: true, match_attributes: ["gender"], dedicated_sites: ["S3"] };

test("validate_plan: clean plan passes with exit 0", () => {
  const plan = put("ok.json", { people, sites, assignments: [
    { site: "S1", person: "P1", minutes: 20 }, { site: "S2", person: "P1", minutes: 30 }, { site: "S3", person: "P2", minutes: 10 } ] });
  const r = py("validate_plan.py", plan, put("rules.json", rules));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).ok, true);
});

test("validate_plan: reports each broken rule and exits 1", () => {
  const plan = put("bad.json", { people, sites, assignments: [
    { site: "S1", person: "P1", minutes: 90 }, { site: "S2", person: "P2", minutes: 10 }, { site: "S3", person: "P2", minutes: 10 } ] });
  const r = py("validate_plan.py", plan, put("rules2.json", rules));
  assert.equal(r.status, 1);
  const kinds = new Set(JSON.parse(r.stdout).violations.map((v) => v.rule));
  for (const k of ["max_minutes", "region", "attribute_mismatch", "capacity", "dedicated"]) assert.ok(kinds.has(k), k);
});

test("validate_plan: unassigned site flagged, waiver moves it to waived", () => {
  const plan = put("gap.json", { people, sites, assignments: [
    { site: "S1", person: "P1", minutes: 20 }, { site: "S3", person: "P2", minutes: 10 } ] });
  const r = py("validate_plan.py", plan, put("rules3.json", rules));
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout).violations[0].rule, "unassigned_site");
  const w = py("validate_plan.py", plan, put("rules4.json", { ...rules, exceptions: [{ rule: "unassigned_site", site: "S2", reason: "approved" }] }));
  assert.equal(w.status, 0);
  assert.equal(JSON.parse(w.stdout).waived.length, 1);
});

test("sweep: runs grid, writes CSV, flags failures", () => {
  const solver = put("solver.py", "import sys,json\nm=int(sys.argv[1])\nif m>50: sys.exit(3)\nprint('log');print(json.dumps({'uncovered': 100-m}))\n");
  const out = join(tmp, "out.csv");
  const cfg = put("sweep.json", { command: ["python3", "-I", solver, "{m}"], grid: { m: [30, 40, 60] }, timeout: 20 });
  const r = py("sweep.py", cfg, "--out", out);
  assert.equal(r.status, 1);
  assert.deepEqual(JSON.parse(r.stdout), { runs: 3, failed: 1, out });
  const lines = readFileSync(out, "utf8").trim().split("\n");
  assert.equal(lines.length, 4);
  assert.match(lines[0], /m_uncovered/);
  assert.match(lines[1], /70.*ok/);
  assert.match(lines[3], /exit_3/);
});
