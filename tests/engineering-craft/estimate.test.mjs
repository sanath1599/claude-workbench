import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { estimate, parseArgs, renderTable } from "../../plugins/engineering-craft/skills/designing-systems/scripts/estimate.mjs";

const script = "plugins/engineering-craft/skills/designing-systems/scripts/estimate.mjs";

test("QPS math: 86400 requests per day is 1 average QPS", () => {
  const r = estimate({ dau: 86400, requestsPerUser: 1, peakFactor: 4 });
  assert.equal(r.traffic.avgQps, 1);
  assert.equal(r.traffic.peakQps, 4);
});

test("storage growth accounts for write share, indexes and replicas", () => {
  const r = estimate({ dau: 1000, requestsPerUser: 100, readRatio: 0.9, recordKb: 1, indexOverhead: 0, replication: 1 });
  // 100000 req/day, 10% writes = 10000 records of 1 KB = 10 MB/day
  assert.ok(Math.abs(r.storage.storageGbPerDay - 0.01) < 1e-9);
  assert.ok(Math.abs(r.storage.storageGbPerMonth - 0.3) < 1e-9);
});

test("bandwidth and peak Mbps", () => {
  const r = estimate({ dau: 86400, requestsPerUser: 1, peakFactor: 1, responseKb: 125 });
  // 1 QPS * 125 KB * 8 = 1 Mbit/s
  assert.ok(Math.abs(r.bandwidth.peakEgressMbps - 1) < 1e-9);
});

test("instances round up and are at least one", () => {
  assert.equal(estimate({ dau: 1, requestsPerUser: 1 }).capacity.instances, 1);
  const r = estimate({ dau: 86400, requestsPerUser: 1000, peakFactor: 1, qpsPerInstance: 300 });
  assert.equal(r.capacity.instances, Math.ceil(1000 / 300));
});

test("cost total is the sum of its parts", () => {
  const { monthlyCostUsd: c } = estimate({ dau: 5000 });
  assert.ok(Math.abs(c.total - (c.storage + c.egress + c.requests + c.compute)) < 1e-9);
});

test("rejects bad input", () => {
  assert.throws(() => estimate({ dau: -1 }), /Invalid value/);
  assert.throws(() => estimate({ readRatio: 2 }), /readRatio/);
  assert.throws(() => estimate({ qpsPerInstance: 0 }), /qpsPerInstance/);
  assert.throws(() => parseArgs(["--nope", "1"]), /Unknown flag/);
  assert.throws(() => parseArgs(["--dau", "abc"]), /needs a number/);
});

test("parseArgs maps flags to camelCase", () => {
  const { input, opts } = parseArgs(["--dau", "50", "--response-kb", "3", "--json"]);
  assert.deepEqual(input, { dau: 50, responseKb: 3 });
  assert.equal(opts.json, true);
});

test("table renders key rows", () => {
  const t = renderTable(estimate({ dau: 1000 }));
  assert.match(t, /Peak QPS/);
  assert.match(t, /Cost: total/);
});

test("CLI reads a JSON file and flags override it", () => {
  const dir = mkdtempSync(join(tmpdir(), "est-"));
  const f = join(dir, "in.json");
  writeFileSync(f, JSON.stringify({ dau: 86400, requestsPerUser: 1, peakFactor: 2 }));
  const out = execFileSync("node", [script, "--file", f, "--json", "--peak-factor", "5"], { encoding: "utf8" });
  assert.equal(JSON.parse(out).traffic.peakQps, 5);
});

test("CLI exits 2 on bad flag", () => {
  const r = spawnSync("node", [script, "--bogus", "1"], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Unknown flag/);
});
