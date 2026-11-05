#!/usr/bin/env node
// Studio: a two-way bridge between a browser page and the running Claude Code session.
// Node 18+, no dependencies. Subcommands: start, push, wait, tail, export, stop.
//   node studio.mjs start --dir .workbench-studio [--port 0] [--no-open]
//   node studio.mjs push --dir D --kind questions|choices|mock|plan|message|done --file F [--title T] [--screens "A,B"] [--asset F]...
//   node studio.mjs wait --dir D [--after N] [--timeout S]      exit 0 with one JSON line, 2 on timeout
//   node studio.mjs tail --dir D [--after N]                    one JSON line per new reply, forever
//   node studio.mjs export --dir D --to docs/intake             answers.json, choices.json, approval.json
//   node studio.mjs stop --dir D
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProfile, renderTokens } from '../../../scripts/lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const APP_FILE = resolve(here, '..', 'assets', 'studio.html');
export const MAX_REPLY_BYTES = 256 * 1024;
export const MAX_PUSH_BYTES = 24 * 1024 * 1024;
export const PUSH_KINDS = ['questions', 'choices', 'mock', 'plan', 'message', 'done'];
const MIME = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

// ---------- pure helpers ----------
export function parseArgs(argv) {
  const o = { _: [], asset: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (k === 'no-open') o.noOpen = true;
      else if (k === 'asset') o.asset.push(argv[++i]);
      else o[k] = argv[++i];
    } else o._.push(a);
  }
  return o;
}
export function isLocalHost(h) { return typeof h === 'string' && /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(h); }
// No Origin (CLI, same-origin navigation) passes; any Origin present must be local http.
export function isLocalOrigin(origin) {
  if (origin === undefined || origin === '') return true;
  try { const u = new URL(origin); return u.protocol === 'http:' && isLocalHost(u.host); } catch { return false; }
}
export function tokenOk(given, expected) {
  if (typeof given !== 'string' || given.length !== expected.length) return false;
  let d = 0;
  for (let i = 0; i < given.length; i++) d |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return d === 0;
}
export function readJsonl(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
export function safeName(name) { return basename(String(name)).replace(/[^A-Za-z0-9._-]/g, '_'); }
export function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }
export function atomicWrite(file, text) {
  mkdirSync(dirname(resolve(file)), { recursive: true });
  const tmp = `${resolve(file)}.${process.pid}.tmp`;
  writeFileSync(tmp, text); renameSync(tmp, resolve(file));
}
export const PAGE_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-src 'self'; base-uri 'none'; form-action 'none'";
export const ARTIFACT_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts";

// Build the decision files from the inbox, the outbox and the saved artifacts.
export function buildExport(inbox, outbox, artifactsDir) {
  const lastOf = (pred) => [...inbox].reverse().find(pred);
  const stepOf = (id) => outbox.find((s) => s.id === id);
  const answers = lastOf((e) => e.kind === 'answers');
  const choices = {};
  for (const e of inbox.filter((x) => x.kind === 'choice')) {
    const s = stepOf(e.stepId); choices[s ? (s.title || `step-${s.id}`) : `step-${e.stepId}`] = { ...e.data, stepId: e.stepId, at: e.ts };
  }
  const approvals = {};
  for (const target of ['mock', 'plan']) {
    const decisions = inbox.filter((e) => (e.kind === 'approve' || e.kind === 'changes') && stepOf(e.stepId)?.kind === target);
    const ok = [...decisions].reverse().find((e) => e.kind === 'approve');
    if (!decisions.length) continue;
    const step = ok ? stepOf(ok.stepId) : null;
    const file = step?.artifact ? join(artifactsDir, step.artifact) : null;
    approvals[target] = {
      decision: ok ? 'approve' : 'request_changes', approved_at: ok ? ok.ts : null,
      comments: ok?.data?.comments || '', screenNotes: ok?.data?.screenNotes || ok?.data?.sectionNotes || [],
      artifact: step?.artifact || null, sha256: file && existsSync(file) ? sha256(readFileSync(file)) : null,
      rounds: decisions.length,
    };
  }
  return { answers: answers ? { schema_version: 1, submitted_at: answers.ts, answers: answers.data?.answers ?? answers.data } : null, choices, approval: approvals };
}

