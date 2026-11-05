#!/usr/bin/env node
// Back-of-envelope estimator: QPS, storage growth, bandwidth, rough monthly cost.
// Usage: node estimate.mjs --dau 20000 --requests-per-user 30 --response-kb 8
//        node estimate.mjs --file inputs.json [--json]
// Units: decimal (1 GB = 1e9 bytes, 1 KB = 1e3 bytes). Prices are placeholders: override them.

export const DEFAULTS = {
  dau: 1000,
  requestsPerUser: 20, // requests per user per day
  peakFactor: 3, // peak QPS over average QPS
  readRatio: 0.9, // share of requests that only read
  recordsPerWrite: 1,
  recordKb: 2, // stored size of one record
  indexOverhead: 0.3, // extra storage for indexes, as a fraction
  replication: 2, // copies kept (primary + replicas/backups)
  retentionMonths: 12,
  requestKb: 1,
  responseKb: 10,
  qpsPerInstance: 200,
  priceStorageGbMonth: 0.15,
  priceEgressGb: 0.09,
  pricePerMillionRequests: 0.4,
  priceInstanceMonth: 25,
};

const SECONDS_PER_DAY = 86400;
const DAYS_PER_MONTH = 30;

const ALIASES = {
  dau: "dau",
  "requests-per-user": "requestsPerUser",
  "peak-factor": "peakFactor",
  "read-ratio": "readRatio",
  "records-per-write": "recordsPerWrite",
  "record-kb": "recordKb",
  "index-overhead": "indexOverhead",
  replication: "replication",
  "retention-months": "retentionMonths",
  "request-kb": "requestKb",
  "response-kb": "responseKb",
  "qps-per-instance": "qpsPerInstance",
  "price-storage-gb-month": "priceStorageGbMonth",
  "price-egress-gb": "priceEgressGb",
  "price-per-million-requests": "pricePerMillionRequests",
  "price-instance-month": "priceInstanceMonth",
};

export function validate(input) {
  const out = { ...DEFAULTS, ...input };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      throw new Error(`Invalid value for ${k}: ${v} (expected a non-negative number)`);
    }
  }
  if (out.readRatio > 1) throw new Error("readRatio must be between 0 and 1");
  if (out.qpsPerInstance <= 0) throw new Error("qpsPerInstance must be greater than 0");
  if (out.peakFactor < 1) throw new Error("peakFactor must be at least 1");
  return out;
}

export function estimate(input = {}) {
  const c = validate(input);
  const requestsPerDay = c.dau * c.requestsPerUser;
  const avgQps = requestsPerDay / SECONDS_PER_DAY;
  const peakQps = avgQps * c.peakFactor;
  const writeShare = 1 - c.readRatio;
  const writesPerDay = requestsPerDay * writeShare;
  const avgWriteQps = writesPerDay / SECONDS_PER_DAY;
  const peakWriteQps = avgWriteQps * c.peakFactor;

  const newRecordsPerDay = writesPerDay * c.recordsPerWrite;
  const bytesPerRecordStored = c.recordKb * 1e3 * (1 + c.indexOverhead) * c.replication;
  const storageGbPerDay = (newRecordsPerDay * bytesPerRecordStored) / 1e9;
  const storageGbPerMonth = storageGbPerDay * DAYS_PER_MONTH;
  const storageGbAtRetention = storageGbPerMonth * c.retentionMonths;

  const egressGbPerMonth = (requestsPerDay * DAYS_PER_MONTH * c.responseKb * 1e3) / 1e9;
  const ingressGbPerMonth = (requestsPerDay * DAYS_PER_MONTH * c.requestKb * 1e3) / 1e9;
  const peakEgressMbps = (peakQps * c.responseKb * 1e3 * 8) / 1e6;

  const instances = Math.max(1, Math.ceil(peakQps / c.qpsPerInstance));
  const cost = {
    storage: storageGbAtRetention * c.priceStorageGbMonth,
    egress: egressGbPerMonth * c.priceEgressGb,
    requests: ((requestsPerDay * DAYS_PER_MONTH) / 1e6) * c.pricePerMillionRequests,
    compute: instances * c.priceInstanceMonth,
  };
  cost.total = cost.storage + cost.egress + cost.requests + cost.compute;

  return {
    inputs: c,
    traffic: { requestsPerDay, avgQps, peakQps, avgWriteQps, peakWriteQps },
    storage: { newRecordsPerDay, storageGbPerDay, storageGbPerMonth, storageGbAtRetention },
    bandwidth: { egressGbPerMonth, ingressGbPerMonth, peakEgressMbps },
    capacity: { instances },
    monthlyCostUsd: cost,
  };
}

