import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cmp, extractLinks, isStable, loadTracked, staleVerifications } from '../maintenance/collect.mjs';
import { buildEmail } from '../maintenance/notify.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('tracked packages load, merge across files and carry a documented version', () => {
  const tracked = loadTracked();
  assert.ok(tracked.length > 20, `only ${tracked.length} tracked packages`);
  for (const p of tracked) {
    assert.ok(['npm', 'PyPI', 'github'].includes(p.ecosystem), `${p.name}: bad ecosystem ${p.ecosystem}`);
    assert.ok(p.documented, `${p.name}: no documented version`);
    if (p.ecosystem === 'github') assert.ok(p.repo, `${p.name}: github entries need repo`);
  }
});

test('version helpers', () => {
  assert.ok(isStable('1.2.3'));
  assert.ok(!isStable('8.0.0-rc.30'));
  assert.equal(cmp('1.9.0', '1.10.0'), -1);
  assert.equal(cmp('v2.0.0', '2.0.0'), 0);
});

test('link extraction skips placeholders and local hosts', () => {
  const links = extractLinks('See https://docs.temporal.io/develop. Not http://localhost:3000 or https://{{wb.domain}}/x or https://example.com.');
  assert.deepEqual(links, ['https://docs.temporal.io/develop']);
});

test('stale verification dates are reported after 60 days', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wb-stale-'));
  const f = join(dir, 'SKILL.md');
  writeFileSync(f, '- a 1.0 (verified 2026-01-01, x)\n- b 2.0 (verified 2026-11-01, y)\n');
  const stale = staleVerifications([f], new Date('2026-11-05'));
  assert.equal(stale.length, 1);
  assert.equal(stale[0].date, '2026-01-01');
});

test('alert email only for high/critical unless digest is on', () => {
  const clean = { date: '2026-11-05', majorVulns: [], updates: [{ name: 'vite', from: '8.0.0', to: '8.3.6' }], needsAttention: true };
  assert.equal(buildEmail(clean), null);
  assert.match(buildEmail(clean, { digest: true }).subject, /1 update/);
  const bad = { ...clean, majorVulns: [{ package: 'npm:x@1.0.0', id: 'GHSA-1', severity: 'CRITICAL', summary: 'RCE <script>', url: 'https://osv.dev/vulnerability/GHSA-1' }] };
  const mail = buildEmail(bad, { prUrl: 'https://github.com/o/r/pull/1' });
  assert.match(mail.subject, /1 high\/critical vulnerability/);
  assert.ok(!mail.html.includes('<script>'), 'summary must be escaped');
  assert.match(mail.html, /pull\/1/);
});
