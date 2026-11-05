import { test } from "node:test";
import assert from "node:assert/strict";
import { main, parseArgs, candidateZones } from "../../plugins/stack-web/skills/adding-subdomains/scripts/cf-dns.mjs";

const TOKEN = "tok_SECRET_123";
const ZONE = { id: "z1", name: "example.test" };

function mock(records = []) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method || "GET";
    calls.push({ method, path: u.pathname, search: u.search, body: init.body ? JSON.parse(init.body) : undefined, auth: init.headers?.Authorization });
    const ok = (result) => ({ ok: true, status: 200, json: async () => ({ success: true, result }) });
    if (u.pathname === "/client/v4/zones") return ok(u.searchParams.get("name") === ZONE.name ? [ZONE] : []);
    if (u.pathname.endsWith("/dns_records") && method === "GET") {
      const n = u.searchParams.get("name");
      return ok(n ? records.filter((r) => r.name === n) : records);
    }
    if (method === "POST") return ok({ id: "new1" });
    if (method === "PATCH") return ok({ id: "r1" });
    return { ok: false, status: 404, json: async () => ({ success: false, errors: [{ code: 1, message: `bad ${TOKEN}` }] }) };
  };
  return { calls, fetchImpl };
}
const run = async (argv, m, env = { CF_API_TOKEN: TOKEN }) => {
  const out = [];
  const code = await main(argv, { fetchImpl: m.fetchImpl, env, log: (s) => out.push(s) });
  return { code, out: out.join("\n") };
};
const writes = (m) => m.calls.filter((c) => c.method !== "GET");

test("parseArgs: dry run is the default, --apply turns it off, --dry-run wins", () => {
  assert.equal(parseArgs(["upsert", "a"]).flags.dryRun, true);
  assert.equal(parseArgs(["upsert", "a", "--apply"]).flags.dryRun, false);
  assert.equal(parseArgs(["upsert", "a", "--apply", "--dry-run"]).flags.dryRun, true);
  assert.equal(parseArgs(["upsert", "a", "--proxied"]).flags.proxied, true);
  assert.throws(() => parseArgs(["--nope"]));
});

test("candidateZones walks from the fqdn up to the apex", () => {
  assert.deepEqual(candidateZones("careers.acme.example.test"), ["careers.acme.example.test", "acme.example.test", "example.test"]);
});

test("zone finds the zone for a subdomain", async () => {
  const m = mock();
  const r = await run(["zone", "app.example.test"], m);
  assert.equal(r.code, 0);
  assert.match(r.out, /zone example\.test id z1/);
  assert.equal(m.calls[0].auth, `Bearer ${TOKEN}`);
});

test("list prints records and expands a short name", async () => {
  const m = mock([{ id: "r1", type: "CNAME", name: "app.example.test", content: "t.vercel-dns.test", proxied: false }]);
  const r = await run(["list", "example.test", "app"], m);
  assert.equal(r.code, 0);
  assert.match(r.out, /CNAME app\.example\.test -> t\.vercel-dns\.test proxied=no/);
});

test("upsert is a dry run by default and writes nothing", async () => {
  const m = mock();
  const r = await run(["upsert", "app.example.test", "CNAME", "t.vercel-dns.test"], m);
  assert.equal(r.code, 0);
  assert.match(r.out, /DRY RUN, would create/);
  assert.equal(writes(m).length, 0);
});

test("upsert --apply creates a DNS-only CNAME", async () => {
  const m = mock();
  const r = await run(["upsert", "app.example.test", "CNAME", "t.vercel-dns.test", "--apply"], m);
  assert.equal(r.code, 0);
  const [w] = writes(m);
  assert.equal(w.method, "POST");
  assert.equal(w.body.proxied, false);
  assert.equal(w.body.ttl, 1);
  assert.equal(w.body.content, "t.vercel-dns.test");
});

test("upsert --apply patches a changed record and skips an identical one", async () => {
  const rec = { id: "r1", type: "CNAME", name: "app.example.test", content: "old.test", proxied: false };
  const m = mock([rec]);
  const r = await run(["upsert", "app.example.test", "CNAME", "new.test", "--apply"], m);
  assert.equal(r.code, 0);
  assert.equal(writes(m)[0].method, "PATCH");
  assert.match(writes(m)[0].path, /dns_records\/r1$/);
  const m2 = mock([{ ...rec, content: "new.test" }]);
  const r2 = await run(["upsert", "app.example.test", "CNAME", "new.test", "--apply"], m2);
  assert.match(r2.out, /unchanged/);
  assert.equal(writes(m2).length, 0);
});

test("upsert refuses to add a CNAME next to an A record", async () => {
  const m = mock([{ id: "r9", type: "A", name: "app.example.test", content: "203.0.113.5", proxied: false }]);
  const r = await run(["upsert", "app.example.test", "CNAME", "t.test", "--apply"], m);
  assert.equal(r.code, 1);
  assert.match(r.out, /Refusing/);
  assert.equal(writes(m).length, 0);
});

test("upsert validates input", async () => {
  const m = mock();
  assert.equal((await run(["upsert", "app.example.test", "A", "not-an-ip"], m)).code, 2);
  assert.equal((await run(["upsert", "app.example.test", "TXT", "x"], m)).code, 2);
  assert.equal((await run(["upsert", "bad host", "CNAME", "t.test"], m)).code, 2);
});

test("missing token fails before any request", async () => {
  const m = mock();
  const r = await run(["zone", "example.test"], m, {});
  assert.equal(r.code, 2);
  assert.match(r.out, /CF_API_TOKEN is not set/);
  assert.equal(m.calls.length, 0);
});

test("the token never appears in output, even when the API echoes it", async () => {
  const m = mock();
  const r = await run(["upsert", "app.example.test", "CNAME", "t.test", "--apply", "--bogus"], m);
  assert.ok(!r.out.includes(TOKEN));
  const failing = { calls: [], fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ success: false, errors: [{ code: 9109, message: `denied ${TOKEN}` }] }) }) };
  const r2 = await run(["zone", "example.test"], failing);
  assert.equal(r2.code, 2);
  assert.ok(!r2.out.includes(TOKEN));
  assert.match(r2.out, /\[redacted\]/);
});

test("unknown zone reports a clear error", async () => {
  const r = await run(["zone", "nope.invalid"], mock());
  assert.equal(r.code, 2);
  assert.match(r.out, /No Cloudflare zone/);
});
