import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, after } from 'node:test';
import { buildExport, isLocalOrigin, tokenOk, safeName } from '../../plugins/workbench/skills/new/scripts/studio.mjs';

const SKILL = 'plugins/workbench/skills/new';
const STUDIO = `${SKILL}/scripts/studio.mjs`;
const dir = join(mkdtempSync(join(tmpdir(), 'studio-')), '.workbench-studio');
const procs = [];
after(() => procs.forEach((p) => p.kill()));

function run(args) { return execFileSync('node', [STUDIO, ...args], { encoding: 'utf8' }); }
function waitLine(child, pred, ms = 5000) {
  return new Promise((ok, bad) => {
    let buf = ''; const t = setTimeout(() => bad(new Error('timeout; got: ' + buf)), ms);
    child.stdout.on('data', (d) => { buf += d; for (const l of buf.split('\n')) if (pred(l)) { clearTimeout(t); ok(l); return; } });
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn('node', [STUDIO, 'start', '--dir', dir, '--port', '0', '--no-open'], { stdio: ['ignore', 'pipe', 'inherit'] });
procs.push(server);
const urlLine = await waitLine(server, (l) => l.startsWith('STUDIO_URL='));
const base = new URL(urlLine.slice('STUDIO_URL='.length));
const token = base.searchParams.get('t');
const origin = base.origin;
const post = (path, body, headers = {}) => fetch(origin + path, { method: 'POST', headers: { 'X-Studio-Token': token, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('start prints a token URL and writes state.json', () => {
  const st = JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8'));
  assert.equal(st.port, Number(base.port));
  assert.equal(st.token, token);
  assert.ok(st.pid > 0);
});

test('a request without the token gets 401, and the app loads with it', async () => {
  assert.equal((await fetch(origin + '/')).status, 401);
  assert.equal((await fetch(origin + '/events')).status, 401);
  assert.equal((await fetch(origin + '/api/reply', { method: 'POST', body: '{}' })).status, 401);
  const r = await fetch(origin + '/?t=' + token);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(await r.text(), /Workbench studio/);
});

test('a non-local Origin is refused', async () => {
  const r = await post('/api/reply', { stepId: 1, kind: 'answers', data: {} }, { Origin: 'https://evil.example' });
  assert.equal(r.status, 403);
  assert.equal(isLocalOrigin('http://127.0.0.1:5000'), true);
  assert.equal(isLocalOrigin('https://127.0.0.1'), false);
  assert.equal(isLocalOrigin('null'), false);
});

test('oversized replies are refused', async () => {
  const r = await post('/api/reply', { stepId: 1, kind: 'answers', data: 'x'.repeat(300 * 1024) });
  assert.equal(r.status, 413);
});

test('push reaches an SSE client and replays on connect', async () => {
  const msg = join(dir, 'm.json');
  writeFileSync(msg, JSON.stringify({ text: 'hello' }));
  const ctrl = new AbortController();
  const res = await fetch(`${origin}/events?t=${token}`, { signal: ctrl.signal });
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  const reader = res.body.getReader();
  run(['push', '--dir', dir, '--kind', 'message', '--file', msg, '--title', 'Working']);
  let text = '';
  const dec = new TextDecoder();
  while (!text.includes('"hello"')) { const { value, done } = await reader.read(); if (done) break; text += dec.decode(value); }
  ctrl.abort();
  assert.match(text, /event: step/);
  assert.match(text, /"kind":"message"/);
  assert.ok(readFileSync(join(dir, 'outbox.jsonl'), 'utf8').includes('"Working"'));
  const c2 = new AbortController();
  const r2 = await fetch(`${origin}/events?t=${token}`, { signal: c2.signal });
  let replay = '';
  const rd = r2.body.getReader();
  while (!replay.includes('"hello"')) { const { value, done } = await rd.read(); if (done) break; replay += dec.decode(value); }
  c2.abort();
  assert.match(replay, /"hello"/);
});

test('html push becomes a sandboxed artifact with its own CSP', async () => {
  const f = join(dir, 'mock.html');
  writeFileSync(f, '<!doctype html><title>x</title><p>sample</p>');
  const out = JSON.parse(run(['push', '--dir', dir, '--kind', 'mock', '--file', f, '--title', 'Sample', '--screens', 'Home,Detail']));
  const r = await fetch(`${origin}/artifacts/step-${out.id}.html?t=${token}`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /sandbox allow-scripts/);
  assert.equal((await fetch(`${origin}/artifacts/step-${out.id}.html`)).status, 401);
});

test('a posted reply lands in inbox.jsonl and wait returns it', async () => {
  const waiter = spawn('node', [STUDIO, 'wait', '--dir', dir, '--timeout', '10'], { stdio: ['ignore', 'pipe', 'inherit'] });
  procs.push(waiter);
  const line = waitLine(waiter, (l) => l.startsWith('{'));
  await sleep(500);
  const r = await post('/api/reply', { stepId: 1, kind: 'answers', data: { answers: { name: 'demo' } } }, { Origin: origin });
  assert.equal(r.status, 200);
  const ev = JSON.parse(await line);
  assert.equal(ev.kind, 'answers');
  assert.equal(ev.data.answers.name, 'demo');
  assert.ok(ev.id >= 1 && ev.ts);
  assert.ok(readFileSync(join(dir, 'inbox.jsonl'), 'utf8').includes('"demo"'));
});

test('wait exits 2 on timeout', () => {
  let code = 0;
  try { run(['wait', '--dir', dir, '--timeout', '1']); } catch (e) { code = e.status; }
  assert.equal(code, 2);
});

test('tail prints each new reply', async () => {
  const tail = spawn('node', [STUDIO, 'tail', '--dir', dir], { stdio: ['ignore', 'pipe', 'inherit'] });
  procs.push(tail);
  await sleep(500);
  const line = waitLine(tail, (l) => l.includes('"choice"'));
  await post('/api/reply', { stepId: 2, kind: 'choice', data: { choice: 'slate-calm' } });
  assert.equal(JSON.parse(await line).data.choice, 'slate-calm');
  tail.kill();
});

test('export writes answers, choices and approval with a hash', () => {
  const out = join(dir, 'export');
  run(['export', '--dir', dir, '--to', out]);
  assert.equal(JSON.parse(readFileSync(join(out, 'answers.json'), 'utf8')).answers.name, 'demo');
  const mockStep = readFileSync(join(dir, 'outbox.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((s) => s.kind === 'mock');
  appendFileSync(join(dir, 'inbox.jsonl'), JSON.stringify({ id: 99, ts: new Date().toISOString(), stepId: mockStep.id, kind: 'approve', data: { comments: '' } }) + '\n');
  run(['export', '--dir', dir, '--to', out]);
  const ap = JSON.parse(readFileSync(join(out, 'approval.json'), 'utf8'));
  assert.equal(ap.mock.decision, 'approve');
  assert.match(ap.mock.sha256, /^[0-9a-f]{64}$/);
  assert.ok(existsSync(join(out, 'choices.json')));
});

test('pure helpers', () => {
  assert.equal(tokenOk('abc', 'abc'), true);
  assert.equal(tokenOk('abd', 'abc'), false);
  assert.equal(tokenOk(null, 'abc'), false);
  assert.equal(safeName('../../etc/passwd'), 'passwd');
  assert.deepEqual(buildExport([], [], '/x').choices, {});
});

test('stop ends the server', async () => {
  run(['stop', '--dir', dir]);
  await sleep(300);
  assert.equal(existsSync(join(dir, 'state.json')), false);
  await assert.rejects(fetch(origin + '/?t=' + token));
});

test('studio.html has no external requests', () => {
  const html = readFileSync(`${SKILL}/assets/studio.html`, 'utf8');
  assert.doesNotMatch(html, /(?:src|href)=["']https?:/i);
  assert.doesNotMatch(html, /@import|url\(https?:/i);
});

test('intake.json parses and covers every section and field', () => {
  const d = JSON.parse(readFileSync(`${SKILL}/assets/intake.json`, 'utf8'));
  const want = { project: ['name', 'purpose', 'users', 'features', 'non_goals'], shape: ['kind', 'scale'], references: ['references'], stack: ['stack'], delivery: ['cloud_handoff', 'repo_owner', 'repo_visibility', 'commit_policy', 'coauthor', 'deploy_policy'], design: ['direction', 'theme', 'density'], extra: ['notes'] };
  const types = new Set(['text', 'textarea', 'list', 'select', 'radio', 'toggle', 'stack-table', 'table', 'direction-picker']);
  for (const [sid, ids] of Object.entries(want)) {
    const s = d.sections.find((x) => x.id === sid);
    assert.ok(s, `section ${sid}`);
    for (const id of ids) assert.ok(s.fields.some((f) => f.id === id), `${sid}.${id}`);
    for (const f of s.fields) assert.ok(types.has(f.type), `${f.id} type ${f.type}`);
  }
  assert.deepEqual(d.sections.find((s) => s.id === 'design').showIf.in, ['ui', 'both']);
  assert.equal(d.sections.find((s) => s.id === 'delivery').fields.find((f) => f.id === 'cloud_handoff').options.length, 3);
  assert.equal(d.sections.find((s) => s.id === 'design').fields[0].options.length, 3);
});

test('intake has the deployment section with conditional fields, and studio implements showIf for fields', () => {
  const d = JSON.parse(readFileSync(`${SKILL}/assets/intake.json`, 'utf8'));
  const sec = d.sections.find((s) => s.id === 'deployment');
  assert.ok(sec, 'deployment section');
  assert.ok(d.sections.findIndex((s) => s.id === 'deployment') < d.sections.findIndex((s) => s.id === 'delivery'));
  const f = (id) => sec.fields.find((x) => x.id === id);
  const values = (id) => f(id).options.map((o) => o.value);
  assert.deepEqual(values('deployment_tier'), ['dev', 'internal', 'enterprise']);
  assert.equal(f('deployment_tier').value, 'internal');
  assert.ok(f('deployment_tier').options.find((o) => o.value === 'internal').recommended);
  assert.deepEqual(values('cloud'), ['azure', 'aws', 'gcp']);
  assert.deepEqual(values('cicd'), ['none', 'existing']);
  assert.equal(f('cicd').value, 'none');
  assert.deepEqual(values('iac'), ['cli-then-iac', 'terraform', 'bicep', 'cli-only']);
  assert.deepEqual(values('iac_tool'), ['terraform', 'bicep']);
  assert.equal(f('cicd_system').type, 'text');
  for (const id of ['cloud', 'cicd', 'iac']) assert.deepEqual(f(id).showIf, { field: 'deployment_tier', value: 'enterprise' });
  assert.deepEqual(f('iac_tool').showIf, { field: 'iac', value: 'cli-then-iac' });
  const html = readFileSync(`${SKILL}/assets/studio.html`, 'utf8');
  assert.match(html, /function matches\(/);
  assert.match(html, /function fieldVisible\(/);
  assert.match(readFileSync(`${SKILL}/references/intake-schema.md`, 'utf8'), /iacSync/);
});

test('SKILL.md follows the authoring contract', () => {
  const t = readFileSync(`${SKILL}/SKILL.md`, 'utf8');
  assert.match(t, /^name: new$/m);
  assert.match(t, /^disable-model-invocation: true$/m);
  assert.match(t, /^argument-hint: "\[brief or path\]"$/m);
  assert.ok(t.split('\n').length < 500);
  assert.doesNotMatch(t, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
});
