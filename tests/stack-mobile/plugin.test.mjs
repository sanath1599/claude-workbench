import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url).pathname;
const plugin = join(root, 'plugins/stack-mobile');
const EXPECTED = ['building-expo-apps', 'designing-native-ui', 'adding-mobile-auth-and-storage', 'sending-push-notifications', 'testing-mobile-apps', 'shipping-mobile-releases'];
const text = (p) => readFileSync(p, 'utf8');
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));

test('the expected skills exist and only those', () => {
  assert.deepEqual(readdirSync(join(plugin, 'skills')).sort(), [...EXPECTED].sort());
});

for (const s of EXPECTED) {
  const file = join(plugin, 'skills', s, 'SKILL.md');
  test(`${s}: frontmatter, size and sections`, () => {
    const t = text(file);
    const m = t.match(/^---\nname: (.+)\ndescription: (.+)\n---\n/);
    assert.ok(m, 'frontmatter');
    assert.equal(m[1], s);
    assert.ok(m[2].length < 500, `description ${m[2].length} chars`);
    assert.match(m[2], /^Use when/);
    assert.match(m[2], /Not for/);
    assert.ok(t.split('\n').length < 500);
    for (const h of ['## When to use', '## When not to use', '## Procedure', '## Quick reference', '## Verification', '## References', '## Versions']) assert.ok(t.includes(h), `missing ${h}`);
    assert.match(t, /\*\*Done when:\*\*/);
    assert.ok(t.split(/\s+/).length < 1900, 'SKILL.md too long; move detail to references');
  });
  test(`${s}: referenced files exist`, () => {
    const t = text(file);
    for (const [, ref] of t.matchAll(/`((?:references|scripts)\/[\w./-]+)`/g)) assert.ok(existsSync(join(plugin, 'skills', s, ref)), ref);
    const refs = join(plugin, 'skills', s, 'references');
    for (const f of readdirSync(refs)) assert.ok(t.includes(`references/${f}`), `${f} not listed in SKILL.md`);
  });
  test(`${s}: references do not link to other references`, () => {
    const refs = join(plugin, 'skills', s, 'references');
    for (const f of readdirSync(refs)) assert.ok(!/\]\((?:\.\/)?[\w-]+\.md\)|`references\//.test(text(join(refs, f))), `${f} links to another reference`);
  });
}

test('no emojis, owner values or sonner recommendations', () => {
  for (const f of walk(plugin)) {
    const t = text(f);
    assert.ok(!/\p{Extended_Pictographic}/u.test(t), `emoji in ${f}`);
    assert.ok(!/antm\.ai|acmeit|gmail\.com/i.test(t), `owner value in ${f}`);
    assert.ok(!/from ['"]sonner|sonner-native['"]|npm (?:i|install) [^\n]*sonner/.test(t), `sonner import or install in ${f}`);
  }
});

test('manifest keeps required fields', () => {
  const m = JSON.parse(text(join(plugin, '.claude-plugin/plugin.json')));
  assert.equal(m.name, 'stack-mobile');
  assert.equal(m.version, '0.1.0');
  assert.equal(m.license, 'PolyForm-Noncommercial-1.0.0');
  assert.deepEqual(m.author, { name: 'Claude Code / Codex Starter Pack contributors' });
  assert.ok(m.description.length > 20 && m.keywords.length);
});

test('evals: three cases including a near-miss that forbids skill use', () => {
  const dir = join(plugin, 'evals');
  const cases = readdirSync(dir);
  assert.equal(cases.length, 3);
  assert.ok(cases.some((c) => readdirSync(join(dir, c, 'graders')).some((g) => /max: 0/.test(text(join(dir, c, 'graders', g))))));
});

test('tracked packages are well formed, unique and all appear in the named skill Versions block', () => {
  const list = JSON.parse(text(join(root, 'maintenance/tracked-packages.d/stack-mobile.json')));
  const key = (p) => `${p.ecosystem}:${p.name}`;
  assert.equal(new Set(list.map(key)).size, list.length);
  for (const n of ['expo', 'expo-router', 'react-native', 'eas-cli', '@shopify/flash-list', 'expo-image', 'react-native-reanimated', 'lucide-react-native']) assert.ok(list.some((p) => p.name === n), n);
  assert.ok(list.some((p) => p.ecosystem === 'github' && p.repo === 'mobile-dev-inc/maestro'));
  for (const p of list) {
    assert.ok(p.documented && p.changelog.startsWith('https://'), p.name);
    assert.ok(p.skills.length && p.skills.every((s) => EXPECTED.includes(s)), p.name);
    for (const s of p.skills) {
      const t = text(join(plugin, 'skills', s, 'SKILL.md'));
      const versions = t.slice(t.indexOf('## Versions'));
      assert.ok(versions.includes(p.name), `${p.name} missing from ${s} Versions block`);
      assert.ok(versions.includes(p.documented), `${p.name} ${p.documented} not in ${s} Versions block`);
    }
  }
});

test('Versions blocks carry verification dates', () => {
  for (const s of EXPECTED) {
    const t = text(join(plugin, 'skills', s, 'SKILL.md'));
    assert.match(t.slice(t.indexOf('## Versions')), /verified \d{4}-\d{2}-\d{2}/);
  }
});

test('DEFAULT_WATCH includes the core Expo packages', () => {
  const t = text(join(root, 'plugins/workbench/scripts/check-updates.mjs'));
  for (const n of ['expo', 'expo-router', 'react-native']) assert.ok(t.includes(`'${n}'`), n);
});
