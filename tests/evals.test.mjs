// Every eval case must match the documented `claude plugin eval` schema
// (https://code.claude.com/docs/en/plugin-evals.md). Unknown keys are run errors there.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const PROMPT_KEYS = new Set(['schema_version', 'name', 'description', 'tags', 'plugins', 'runs', 'expected_outcome', 'model', 'max_turns', 'timeout_seconds', 'allowed_tools', 'append_system_prompt', 'env']);
const COMMON = ['type', 'weight', 'arm'];
const GRADER_KEYS = {
  regex: [...COMMON, 'pattern', 'flags', 'match', 'target'],
  tool_used: [...COMMON, 'tool', 'input_match', 'min', 'max'],
  tool_order: [...COMMON, 'before', 'after'],
  file_exists: [...COMMON, 'path', 'exists'],
  llm: [...COMMON, 'criteria', 'focus'],
  baseline: [...COMMON, 'baseline_file', 'criteria'],
};

function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2];
  }
  return out;
}

const cases = [];
for (const plugin of readdirSync('plugins')) {
  const evals = join('plugins', plugin, 'evals');
  if (!existsSync(evals)) continue;
  for (const c of readdirSync(evals)) {
    const dir = join(evals, c);
    if (c === 'results' || !statSync(dir).isDirectory()) continue;
    cases.push({ plugin, dir });
  }
}

test('there are eval cases', () => assert.ok(cases.length > 0));

for (const { plugin, dir } of cases) {
  test(`${dir}: prompt.md frontmatter uses documented keys`, () => {
    const file = join(dir, 'prompt.md');
    assert.ok(existsSync(file), 'prompt.md missing');
    const fm = frontmatter(readFileSync(file, 'utf8')) || {};
    for (const k of Object.keys(fm)) assert.ok(PROMPT_KEYS.has(k), `unknown prompt.md key "${k}"`);
    assert.ok(readFileSync(file, 'utf8').replace(/^---[\s\S]*?---/, '').trim().length > 10, 'prompt body is empty');
  });

  test(`${dir}: graders use documented keys and values`, () => {
    const gdir = join(dir, 'graders');
    assert.ok(existsSync(gdir), 'graders/ missing');
    const files = readdirSync(gdir).filter((f) => f.endsWith('.md'));
    assert.ok(files.length > 0, 'no graders');
    for (const f of files) {
      const fm = frontmatter(readFileSync(join(gdir, f), 'utf8'));
      assert.ok(fm, `${f}: no frontmatter`);
      const allowed = GRADER_KEYS[fm.type];
      assert.ok(allowed, `${f}: unknown grader type "${fm.type}"`);
      for (const k of Object.keys(fm)) assert.ok(allowed.includes(k), `${f}: key "${k}" not valid for ${fm.type}`);
      if (fm.arm) assert.ok(['with-only', 'both'].includes(fm.arm), `${f}: arm must be with-only or both`);
      if (fm.type === 'tool_used') assert.ok(fm.tool, `${f}: tool_used needs tool`);
      if (fm.type === 'regex') assert.ok(fm.pattern, `${f}: regex needs pattern`);
      if (fm.type === 'regex' && fm.match) assert.ok(/^(?:contains|not_contains|count:\d+)$/.test(fm.match.replace(/['"]/g, '')), `${f}: bad match "${fm.match}"`);
    }
  });
}

test('every plugin with evals has a near-miss case that forbids skill use', () => {
  const byPlugin = new Map();
  for (const { plugin, dir } of cases) {
    const gdir = join(dir, 'graders');
    const negative = readdirSync(gdir).some((f) => {
      const fm = frontmatter(readFileSync(join(gdir, f), 'utf8')) || {};
      return fm.type === 'tool_used' && fm.tool === 'Skill' && fm.max === '0';
    });
    byPlugin.set(plugin, byPlugin.get(plugin) || negative);
  }
  for (const [plugin, ok] of byPlugin) assert.ok(ok, `${plugin} has no near-miss (max: 0) case`);
});
