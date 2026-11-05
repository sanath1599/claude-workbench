#!/usr/bin/env node
// Error budget and multi-window burn-rate calculator. Node 18+, no dependencies.
// Usage: node burn-rate.mjs --slo 99.9 [--window-days 30] (--error-ratio 0.004 | --bad 40 --total 10000)
//        [--lookback-hours 1] [--budget-remaining 0.8] [--ratio-1h 0.02 --ratio-5m 0.03 ...] [--json]
import { fileURLToPath } from 'node:url';

export const HOUR = 1;
// Tiers from the multi-window, multi-burn-rate approach in the Google SRE Workbook.
// budgetPct is the share of the whole window's budget spent when the alert fires.
export const TIERS = [
  { name: 'page-fast', severity: 'page', longH: 1, shortH: 5 / 60, budgetPct: 0.02, longKey: '1h', shortKey: '5m' },
  { name: 'page-slow', severity: 'page', longH: 6, shortH: 0.5, budgetPct: 0.05, longKey: '6h', shortKey: '30m' },
  { name: 'ticket-day', severity: 'ticket', longH: 24, shortH: 2, budgetPct: 0.1, longKey: '1d', shortKey: '2h' },
  { name: 'ticket-slow', severity: 'ticket', longH: 72, shortH: 6, budgetPct: 0.1, longKey: '3d', shortKey: '6h' },
];

export function errorBudget(sloPct) {
  if (!(sloPct > 0 && sloPct < 100)) throw new Error('slo must be between 0 and 100 (exclusive), e.g. 99.9');
  return (100 - sloPct) / 100;
}

export function burnRate(errorRatio, sloPct) {
  return errorRatio / errorBudget(sloPct);
}

// Burn rate at which the tier's budget share is spent inside its long window.
export function tierThreshold(tier, windowDays) {
  return (tier.budgetPct * windowDays * 24) / tier.longH;
}

export function analyze({ slo, windowDays = 30, errorRatio, lookbackHours, budgetRemaining = 1, ratios = {} }) {
  const budget = errorBudget(slo);
  const windowHours = windowDays * 24;
  const lookback = lookbackHours ?? windowHours;
  const rate = errorRatio === undefined ? undefined : burnRate(errorRatio, slo);
  const out = { slo, windowDays, errorBudgetRatio: budget, lookbackHours: lookback };
  if (rate !== undefined) {
    out.errorRatio = errorRatio;
    out.burnRate = rate;
    out.budgetConsumedFraction = (rate * lookback) / windowHours;
    out.hoursToExhaustion = rate > 0 ? (windowHours * budgetRemaining) / rate : null;
    out.allowedDowntimeMinutesPerWindow = windowHours * 60 * budget;
  }
  out.tiers = TIERS.map((t) => {
    const threshold = tierThreshold(t, windowDays);
    const longRatio = ratios[t.longKey];
    const shortRatio = ratios[t.shortKey];
    const have = longRatio !== undefined && shortRatio !== undefined;
    const longBurn = have ? burnRate(longRatio, slo) : null;
    const shortBurn = have ? burnRate(shortRatio, slo) : null;
    return {
      name: t.name, severity: t.severity, longWindow: t.longKey, shortWindow: t.shortKey,
      threshold, longBurn, shortBurn,
      fires: have ? longBurn >= threshold && shortBurn >= threshold : null,
    };
  });
  return out;
}

function fmtHours(h) {
  if (h === null || h === undefined) return 'never (no errors)';
  if (h < 1) return `${(h * 60).toFixed(1)} minutes`;
  if (h < 48) return `${h.toFixed(1)} hours`;
  return `${(h / 24).toFixed(1)} days`;
}

export function parseArgs(argv) {
  const o = { ratios: {} };
  const num = (k, v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`--${k} needs a number, got "${v}"`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`);
    const k = a.slice(2);
    if (k === 'json') { o.json = true; continue; }
    const v = argv[++i];
    if (v === undefined) throw new Error(`--${k} needs a value`);
    if (k === 'slo') o.slo = num(k, v);
    else if (k === 'window-days') o.windowDays = num(k, v);
    else if (k === 'error-ratio') o.errorRatio = num(k, v);
    else if (k === 'bad') o.bad = num(k, v);
    else if (k === 'total') o.total = num(k, v);
    else if (k === 'lookback-hours') o.lookbackHours = num(k, v);
    else if (k === 'budget-remaining') o.budgetRemaining = num(k, v);
    else if (k.startsWith('ratio-')) o.ratios[k.slice(6)] = num(k, v);
    else throw new Error(`unknown flag --${k}`);
  }
  if (o.slo === undefined) throw new Error('--slo is required, e.g. --slo 99.9');
  if (o.bad !== undefined || o.total !== undefined) {
    if (!(o.total > 0) || o.bad === undefined || o.bad < 0 || o.bad > o.total) throw new Error('--bad and --total must satisfy 0 <= bad <= total, total > 0');
    if (o.errorRatio !== undefined) throw new Error('give --error-ratio or --bad/--total, not both');
    o.errorRatio = o.bad / o.total;
  }
  if (o.errorRatio !== undefined && (o.errorRatio < 0 || o.errorRatio > 1)) throw new Error('error ratio must be between 0 and 1');
  if (o.budgetRemaining !== undefined && (o.budgetRemaining < 0 || o.budgetRemaining > 1)) throw new Error('--budget-remaining must be between 0 and 1');
  return o;
}

export function render(r) {
  const L = [];
  L.push(`SLO ${r.slo}% over ${r.windowDays} days: error budget ${(r.errorBudgetRatio * 100).toFixed(4)}% (${r.allowedDowntimeMinutesPerWindow?.toFixed(1) ?? (r.windowDays * 1440 * r.errorBudgetRatio).toFixed(1)} minutes of full outage per window)`);
  if (r.burnRate !== undefined) {
    L.push(`Observed error ratio ${(r.errorRatio * 100).toFixed(4)}% over ${fmtHours(r.lookbackHours)}`);
    L.push(`Burn rate: ${r.burnRate.toFixed(2)}x (1.0x spends exactly the budget by the end of the window)`);
    L.push(`Budget consumed in that lookback: ${(r.budgetConsumedFraction * 100).toFixed(2)}% of the window budget`);
    L.push(`Time to exhaustion at this rate: ${fmtHours(r.hoursToExhaustion)}`);
  }
  L.push('Multi-window thresholds:');
  for (const t of r.tiers) {
    const state = t.fires === null ? 'no data' : t.fires ? 'FIRES' : 'quiet';
    const obs = t.fires === null ? '' : ` (long ${t.longBurn.toFixed(2)}x, short ${t.shortBurn.toFixed(2)}x)`;
    L.push(`  ${t.severity.padEnd(6)} ${t.name.padEnd(12)} burn >= ${t.threshold.toFixed(2)}x on ${t.longWindow} and ${t.shortWindow}: ${state}${obs}`);
  }
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const o = parseArgs(process.argv.slice(2));
    const r = analyze(o);
    console.log(o.json ? JSON.stringify(r, null, 2) : render(r));
  } catch (e) {
    console.error(`burn-rate: ${e.message}`);
    process.exit(2);
  }
}
