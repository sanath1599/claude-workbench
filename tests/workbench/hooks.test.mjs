import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { evaluate as bash } from '../../plugins/workbench/scripts/guard-bash.mjs';
import { evaluate as write } from '../../plugins/workbench/scripts/guard-write.mjs';
import { evaluate as prompt } from '../../plugins/workbench/scripts/guard-prompt.mjs';
import { scanLine, scanText, scanUnifiedDiff, scanWorking, isEnvFile } from '../../plugins/workbench/scripts/secret-scan.mjs';
import { renderTokens } from '../../plugins/workbench/scripts/lib.mjs';
import { buildContext } from '../../plugins/workbench/scripts/session-context.mjs';
import { alreadyDecided, compareVersions, findUpdates, installedVersions, isPrerelease } from '../../plugins/workbench/scripts/check-updates.mjs';
import { rank, tokenize } from '../../scripts/find-skill.mjs';
import { bump } from '../../scripts/bump-version.mjs';

const noScan = { working: () => [], push: () => [] };
const FAKE_KEY = ['sk-ant-api03-', 'Zx9'.repeat(16)].join('');

test('secret scanner catches real-looking keys and ignores code and placeholders', () => {
  assert.ok(scanLine(`ANTHROPIC_API_KEY=${FAKE_KEY}`).length);
  assert.ok(scanLine('const u = "postgresql://app:S3cr3tPassw0rd@db.example-host.com:5432/x"').length); // workbench:allow-secret
  assert.equal(scanLine('postgresql://app:app@localhost:5434/dev').length, 0);
  assert.equal(scanLine('const apiKey = process.env.RESEND_API_KEY').length, 0);
  assert.equal(scanLine('const commandSecrets = scanText(command, x)').length, 0);
  assert.equal(scanLine('API_KEY=your-api-key-here').length, 0);
  assert.equal(scanLine(`KEY=${FAKE_KEY} // workbench:allow-secret`).length, 0);
  assert.ok(isEnvFile('a/.env.local'));
  assert.ok(!isEnvFile('.env.example'));
});

test('diff scanning reports file and line of added secrets only', () => {
  const diff = ['+++ b/src/x.ts', '@@ -1,0 +10,2 @@', `+const k = "${FAKE_KEY}";`, '+ok();', '+++ b/package-lock.json', '@@ -1 +1 @@', `+"integrity": "${FAKE_KEY}"`].join('\n');
  const f = scanUnifiedDiff(diff);
  assert.equal(f.length, 1);
  assert.equal(f[0].file, 'src/x.ts');
  assert.equal(f[0].line, 10);
  assert.ok(!f[0].preview.includes(FAKE_KEY));
});

