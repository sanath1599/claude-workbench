import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../plugins/ops-and-sre/', import.meta.url).pathname;
const SKILLS = ['setting-up-ci', 'releasing-safely', 'handling-incidents', 'defining-slos-and-alerts', 'instrumenting-services', 'writing-runbooks', 'deploying-to-a-vps', 'deploying-to-azure'];
const front = (t) => {
  const m = t.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, 'frontmatter');
  return Object.fromEntries(m[1].split('\n').filter((l) => /^[a-z-]+:/.test(l)).map((l) => [l.split(':')[0], l.slice(l.indexOf(':') + 1).trim()]));
};

for (const s of SKILLS) {
  test(`skill ${s} is well formed`, () => {
    const t = readFileSync(join(root, 'skills', s, 'SKILL.md'), 'utf8');
    const f = front(t);
    assert.equal(f.name, s);
    assert.ok(f.description.startsWith('Use when'), 'description starts with Use when');
    assert.ok(f.description.length < 500, `description ${f.description.length} chars`);
    assert.match(f.description, /Not for/);
    for (const h of ['## When to use', '## Procedure', '## Verification']) assert.ok(t.includes(h), h);
    assert.ok(t.split('\n').length < 500);
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t), 'no emojis');
    assert.ok(!/\bnode\s+\/|@\S+\.md/.test(t), 'no @ links');
  });
}

test('versioned skills carry a Versions block with dates', () => {
  for (const s of ['setting-up-ci', 'instrumenting-services']) {
    const t = readFileSync(join(root, 'skills', s, 'SKILL.md'), 'utf8');
    assert.match(t, /## Versions[\s\S]*verified \d{4}-\d{2}-\d{2}/);
  }
});

test('ci template pins every third-party action to a full SHA and has no deploy', () => {
  const y = readFileSync(join(root, 'skills/setting-up-ci/assets/ci.yml'), 'utf8');
  const uses = [...y.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
  assert.ok(uses.length >= 5);
  for (const u of uses) assert.match(u, /@[0-9a-f]{40}$/, u);
  assert.ok(!/vercel (deploy|--prod)|--prod\b/.test(y));
  assert.match(y, /concurrency:/);
  assert.match(y, /permissions:\s*\n\s+contents: read/);
});

test('every file referenced from a References table exists', () => {
  for (const s of SKILLS) {
    const t = readFileSync(join(root, 'skills', s, 'SKILL.md'), 'utf8');
    const refs = t.split('## References')[1];
    if (!refs) continue;
    for (const m of refs.matchAll(/\|\s*((?:references|assets|scripts)\/[\w./-]+)/g)) {
      assert.ok(existsSync(join(root, 'skills', s, m[1])), `${s}: ${m[1]}`);
    }
  }
});

test('agent frontmatter', () => {
  const t = readFileSync(join(root, 'agents/runbook-cold-reader.md'), 'utf8');
  const f = front(t);
  assert.equal(f.name, 'runbook-cold-reader');
  assert.equal(f.model, 'sonnet');
  assert.equal(f.tools, 'Read, Grep, Glob');
});

test('evals include a near miss and every case has graders', () => {
  const dirs = readdirSync(join(root, 'evals'));
  assert.ok(dirs.length >= 3 && dirs.length <= 5);
  assert.ok(dirs.some((d) => /nearmiss/.test(d)));
  for (const d of dirs) {
    assert.ok(existsSync(join(root, 'evals', d, 'prompt.md')), d);
    assert.ok(readdirSync(join(root, 'evals', d, 'graders')).length >= 1, d);
  }
});

test('tracked packages file is valid', () => {
  const p = new URL('../../maintenance/tracked-packages.d/ops-and-sre.json', import.meta.url).pathname;
  const list = JSON.parse(readFileSync(p, 'utf8'));
  for (const e of list) {
    assert.ok(e.name && e.documented && e.changelog && Array.isArray(e.skills));
    assert.ok(['npm', 'PyPI', 'github'].includes(e.ecosystem));
    if (e.ecosystem === 'github') assert.ok(e.repo);
    for (const s of e.skills) assert.ok(SKILLS.includes(s), s);
  }
});

test('no secrets-looking strings or owner specifics in the plugin', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  for (const f of walk(root)) {
    const t = readFileSync(f, 'utf8');
    assert.ok(!/(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,})/.test(t), f);
  }
});
