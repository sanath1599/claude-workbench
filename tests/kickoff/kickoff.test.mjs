import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { runChecks } from '../../plugins/kickoff/skills/handing-off-to-cloud/scripts/cloud-ready-check.mjs';
import { parseEnv, selectKeys } from '../../plugins/kickoff/skills/handing-off-to-cloud/scripts/make-cloud-env.mjs';
import { chooseSkills, dependencyNames, mergeSettings, planKit } from '../../plugins/kickoff/skills/handing-off-to-cloud/scripts/vendor-cloud-kit.mjs';
import { nowContext } from '../../plugins/kickoff/scripts/show-now.mjs';

function tempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'wb-kickoff-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}

test('dependencyNames reads package.json and pyproject in root and subfolders', () => {
  const repo = tempRepo();
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ dependencies: { '@tanstack/react-router': '1', react: '19' } }));
  mkdirSync(join(repo, 'api'));
  writeFileSync(join(repo, 'api', 'pyproject.toml'), '[project]\ndependencies = [\n  "pydantic-ai>=2.0",\n  "temporalio==1.35.0",\n]\n');
  const deps = dependencyNames(repo);
  for (const d of ['@tanstack/react-router', 'react', 'pydantic-ai', 'temporalio']) assert.ok(deps.has(d), d);
  const skills = chooseSkills(deps);
  assert.ok(skills.includes('stack-web:building-tanstack-frontends'));
  assert.ok(skills.includes('stack-python:orchestrating-with-temporal'));
  assert.ok(skills.includes('workbench:using-sileo-toasts'));
  assert.ok(skills.includes('workbench:handling-secrets'));
});

test('chooseSkills honours an explicit list', () => {
  assert.deepEqual(chooseSkills(new Set(['react']), ['a:b']), ['a:b']);
});

test('mergeSettings is idempotent and keeps unrelated hooks', () => {
  const existing = { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo mine' }] }] }, permissions: { allow: ['Bash(npm test)'] } };
  const once = mergeSettings(existing);
  const twice = mergeSettings(once);
  assert.deepEqual(once, twice);
  assert.equal(twice.permissions.allow[0], 'Bash(npm test)');
  assert.ok(JSON.stringify(twice).includes('echo mine'));
  assert.equal(twice.hooks.SessionStart.length, 1);
  assert.equal(twice.hooks.PostToolUse.length, 1);
  assert.equal(twice.hooks.Stop.length, 1);
  assert.match(twice.hooks.PostToolUse[0].hooks[0].command, /CLAUDE_CODE_REMOTE.*iac-sync\.mjs" post-tool-use/);
  assert.match(twice.hooks.Stop[0].hooks[0].command, /CLAUDE_CODE_REMOTE.*iac-sync\.mjs" stop/);
  assert.ok(JSON.stringify(twice).includes('CLAUDE_CODE_REMOTE'));
});

test('planKit renders rules without personal emails and vendors guard scripts', () => {
  const repo = tempRepo();
  writeFileSync(join(repo, '.env.example'), 'RESEND_API_KEY=\nLLM_PROVIDER=mock\n');
  const workbenchDir = join(process.cwd(), 'plugins', 'workbench');
  const kickoffSkillDir = join(process.cwd(), 'plugins', 'kickoff', 'skills', 'handing-off-to-cloud');
  const { writes } = planKit({ repo, skills: ['workbench:using-sileo-toasts'], workbenchDir, kickoffSkillDir });
  const paths = writes.map(([p]) => p.slice(repo.length + 1));
  for (const p of ['.claude/rules/workbench.md', '.claude/skills/using-sileo-toasts/SKILL.md', '.claude/hooks/workbench/scripts/guard-bash.mjs', '.claude/hooks/workbench/scripts/iac-sync.mjs', '.claude/hooks/cloud-setup.sh', 'docs/cloud/ENVIRONMENT.md', '.claude/settings.json']) {
    assert.ok(paths.includes(p), `missing ${p}`);
  }
  const profile = JSON.parse(writes.find(([p]) => p.endsWith('profile.defaults.json'))[1]);
  assert.equal(profile.owner_email, undefined);
  assert.equal(profile.git_author_email, undefined);
  const rules = writes.find(([p]) => p.endsWith('rules/workbench.md'))[1];
  assert.ok(!rules.includes('{{wb.'), 'tokens left unrendered');
  const env = writes.find(([p]) => p.endsWith('ENVIRONMENT.md'))[1];
  assert.ok(env.includes('`RESEND_API_KEY`'));
});

test('cloud-ready-check fails a bare repo and names what is missing', () => {
  const repo = tempRepo();
  const checks = runChecks(repo);
  const byName = Object.fromEntries(checks.map((c) => [c.name, c.status]));
  assert.equal(byName['GitHub remote'], 'FAIL');
  assert.equal(byName['CLAUDE.md'], 'FAIL');
  assert.equal(byName['House rules vendored'], 'FAIL');
});

test('make-cloud-env selects keys and drops production prefixes', () => {
  const example = 'RESEND_API_KEY=\nNEON_DATABASE_URL=\nOLLAMA_KEY=\n';
  assert.deepEqual(selectKeys({ example, keys: null, excludePrefixes: ['NEON_'] }), ['RESEND_API_KEY', 'OLLAMA_KEY']);
  assert.equal(parseEnv('export A=1\n# c\nB = two').get('B'), 'two');
});

test('show-now returns null without NOW.md and context with it', () => {
  const repo = tempRepo();
  assert.equal(nowContext(repo), null);
  mkdirSync(join(repo, 'docs', 'handoff'), { recursive: true });
  writeFileSync(join(repo, 'docs', 'handoff', 'NOW.md'), '# Now\n- done thing\n');
  assert.match(nowContext(repo), /done thing/);
  assert.ok(readFileSync(join(repo, 'docs', 'handoff', 'NOW.md'), 'utf8'));
});
