import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const ST = new URL('../../plugins/workbench/skills/new/scripts/studio.mjs', import.meta.url).pathname;

test('studio push fills {{wb.*}} tokens from the profile before the page sees them', async () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'wb-studio-')), '.ws');
  const srv = spawn('node', [ST, 'start', '--dir', dir, '--no-open'], { stdio: ['ignore', 'pipe', 'ignore'] });
  await new Promise((res) => srv.stdout.on('data', (b) => /STUDIO_URL=/.test(String(b)) && res()));
  try {
    const file = join(dir, '..', 'q.json');
    writeFileSync(file, JSON.stringify({ sections: [{ id: 's', title: 'Repo', fields: [{ id: 'owner', type: 'text', label: 'Owner', value: '{{wb.github_owner}}' }] }] }));
    execFileSync('node', [ST, 'push', '--dir', dir, '--kind', 'questions', '--file', file], { encoding: 'utf8' });
    const outbox = readFileSync(join(dir, 'outbox.jsonl'), 'utf8');
    assert.ok(!outbox.includes('{{wb.github_owner}}'), 'raw token reached the page');
  } finally {
    execFileSync('node', [ST, 'stop', '--dir', dir]);
    srv.kill();
  }
});

test('studio page keeps the newest interactive step open and normalises palettes', () => {
  const html = readFileSync(new URL('../../plugins/workbench/skills/new/assets/studio.html', import.meta.url), 'utf8');
  assert.match(html, /function normPalette/);
  assert.match(html, /openIdx/);
  assert.ok(!/\.q-bar\{position:sticky/.test(html), 'sticky action bar breaks clicks in some browsers');
});
