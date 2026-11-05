import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { analyze, burnRate, errorBudget, parseArgs, tierThreshold, TIERS } from '../../plugins/ops-and-sre/skills/defining-slos-and-alerts/scripts/burn-rate.mjs';

const SCRIPT = new URL('../../plugins/ops-and-sre/skills/defining-slos-and-alerts/scripts/burn-rate.mjs', import.meta.url).pathname;
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('error budget is the complement of the SLO', () => {
  close(errorBudget(99.9), 0.001);
  close(errorBudget(99), 0.01);
  assert.throws(() => errorBudget(100));
  assert.throws(() => errorBudget(0));
});

test('burn rate of 1 means spending exactly the budget', () => {
  close(burnRate(0.001, 99.9), 1);
  close(burnRate(0.0144, 99.9), 14.4);
});

test('standard thresholds for a 30 day window', () => {
  const t = Object.fromEntries(TIERS.map((x) => [x.name, tierThreshold(x, 30)]));
  close(t['page-fast'], 14.4);
  close(t['page-slow'], 6);
  close(t['ticket-day'], 3);
  close(t['ticket-slow'], 1);
});

test('thresholds scale with the window', () => {
  close(tierThreshold(TIERS[0], 7), 0.02 * 7 * 24);
});

test('budget consumed and time to exhaustion', () => {
  const r = analyze({ slo: 99.9, windowDays: 30, errorRatio: 0.0144, lookbackHours: 1 });
  close(r.burnRate, 14.4);
  close(r.budgetConsumedFraction, 0.02);
  close(r.hoursToExhaustion, 50);
});

test('remaining budget shortens time to exhaustion', () => {
  const r = analyze({ slo: 99.9, errorRatio: 0.002, budgetRemaining: 0.5 });
  close(r.hoursToExhaustion, (720 * 0.5) / 2);
});

test('zero errors never exhausts', () => {
  const r = analyze({ slo: 99.9, errorRatio: 0 });
  assert.equal(r.hoursToExhaustion, null);
});

test('a tier fires only when both windows exceed the threshold', () => {
  const both = analyze({ slo: 99.9, ratios: { '1h': 0.02, '5m': 0.02 } });
  assert.equal(both.tiers[0].fires, true);
  const shortRecovered = analyze({ slo: 99.9, ratios: { '1h': 0.02, '5m': 0.0005 } });
  assert.equal(shortRecovered.tiers[0].fires, false);
  const missing = analyze({ slo: 99.9, ratios: { '1h': 0.02 } });
  assert.equal(missing.tiers[0].fires, null);
});

test('parseArgs derives the ratio from counts and rejects bad input', () => {
  const o = parseArgs(['--slo', '99.5', '--bad', '5', '--total', '1000']);
  close(o.errorRatio, 0.005);
  assert.throws(() => parseArgs(['--bad', '1', '--total', '10']));
  assert.throws(() => parseArgs(['--slo', '99.9', '--bad', '11', '--total', '10']));
  assert.throws(() => parseArgs(['--slo', '99.9', '--nope', '1']));
  assert.throws(() => parseArgs(['--slo', '99.9', '--error-ratio', '2']));
});

test('cli prints a report and exits 2 on bad input', () => {
  const ok = spawnSync('node', [SCRIPT, '--slo', '99.9', '--error-ratio', '0.0144', '--lookback-hours', '1', '--json']);
  assert.equal(ok.status, 0);
  close(JSON.parse(ok.stdout).burnRate, 14.4);
  const bad = spawnSync('node', [SCRIPT]);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr.toString(), /--slo is required/);
});
