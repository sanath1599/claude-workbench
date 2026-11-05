import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkRelease, parseEnvNames, sensitiveName } from '../../plugins/stack-mobile/skills/shipping-mobile-releases/scripts/check-release.mjs';

const SCRIPT = new URL('../../plugins/stack-mobile/skills/shipping-mobile-releases/scripts/check-release.mjs', import.meta.url).pathname;
const fx = (n) => new URL(`./fixtures/${n}`, import.meta.url).pathname;
const codes = (fs) => fs.map((f) => f.code);

test('a well formed project has no errors or warnings', () => {
  const f = checkRelease(fx('good'));
  assert.deepEqual(f.filter((x) => x.level !== 'info'), []);
});

test('a broken project reports each class of problem', () => {
  const f = checkRelease(fx('bad'));
  const c = codes(f);
  for (const want of ['no-runtime-version', 'no-production-profile', 'no-android-package', 'version-mismatch', 'no-scheme', 'remote-source-local-numbers', 'public-secret-name', 'no-submit-profile']) {
    assert.ok(c.includes(want), `missing ${want}; got ${c.join(',')}`);
  }
  assert.ok(f.some((x) => x.code === 'public-secret-name' && x.level === 'error'));
});

test('secret-looking names behind EXPO_PUBLIC_', () => {
  assert.equal(sensitiveName('EXPO_PUBLIC_STRIPE_SECRET_KEY'), 'error');
  assert.equal(sensitiveName('EXPO_PUBLIC_ADMIN_PASSWORD'), 'error');
  assert.equal(sensitiveName('EXPO_PUBLIC_SOME_API_KEY'), 'warn');
  assert.equal(sensitiveName('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY'), null);
  assert.equal(sensitiveName('EXPO_PUBLIC_SENTRY_DSN'), null);
  assert.equal(sensitiveName('EXPO_PUBLIC_API_URL'), null);
  assert.equal(sensitiveName('SERVER_SECRET'), null);
});

test('env file parsing reads names only', () => {
  assert.deepEqual(parseEnvNames('# c\nEXPO_PUBLIC_A=1\nexport B="x"\n\nnot a line\n'), ['EXPO_PUBLIC_A', 'B']);
});

test('env files in the project directory are scanned', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wb-mobile-'));
  try {
    cpSync(fx('good'), dir, { recursive: true });
    writeFileSync(join(dir, '.env.production'), 'EXPO_PUBLIC_AUTH_TOKEN=abc\n');
    const f = checkRelease(dir);
    assert.ok(f.some((x) => x.code === 'public-secret-name' && /\.env\.production/.test(x.message)));
    assert.ok(!JSON.stringify(f).includes('abc'), 'values must never be echoed');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a fixed runtime string and a dev-client production profile are caught', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wb-mobile-'));
  try {
    cpSync(fx('good'), dir, { recursive: true });
    const app = JSON.parse(JSON.stringify({ expo: { name: 'x', slug: 'x', version: '1.2.0', scheme: 'x', runtimeVersion: '1.0.0', updates: { url: 'u' }, ios: { bundleIdentifier: 'a.b' }, android: { package: 'a.b' }, extra: { eas: { projectId: 'p' } } } }));
    writeFileSync(join(dir, 'app.json'), JSON.stringify(app));
    writeFileSync(join(dir, 'eas.json'), JSON.stringify({ cli: { appVersionSource: 'remote' }, build: { preview: { channel: 'preview' }, production: { developmentClient: true, channel: 'production' } }, submit: { production: {} } }));
    const c = codes(checkRelease(dir));
    assert.ok(c.includes('manual-runtime-version'));
    assert.ok(c.includes('prod-dev-client'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a missing package.json is an error', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wb-mobile-'));
  try {
    assert.deepEqual(codes(checkRelease(dir)), ['no-package-json']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI exits 0 for good, 1 for bad, and prints JSON on request', () => {
  assert.equal(spawnSync('node', [SCRIPT, fx('good')]).status, 0);
  const bad = spawnSync('node', [SCRIPT, fx('bad'), '--json'], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.ok(Array.isArray(JSON.parse(bad.stdout)));
});
