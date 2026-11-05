import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const SCRIPT = 'scripts/install-codex.mjs';
const START = '<!-- starter-pack:rules:start -->';
const END = '<!-- starter-pack:rules:end -->';

function setup() {
  const base = mkdtempSync(join(tmpdir(), 'codex-'));
  const home = join(base, 'codex');
  const profile = join(base, 'profile.json');
  writeFileSync(profile, JSON.stringify({ owner_name: 'Test Owner', domain: 'example.test' }));
  return { home, profile };
}
const run = (args) => spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });

test('installs skills with markers, rendered tokens and the AGENTS.md block', () => {
  const { home, profile } = setup();
  const r = run(['--codex-home', home, '--profile', profile]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(home, 'skills', 'ask-the-owner', '.starter-pack')));
  assert.ok(existsSync(join(home, 'skills', 'ask-the-owner', 'SKILL.md')));
  assert.ok(!existsSync(join(home, 'skills', 'graphify')), 'toolbelt is excluded by default');
  const skill = readFileSync(join(home, 'skills', 'ask-the-owner', 'SKILL.md'), 'utf8');
  assert.match(skill, /Test Owner/);
  assert.ok(!skill.includes('{{wb.owner_name}}'));
  const agents = readFileSync(join(home, 'AGENTS.md'), 'utf8');
  assert.ok(agents.includes(START) && agents.includes(END));
  assert.match(agents, /Test Owner/);
  assert.match(r.stdout, /mcp_servers\.vercel/);
  assert.match(r.stdout, /Verify against the Codex docs/);
});

test('replaces an existing block and preserves other AGENTS.md content', () => {
  const { home, profile } = setup();
  mkdirSync(home, { recursive: true });
  writeFileSync(join(home, 'AGENTS.md'), `Top notes\n\n${START}\nOLD RULES\n${END}\n\nBottom notes\n`);
  const r = run(['--codex-home', home, '--profile', profile, '--plugins', 'workbench']);
  assert.equal(r.status, 0, r.stderr);
  const agents = readFileSync(join(home, 'AGENTS.md'), 'utf8');
  assert.ok(!agents.includes('OLD RULES'));
  assert.ok(agents.includes('Top notes') && agents.includes('Bottom notes'));
  assert.equal(agents.split(START).length, 2);
  const again = run(['--codex-home', home, '--profile', profile, '--plugins', 'workbench']);
  assert.equal(again.status, 0);
  assert.equal(readFileSync(join(home, 'AGENTS.md'), 'utf8'), agents);
});

test('appends the block to an AGENTS.md that has none', () => {
  const { home, profile } = setup();
  mkdirSync(home, { recursive: true });
  writeFileSync(join(home, 'AGENTS.md'), 'My own notes\n');
  run(['--codex-home', home, '--profile', profile, '--plugins', 'workbench']);
  const agents = readFileSync(join(home, 'AGENTS.md'), 'utf8');
  assert.ok(agents.startsWith('My own notes'));
  assert.ok(agents.includes(START));
});

test('skips a skill directory that has no marker', () => {
  const { home, profile } = setup();
  mkdirSync(join(home, 'skills', 'ask-the-owner'), { recursive: true });
  writeFileSync(join(home, 'skills', 'ask-the-owner', 'SKILL.md'), 'mine');
  const r = run(['--codex-home', home, '--profile', profile, '--plugins', 'workbench']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /skip ask-the-owner/);
  assert.equal(readFileSync(join(home, 'skills', 'ask-the-owner', 'SKILL.md'), 'utf8'), 'mine');
  assert.ok(!existsSync(join(home, 'skills', 'ask-the-owner', '.starter-pack')));
});

test('fails clearly on a skill name collision', () => {
  const { home, profile } = setup();
  const repo = mkdtempSync(join(tmpdir(), 'fake-repo-'));
  mkdirSync(join(repo, 'scripts'));
  cpSync(SCRIPT, join(repo, SCRIPT));
  cpSync('plugins/workbench/scripts', join(repo, 'plugins/workbench/scripts'), { recursive: true });
  cpSync('plugins/workbench/profile.defaults.json', join(repo, 'plugins/workbench/profile.defaults.json'));
  for (const plugin of ['alpha', 'beta']) {
    const root = join(repo, 'plugins', plugin);
    mkdirSync(join(root, '.claude-plugin'), { recursive: true });
    writeFileSync(join(root, '.claude-plugin/plugin.json'), '{}');
    mkdirSync(join(root, 'skills', 'same-name'), { recursive: true });
    writeFileSync(join(root, 'skills', 'same-name', 'SKILL.md'), '---\nname: same-name\n---\n');
  }
  const r = spawnSync('node', [join(repo, SCRIPT), '--codex-home', home, '--profile', profile], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /collision.*same-name/);
  assert.ok(!existsSync(home));
});

test('--dry-run writes nothing', () => {
  const { home, profile } = setup();
  const r = run(['--codex-home', home, '--profile', profile, '--dry-run']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\[dry-run\] install skill/);
  assert.ok(!existsSync(home));
});

test('--uninstall removes marked skills and the block only', () => {
  const { home, profile } = setup();
  mkdirSync(join(home, 'skills', 'foreign'), { recursive: true });
  writeFileSync(join(home, 'skills', 'foreign', 'SKILL.md'), 'keep');
  writeFileSync(join(home, 'AGENTS.md'), 'Keep me\n');
  run(['--codex-home', home, '--profile', profile]);
  const r = run(['--codex-home', home, '--uninstall']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!existsSync(join(home, 'skills', 'ask-the-owner')));
  assert.ok(existsSync(join(home, 'skills', 'foreign', 'SKILL.md')));
  const agents = readFileSync(join(home, 'AGENTS.md'), 'utf8');
  assert.ok(!agents.includes(START));
  assert.match(agents, /Keep me/);
});
