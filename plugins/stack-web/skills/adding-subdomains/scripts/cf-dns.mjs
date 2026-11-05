#!/usr/bin/env node
// Cloudflare DNS helper. Node 18+, no dependencies.
//   node cf-dns.mjs zone <domain>
//   node cf-dns.mjs list <domain> [name]
//   node cf-dns.mjs upsert <fqdn> CNAME|A <target> [--proxied] [--apply]
// The token comes from CF_API_TOKEN and is never printed. upsert is a dry run unless --apply is given.
// Set CF_ZONE_ID to skip the zone lookup (then the token needs only Zone:DNS:Edit).

const API = "https://api.cloudflare.com/client/v4";

export function parseArgs(argv) {
  const flags = { proxied: false, apply: false, dryRun: undefined };
  const pos = [];
  for (const a of argv) {
    if (a === "--proxied") flags.proxied = true;
    else if (a === "--apply") flags.apply = true;
    else if (a === "--dry-run") flags.dryRun = true;
    else if (a.startsWith("--")) throw new Error(`Unknown flag ${a}`);
    else pos.push(a);
  }
  // Dry run is the default. --apply turns it off; an explicit --dry-run wins over --apply.
  flags.dryRun = flags.dryRun === true ? true : !flags.apply;
  return { cmd: pos[0], args: pos.slice(1), flags };
}

const HOST_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export function candidateZones(fqdn) {
  const labels = fqdn.toLowerCase().replace(/\.$/, "").split(".");
  const out = [];
  for (let i = 0; i <= labels.length - 2; i++) out.push(labels.slice(i).join("."));
  return out; // longest first, down to the two-label apex
}

export async function main(argv, { fetchImpl = globalThis.fetch, env = process.env, log = console.log } = {}) {
  const token = env.CF_API_TOKEN;
  const redact = (s) => (token ? String(s).split(token).join("[redacted]") : String(s));

  async function cf(method, path, body) {
    const res = await fetchImpl(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json;
    try { json = await res.json(); } catch { json = null; }
    if (!res.ok || !json || json.success === false) {
      const msg = json?.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") || `HTTP ${res.status}`;
      throw new Error(redact(`Cloudflare ${method} ${path} failed: ${msg}`));
    }
    return json.result;
  }

  async function findZone(name) {
    if (env.CF_ZONE_ID) return { id: env.CF_ZONE_ID, name };
    for (const cand of candidateZones(name)) {
      const r = await cf("GET", `/zones?name=${encodeURIComponent(cand)}`);
      if (r.length) return { id: r[0].id, name: r[0].name };
    }
    throw new Error(`No Cloudflare zone found for ${name}. Check the token's zone scope.`);
  }

  const show = (r) => `${r.type} ${r.name} -> ${r.content} proxied=${r.proxied ? "yes" : "no"}`;

  try {
    const { cmd, args, flags } = parseArgs(argv);
    if (!token) throw new Error("CF_API_TOKEN is not set. Export it in your shell; do not paste it into chat.");

    if (cmd === "zone") {
      if (!args[0]) throw new Error("Usage: zone <domain>");
      const z = await findZone(args[0]);
      log(`zone ${z.name} id ${z.id}`);
      return 0;
    }

    if (cmd === "list") {
      if (!args[0]) throw new Error("Usage: list <domain> [name]");
      const z = await findZone(args[0]);
      const q = args[1] ? `?name=${encodeURIComponent(args[1].includes(".") ? args[1] : `${args[1]}.${z.name}`)}` : "?per_page=100";
      const recs = await cf("GET", `/zones/${z.id}/dns_records${q}`);
      if (!recs.length) log("no records");
      for (const r of recs) log(`${r.id} ${show(r)}`);
      return 0;
    }

    if (cmd === "upsert") {
      const [fqdnRaw, typeRaw, target] = args;
      if (!fqdnRaw || !typeRaw || !target) throw new Error("Usage: upsert <fqdn> CNAME|A <target> [--proxied] [--apply]");
      const fqdn = fqdnRaw.toLowerCase().replace(/\.$/, "");
      const type = typeRaw.toUpperCase();
      if (!HOST_RE.test(fqdn)) throw new Error(`Not a valid hostname: ${fqdnRaw}`);
      if (type !== "CNAME" && type !== "A") throw new Error("Type must be CNAME or A");
      if (type === "A" && !IPV4_RE.test(target)) throw new Error("A target must be an IPv4 address");
      if (type === "CNAME" && !HOST_RE.test(target.replace(/\.$/, ""))) throw new Error("CNAME target must be a hostname");
      const content = type === "CNAME" ? target.replace(/\.$/, "") : target;

      const z = await findZone(fqdn);
      const existing = await cf("GET", `/zones/${z.id}/dns_records?name=${encodeURIComponent(fqdn)}`);
      const clash = existing.filter((r) => ["A", "AAAA", "CNAME"].includes(r.type) && r.type !== type);
      if (clash.length) {
        log(`Refusing: ${fqdn} already has ${clash.map(show).join("; ")}. A CNAME cannot coexist with A/AAAA. Remove it by hand after the owner agrees.`);
        return 1;
      }
      const same = existing.find((r) => r.type === type);
      const body = { type, name: fqdn, content, ttl: 1, proxied: flags.proxied, comment: "managed by cf-dns" };

      let plan;
      if (!same) plan = { action: "create", method: "POST", path: `/zones/${z.id}/dns_records` };
      else if (same.content === content && Boolean(same.proxied) === flags.proxied) {
        log(`unchanged: ${show(same)}`);
        return 0;
      } else plan = { action: "update", method: "PATCH", path: `/zones/${z.id}/dns_records/${same.id}` };

      if (same) log(`current: ${show(same)}`);
      log(`${flags.dryRun ? "DRY RUN, would" : "will"} ${plan.action}: ${show(body)}`);
      if (flags.dryRun) {
        log("Nothing changed. Re-run with --apply after the owner approves.");
        return 0;
      }
      const r = await cf(plan.method, plan.path, body);
      log(`done: ${plan.action}d ${r?.id ?? ""}`.trim());
      return 0;
    }

    throw new Error("Commands: zone <domain> | list <domain> [name] | upsert <fqdn> CNAME|A <target> [--proxied] [--apply]");
  } catch (e) {
    log(`error: ${redact(e.message)}`);
    return 2;
  }
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then((c) => process.exit(c));
}