const fmt = (n) => {
  if (n === 0) return "0";
  if (Math.abs(n) >= 100) return Math.round(n).toLocaleString("en-US");
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toPrecision(2);
};

export function renderTable(r) {
  const rows = [
    ["Requests per day", fmt(r.traffic.requestsPerDay), ""],
    ["Average QPS", fmt(r.traffic.avgQps), "req/s"],
    ["Peak QPS", fmt(r.traffic.peakQps), `x${r.inputs.peakFactor} average`],
    ["Peak write QPS", fmt(r.traffic.peakWriteQps), `${fmt((1 - r.inputs.readRatio) * 100)}% of requests`],
    ["New records per day", fmt(r.storage.newRecordsPerDay), ""],
    ["Storage growth per month", fmt(r.storage.storageGbPerMonth), "GB (with indexes and replicas)"],
    [`Storage at ${r.inputs.retentionMonths} months`, fmt(r.storage.storageGbAtRetention), "GB"],
    ["Egress per month", fmt(r.bandwidth.egressGbPerMonth), "GB"],
    ["Ingress per month", fmt(r.bandwidth.ingressGbPerMonth), "GB"],
    ["Peak egress", fmt(r.bandwidth.peakEgressMbps), "Mbit/s"],
    ["App instances at peak", String(r.capacity.instances), `${r.inputs.qpsPerInstance} QPS each`],
    ["Cost: storage", fmt(r.monthlyCostUsd.storage), "USD/month"],
    ["Cost: egress", fmt(r.monthlyCostUsd.egress), "USD/month"],
    ["Cost: requests", fmt(r.monthlyCostUsd.requests), "USD/month"],
    ["Cost: compute", fmt(r.monthlyCostUsd.compute), "USD/month"],
    ["Cost: total (rough)", fmt(r.monthlyCostUsd.total), "USD/month"],
  ];
  const w0 = Math.max(...rows.map((x) => x[0].length));
  const w1 = Math.max(...rows.map((x) => x[1].length));
  return rows.map(([a, b, c]) => `${a.padEnd(w0)}  ${b.padStart(w1)}  ${c}`.trimEnd()).join("\n");
}

export function parseArgs(argv) {
  const input = {};
  const opts = { json: false, file: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "--file") opts.file = argv[++i];
    else if (a.startsWith("--")) {
      const key = ALIASES[a.slice(2)];
      if (!key) throw new Error(`Unknown flag ${a}`);
      const raw = argv[++i];
      const n = Number(raw);
      if (raw === undefined || Number.isNaN(n)) throw new Error(`Flag ${a} needs a number, got ${raw}`);
      input[key] = n;
    } else throw new Error(`Unexpected argument ${a}`);
  }
  return { input, opts };
}

async function main() {
  const { readFileSync } = await import("node:fs");
  try {
    const { input, opts } = parseArgs(process.argv.slice(2));
    const fromFile = opts.file ? JSON.parse(readFileSync(opts.file, "utf8")) : {};
    const result = estimate({ ...fromFile, ...input });
    console.log(opts.json ? JSON.stringify(result, null, 2) : renderTable(result));
  } catch (e) {
    console.error(`estimate: ${e.message}`);
    process.exit(2);
  }
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