test('scanWorking sees untracked files and staged env files', () => {
  const repo = mkdtempSync(join(tmpdir(), 'wb-scan-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  writeFileSync(join(repo, 'config.ts'), `export const key = "${FAKE_KEY}";\n`);
  writeFileSync(join(repo, '.env'), 'X=1\n');
  execFileSync('git', ['add', '.env'], { cwd: repo });
  const rules = scanWorking(repo).map((f) => f.rule);
  assert.ok(rules.includes('env-file-tracked'));
  assert.ok(rules.includes('anthropic-key'));
});

test('guard-bash: house rules and gates', () => {
  const opts = { cwd: tmpdir(), profile: {}, project: {}, scan: noScan };
  assert.equal(bash('npm i sonner', opts).decision, 'deny');
  assert.equal(bash('npx shadcn@latest add sonner', opts).decision, 'deny');
  assert.equal(bash('pnpm add zod', opts).decision, 'deny');
  assert.equal(bash('cat .env', opts).decision, 'deny');
  assert.equal(bash('cat .env.example', opts), null);
  assert.equal(bash('vercel deploy --prod </dev/null', opts).decision, 'ask');
  assert.equal(bash('vercel deploy --prod', { ...opts, project: { productionDeploys: 'auto-on-main' } }), null);
  assert.equal(bash('git push --force origin main', opts).decision, 'ask');
  assert.equal(bash('gh repo create me/x --public', opts).decision, 'ask');
  assert.equal(bash('gh repo create me/x --private', opts), null);
  assert.equal(bash('lk agent deploy', opts).decision, 'ask');
  assert.equal(bash('npx prisma migrate reset', opts).decision, 'ask');
  assert.equal(bash('ls -la && npm test', opts), null);
  assert.equal(bash(`echo ${FAKE_KEY}`, opts).decision, 'deny');
});

test('guard-bash blocks commit and push when the scanner finds secrets', () => {
  const found = { working: () => [{ file: 'a.ts', line: 1, rule: 'x', preview: 'abcd…' }], push: () => [{ file: 'a.ts', line: 1, rule: 'x', preview: 'abcd…' }] };
  const opts = { cwd: tmpdir(), profile: {}, project: {}, scan: found };
  assert.equal(bash('git add -A && git commit -m "x"', opts).decision, 'deny');
  assert.equal(bash('git push', opts).decision, 'deny');
});

test('guard-write: sileo, emojis in UI, env files, secrets', () => {
  assert.equal(write('Write', { file_path: '/p/src/App.tsx', content: "import { toast } from 'sonner'" }).decision, 'deny');
  assert.equal(write('Edit', { file_path: '/p/src/Hero.tsx', new_string: '<h1>Launch \u{1F680}</h1>' }).decision, 'deny');
  assert.equal(write('Edit', { file_path: '/p/src/Footer.tsx', new_string: '<p>© 2026 Acme → next</p>' }), null);
  assert.equal(write('Edit', { file_path: '/p/docs/notes.md', new_string: 'Done ✅' }), null);
  assert.equal(write('Write', { file_path: '/p/.env', content: 'A=1' }, { fileExists: () => true }).decision, 'ask');
  assert.equal(write('Write', { file_path: '/p/.env', content: 'A=1' }, { fileExists: () => false }), null);
  assert.equal(write('Write', { file_path: '/p/src/config.ts', content: `const k = "${FAKE_KEY}"` }).decision, 'deny');
  assert.equal(write('Write', { file_path: '/p/tests/fixture.ts', content: `const k = "${FAKE_KEY}"` }), null);
});

test('guard-prompt: credential warning and learning nudge', () => {
  assert.match(prompt(`use ${FAKE_KEY}`), /credential/);
  assert.match(prompt('from now on always use uv for python'), /update-skill/);
  assert.equal(prompt('fix the login bug'), null);
});

test('renderTokens fills values and flags missing ones', () => {
  assert.equal(renderTokens('a {{wb.domain}} b', { domain: 'x.io' }), 'a x.io b');
  assert.equal(renderTokens('{{wb.list}}', { list: ['a', 'b'] }), 'a, b');
  assert.match(renderTokens('{{wb.nope}}', {}), /not set/);
});

test('session context includes rules, profile, project and cloud notes', () => {
  const text = buildContext({
    cwd: '/x',
    profileInfo: { profile: { owner_name: 'O', domain: 'd.io', hosting: 'Vercel' }, personalised: false, source: 'bundled' },
    projectInfo: { root: '/nonexistent', path: '/nonexistent/.claude/workbench.json', config: { commits: 'per-increment', coAuthorTrailer: true, branchPolicy: 'feature-branch', cloudHandoff: 'yes', productionDeploys: 'ask', graphify: true } },
    env: { CLAUDE_CODE_REMOTE: 'true' },
    rulesText: 'Rules for {{wb.owner_name}} on {{wb.domain}}',
  });
  assert.match(text, /Rules for O on d\.io/);
  assert.match(text, /not personalised/);
  assert.match(text, /commits=per-increment/);
  assert.match(text, /Cloud session/);
  assert.match(text, /graphify/);
});

test('check-updates: versions, prereleases, decisions, monorepo folders', async () => {
  assert.equal(compareVersions('1.2.3', '1.10.0'), -1);
  assert.equal(compareVersions('2.0.0', '2.0.0'), 0);
  assert.ok(isPrerelease('8.0.0-rc.30'));
  assert.ok(alreadyDecided('| 2026-11-05 | vite | 8.0.0 | 8.3.6 | decline | not needed |', 'vite', '8.3.6'));
  const repo = mkdtempSync(join(tmpdir(), 'wb-upd-'));
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ dependencies: { vite: '^8.0.0', react: '19.3.0' } }));
  mkdirSync(join(repo, 'agent'));
  writeFileSync(join(repo, 'agent', 'uv.lock'), '[[package]]\nname = "pydantic-ai"\nversion = "2.60.0"\n');
  const installed = installedVersions(repo);
  assert.equal(installed.npm.vite, '8.0.0');
  assert.equal(installed.PyPI['pydantic-ai'], '2.60.0');
  process.env.CLAUDE_PLUGIN_DATA = mkdtempSync(join(tmpdir(), 'wb-cache-'));
  const latest = { vite: '8.3.6', react: '19.3.0', 'pydantic-ai': '2.66.0' };
  const updates = await findUpdates(repo, { fetcher: async (_eco, name) => latest[name] });
  assert.deepEqual(updates.map((u) => u.name).sort(), ['pydantic-ai', 'vite']);
});

test('find-skill ranks by name and description', () => {
  assert.deepEqual(tokenize('The Temporal approval'), ['temporal', 'approval']);
  const skills = [
    { plugin: 'p', dir: 'a', name: 'orchestrating-with-temporal', description: 'Use when long-running workflows', body: 'temporal' },
    { plugin: 'p', dir: 'b', name: 'using-sileo-toasts', description: 'Use when toasts', body: '' },
  ];
  assert.equal(rank('temporal workflow', skills)[0].id, 'p:orchestrating-with-temporal');
});

test('bump-version', () => {
  assert.equal(bump('0.1.0', 'patch'), '0.1.1');
  assert.equal(bump('0.1.9', 'minor'), '0.2.0');
  assert.equal(bump('1.4.2', 'major'), '2.0.0');
});
