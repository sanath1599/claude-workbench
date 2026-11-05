import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildGithub, buildVercel, check, decryptEnv, diffNames, exampleNames, main, parseEnv, syncEach } from '../../plugins/ops-and-sre/skills/keeping-secrets-in-a-vault/scripts/vault-env.mjs';

const SECRET_A = 'value-alpha-1234567890'; // workbench:allow-secret (test fixture)
const SECRET_B = 'p@ss=with=equals#and hash'; // workbench:allow-secret (test fixture)

function fakeRun(calls = [], { sopsOut = `A_KEY=${SECRET_A}\nB_KEY="${SECRET_B}"\n# note\nexport C_KEY='c'\n`, fail = [] } = {}) {
  return (cmd, args, opts = {}) => {
    calls.push({ cmd, args, input: opts.input });
    if (cmd === 'sops' && args[0] === 'decrypt') return { status: 0, stdout: sopsOut, stderr: '' };
    if (fail.includes(args[2])) return { status: 1, stdout: '', stderr: '' };
    return { status: 0, stdout: `${cmd} 1.2.3`, stderr: '' };
  };
}

test('parseEnv handles quotes, export, comments and equals in values', () => {
  const m = parseEnv(`A=1\n# c\nexport B="x=y"\nC='z'\nbad line\n`);
  assert.deepEqual([...m.entries()], [['A', '1'], ['B', 'x=y'], ['C', 'z']]);
  assert.deepEqual(exampleNames('X=\nY=placeholder\n'), ['X', 'Y']);
});

test('diffNames reports missing and extra names', () => {
  assert.deepEqual(diffNames(['A', 'B'], ['B', 'C']), { missing: ['A'], extra: ['C'] });
});

test('decryptEnv throws without leaking output on failure', () => {
  assert.throws(() => decryptEnv('f.env', () => ({ status: 2, stdout: SECRET_A, stderr: SECRET_A })), (e) => !e.message.includes(SECRET_A));
});

test('diff-keys prints names only, never values', () => {
  const logs = [];
  const code = main(['diff-keys', '--file', 'secrets/dev.env', '--example', 'tests/ops-and-sre/fixtures-none'], { run: fakeRun(), cwd: process.cwd(), log: (s) => logs.push(s) });
  assert.equal(code, 2); // example file absent
  assert.ok(logs.every((l) => !l.includes(SECRET_A)));
});

test('sync-github is a dry run by default and runs nothing but decrypt', () => {
  const calls = [];
  const logs = [];
  const code = main(['sync-github', '--repo', 'acme/app'], { run: fakeRun(calls), log: (s) => logs.push(s) });
  assert.equal(code, 0);
  assert.deepEqual(calls.map((c) => c.cmd), ['sops']);
  assert.ok(logs.some((l) => l.includes('A_KEY')));
  assert.ok(logs.join('\n').indexOf(SECRET_A) === -1);
});

test('sync-github --apply pipes each value on stdin and never in argv or logs', () => {
  const calls = [];
  const logs = [];
  const code = main(['sync-github', '--repo', 'acme/app', '--env', 'prod', '--apply'], { run: fakeRun(calls), log: (s) => logs.push(s) });
  assert.equal(code, 0);
  const gh = calls.filter((c) => c.cmd === 'gh');
  assert.equal(gh.length, 3);
  assert.deepEqual(gh[0].args, ['secret', 'set', 'A_KEY', '--repo', 'acme/app', '--env', 'prod']);
  assert.equal(gh[0].input, SECRET_A);
  assert.equal(gh[1].input, SECRET_B);
  for (const c of gh) assert.ok(!c.args.some((a) => a.includes('value-alpha') || a.includes('p@ss')));
  assert.ok(!logs.join('\n').includes(SECRET_A) && !logs.join('\n').includes('p@ss'));
});

test('sync-vercel validates env, honours --only and reports failures', () => {
  const calls = [];
  const logs = [];
  assert.equal(main(['sync-vercel', '--env', 'prod'], { run: fakeRun(), log: () => {} }), 2);
  const code = main(['sync-vercel', '--env', 'production', '--only', 'A_KEY,B_KEY', '--apply'], { run: fakeRun(calls, { fail: ['B_KEY'] }), log: (s) => logs.push(s) });
  assert.equal(code, 1);
  const v = calls.filter((c) => c.cmd === 'vercel');
  assert.deepEqual(v.map((c) => c.args[2]), ['A_KEY', 'B_KEY']);
  assert.ok(logs.some((l) => l.startsWith('  FAILED') && l.includes('B_KEY')));
  assert.deepEqual(buildVercel('production')('X').args.slice(0, 4), ['env', 'add', 'X', 'production']);
});

test('syncEach does nothing without apply', () => {
  const calls = [];
  const res = syncEach(new Map([['A', '1']]), ['A'], buildGithub('o/r'), { apply: false, run: fakeRun(calls) });
  assert.equal(calls.length, 0);
  assert.deepEqual(res.planned, ['A']);
});

test('check reports tools and .sops.yaml sanity without key material', () => {
  const files = { '/repo/.sops.yaml': 'creation_rules:\n  - path_regex: secrets/dev\\.env$\n    age: age1abcdefghijklmnopqrstuvwxyz0123\n', '/repo/.gitignore': '.env\n.env.*\n' };
  const prev = process.env.SOPS_AGE_KEY_FILE;
  process.env.SOPS_AGE_KEY_FILE = '/home/me/.config/sops/age/keys.txt';
  try {
    const res = check({ run: fakeRun(), cwd: '/repo', exists: (p) => p in files || p === process.env.SOPS_AGE_KEY_FILE, read: (p) => files[p] });
    assert.ok(res.every((r) => r.ok), JSON.stringify(res.filter((r) => !r.ok)));
    assert.ok(res.some((r) => r.name === '.sops.yaml' && /1 rule/.test(r.detail)));
    const bad = check({ run: () => ({ status: 127, stdout: '', stderr: '' }), cwd: '/repo', exists: () => false, read: () => '' });
    assert.ok(bad.some((r) => r.name === 'sops' && !r.ok));
    assert.ok(bad.some((r) => r.name === 'infisical' && r.ok));
  } finally {
    if (prev === undefined) delete process.env.SOPS_AGE_KEY_FILE; else process.env.SOPS_AGE_KEY_FILE = prev;
  }
});

test('check flags an age key stored inside the repo', () => {
  const prev = process.env.SOPS_AGE_KEY_FILE;
  process.env.SOPS_AGE_KEY_FILE = '/repo/keys.txt';
  try {
    const res = check({ run: fakeRun(), cwd: '/repo', exists: () => false, read: () => '' });
    assert.ok(res.some((r) => r.name === 'key location' && !r.ok));
  } finally {
    if (prev === undefined) delete process.env.SOPS_AGE_KEY_FILE; else process.env.SOPS_AGE_KEY_FILE = prev;
  }
});