// ---------- server ----------
export function startStudio({ dir, port = 0 }) {
  const root = resolve(dir), artifacts = join(root, 'artifacts');
  mkdirSync(artifacts, { recursive: true });
  const inboxF = join(root, 'inbox.jsonl'), outboxF = join(root, 'outbox.jsonl');
  const token = randomBytes(16).toString('hex');
  let inboxId = readJsonl(inboxF).reduce((m, e) => Math.max(m, e.id), 0);
  let outboxId = readJsonl(outboxF).reduce((m, e) => Math.max(m, e.id), 0);
  const clients = new Set();

  const send = (res, status, body, type = 'text/plain; charset=utf-8', extra = {}) => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
    res.end(body);
  };
  const readBody = (req, max) => new Promise((ok, bad) => {
    let n = 0; const c = [];
    req.on('data', (d) => { n += d.length; if (n > max) { bad(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else c.push(d); });
    req.on('end', () => ok(Buffer.concat(c).toString('utf8'))); req.on('error', bad);
  });
  const broadcast = (step) => { for (const r of clients) r.write(`event: step\nid: ${step.id}\ndata: ${JSON.stringify(step)}\n\n`); };

  const server = createServer(async (req, res) => {
    if (!isLocalHost(req.headers.host)) return send(res, 403, 'forbidden host');
    const url = new URL(req.url, 'http://127.0.0.1');
    const given = req.headers['x-studio-token'] || url.searchParams.get('t');
    if (!tokenOk(given, token)) return send(res, 401, 'missing or bad token');
    if (!isLocalOrigin(req.headers.origin)) return send(res, 403, 'forbidden origin');
    const p = url.pathname;
    try {
      if (req.method === 'GET' && p === '/') return send(res, 200, readFileSync(APP_FILE, 'utf8'), 'text/html; charset=utf-8', { 'Content-Security-Policy': PAGE_CSP });
      if (req.method === 'GET' && p === '/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.write(': connected\n\n');
        for (const s of readJsonl(outboxF)) res.write(`event: step\nid: ${s.id}\ndata: ${JSON.stringify(s)}\n\n`);
        clients.add(res);
        const beat = setInterval(() => res.write(': ping\n\n'), 15000);
        req.on('close', () => { clearInterval(beat); clients.delete(res); });
        return;
      }
      if (req.method === 'GET' && p.startsWith('/artifacts/')) {
        const name = safeName(decodeURIComponent(p.slice('/artifacts/'.length)));
        const f = join(artifacts, name);
        if (!existsSync(f)) return send(res, 404, 'not found');
        const ext = extname(name).toLowerCase();
        return send(res, 200, readFileSync(f), MIME[ext] || 'application/octet-stream', ext === '.html' ? { 'Content-Security-Policy': ARTIFACT_CSP } : {});
      }
      if (req.method === 'POST' && p === '/api/reply') {
        if (Number(req.headers['content-length'] || 0) > MAX_REPLY_BYTES) return send(res, 413, 'too large');
        let b; try { b = JSON.parse(await readBody(req, MAX_REPLY_BYTES)); } catch (e) { return e.status ? send(res, 413, 'too large') : send(res, 400, 'bad json'); }
        if (!b || typeof b.kind !== 'string' || (b.stepId !== undefined && typeof b.stepId !== 'number')) return send(res, 400, 'need kind and numeric stepId');
        const ev = { id: ++inboxId, ts: new Date().toISOString(), stepId: b.stepId ?? null, kind: b.kind, data: b.data ?? null };
        appendFileSync(inboxF, JSON.stringify(ev) + '\n');
        return send(res, 200, JSON.stringify({ ok: true, id: ev.id }), 'application/json');
      }
      if (req.method === 'POST' && p === '/api/push') {
        let b; try { b = JSON.parse(await readBody(req, MAX_PUSH_BYTES)); } catch (e) { return e.status ? send(res, 413, 'too large') : send(res, 400, 'bad json'); }
        if (!b || !PUSH_KINDS.includes(b.kind)) return send(res, 400, 'bad kind');
        const step = { id: ++outboxId, ts: new Date().toISOString(), kind: b.kind, title: String(b.title || ''), data: b.data ?? null };
        if (Array.isArray(b.screens)) step.screens = b.screens.map(String);
        for (const a of Array.isArray(b.assets) ? b.assets : []) writeFileSync(join(artifacts, safeName(a.name)), Buffer.from(String(a.b64), 'base64'));
        if (typeof b.html === 'string') { step.artifact = `step-${step.id}.html`; writeFileSync(join(artifacts, step.artifact), b.html); }
        appendFileSync(outboxF, JSON.stringify(step) + '\n');
        broadcast(step);
        return send(res, 200, JSON.stringify({ ok: true, id: step.id }), 'application/json');
      }
      send(res, 404, 'not found');
    } catch { send(res, 500, 'error'); }
  });
  return new Promise((ok, bad) => {
    server.once('error', bad);
    server.listen(port, '127.0.0.1', () => {
      const actual = server.address().port;
      const state = { port: actual, token, pid: process.pid, started_at: new Date().toISOString() };
      atomicWrite(join(root, 'state.json'), JSON.stringify(state, null, 2) + '\n');
      ok({ server, state, url: `http://127.0.0.1:${actual}/?t=${token}` });
    });
  });
}

// ---------- CLI ----------
function loadState(dir) {
  const f = join(resolve(dir), 'state.json');
  if (!existsSync(f)) throw new Error(`no studio running in ${dir} (state.json missing)`);
  return JSON.parse(readFileSync(f, 'utf8'));
}
async function post(dir, path, body) {
  const st = loadState(dir);
  const r = await fetch(`http://127.0.0.1:${st.port}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Studio-Token': st.token }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path} failed: ${r.status} ${await r.text()}`);
  return r.json();
}
export function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  try { const c = spawn(cmd, [url], { stdio: 'ignore', detached: true }); c.on('error', () => {}); c.unref(); } catch { /* no browser */ }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lastId = (dir) => readJsonl(join(resolve(dir), 'inbox.jsonl')).reduce((m, e) => Math.max(m, e.id), 0);

async function cli(argv) {
  const [cmd, ...rest] = argv; const a = parseArgs(rest);
  const dir = a.dir || '.workbench-studio';
  if (cmd === 'start') {
    const { url } = await startStudio({ dir, port: Number(a.port || 0) });
    console.log(`STUDIO_URL=${url}`);
    if (!a.noOpen) openBrowser(url); else console.log('Browser not opened (--no-open).');
    return;
  }
  if (cmd === 'push') {
    if (!PUSH_KINDS.includes(a.kind)) throw new Error(`--kind must be one of ${PUSH_KINDS.join(', ')}`);
    const body = { kind: a.kind, title: a.title || '' };
    if (a.file) {
      // Fill {{wb.*}} tokens from the owner's profile so the page never shows a raw placeholder.
      const text = renderTokens(readFileSync(a.file, 'utf8'), loadProfile().profile), ext = extname(a.file).toLowerCase();
      if (ext === '.html' || ext === '.htm') body.html = text;
      else if (ext === '.md') body.data = { markdown: text };
      else body.data = JSON.parse(text);
    } else if (a.kind === 'message' && a.text) body.data = { text: a.text };
    else if (a.kind !== 'done' && a.kind !== 'message') throw new Error('--file is required');
    if (a.screens) body.screens = a.screens.split(',').map((s) => s.trim()).filter(Boolean);
    body.assets = a.asset.map((f) => ({ name: basename(f), b64: readFileSync(f).toString('base64') }));
    const r = await post(dir, '/api/push', body);
    console.log(JSON.stringify(r));
    return;
  }
  if (cmd === 'wait' || cmd === 'tail') {
    const f = join(resolve(dir), 'inbox.jsonl');
    let after = a.after !== undefined ? Number(a.after) : lastId(dir);
    const deadline = cmd === 'wait' ? Date.now() + Number(a.timeout || 1800) * 1000 : Infinity;
    for (;;) {
      const fresh = readJsonl(f).filter((e) => e.id > after);
      for (const e of fresh) { console.log(JSON.stringify(e)); after = e.id; if (cmd === 'wait') return; }
      if (Date.now() > deadline) process.exit(2);
      await sleep(250);
    }
  }
  if (cmd === 'export') {
    const root = resolve(dir), out = resolve(a.to || 'docs/intake');
    const x = buildExport(readJsonl(join(root, 'inbox.jsonl')), readJsonl(join(root, 'outbox.jsonl')), join(root, 'artifacts'));
    const written = [];
    if (x.answers) { atomicWrite(join(out, 'answers.json'), JSON.stringify(x.answers, null, 2) + '\n'); written.push('answers.json'); }
    if (Object.keys(x.choices).length) { atomicWrite(join(out, 'choices.json'), JSON.stringify(x.choices, null, 2) + '\n'); written.push('choices.json'); }
    if (Object.keys(x.approval).length) { atomicWrite(join(out, 'approval.json'), JSON.stringify(x.approval, null, 2) + '\n'); written.push('approval.json'); }
    console.log(`wrote ${written.join(', ') || 'nothing'} in ${out}`);
    return;
  }
  if (cmd === 'stop') {
    const st = loadState(dir);
    try { process.kill(st.pid); } catch { /* already gone */ }
    rmSync(join(resolve(dir), 'state.json'), { force: true });
    console.log('stopped');
    return;
  }
  console.error('Usage: studio.mjs start|push|wait|tail|export|stop --dir <dir> ...');
  process.exit(2);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
}
