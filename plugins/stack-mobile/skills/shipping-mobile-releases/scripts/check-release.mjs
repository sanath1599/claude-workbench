#!/usr/bin/env node
// Static release-readiness check for an Expo app. Node 18+, stdlib only.
//   node check-release.mjs [project-dir] [--json]
// Reads app.json (or app.config.json), eas.json, package.json and .env* files.
// Exit code 1 when any finding has level "error".
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};

const HARD = /(SECRET|PRIVATE|PASSWORD|PASSWD|SERVICE_ROLE|CLIENT_SECRET|ACCESS_TOKEN|AUTH_TOKEN|REFRESH_TOKEN|CREDENTIAL|SIGNING)/i;
const SOFT = /(TOKEN|API_?KEY|_KEY$)/i;
const PUBLIC_OK = /(PUBLISHABLE|ANON|PUBLIC_KEY|DSN|CLIENT_ID|PROJECT_ID|APP_ID|MEASUREMENT|SITE_KEY)/i;

export function sensitiveName(name) {
  if (!name.startsWith('EXPO_PUBLIC_')) return null;
  const rest = name.slice('EXPO_PUBLIC_'.length);
  if (HARD.test(rest)) return 'error';
  if (SOFT.test(rest) && !PUBLIC_OK.test(rest)) return 'warn';
  return null;
}

export function parseEnvNames(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

export function checkRelease(dir) {
  const findings = [];
  const add = (level, code, message) => findings.push({ level, code, message });
  const root = resolve(dir);

  const pkg = readJson(join(root, 'package.json'));
  if (!pkg) {
    add('error', 'no-package-json', 'package.json not found or invalid');
    return findings;
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (!deps.expo) add('error', 'not-expo', 'expo is not a dependency; this check is for Expo apps');

  let app = null;
  let dynamic = false;
  for (const f of ['app.json', 'app.config.json']) {
    if (existsSync(join(root, f))) {
      app = readJson(join(root, f));
      break;
    }
  }
  if (!app) {
    for (const f of ['app.config.ts', 'app.config.js']) {
      if (existsSync(join(root, f))) dynamic = true;
    }
    if (dynamic) add('warn', 'dynamic-config', 'app.config.ts/js is dynamic and not evaluated; run `npx expo config --type public` and check its output by hand');
    else add('error', 'no-app-config', 'no app.json or app.config found');
  }
  const expo = app ? app.expo || app : null;

  if (expo) {
    if (!expo.version) add('error', 'no-version', 'expo.version is missing');
    else if (pkg.version && pkg.version !== expo.version) add('warn', 'version-mismatch', `package.json version ${pkg.version} differs from expo.version ${expo.version}`);
    if (!expo.ios?.bundleIdentifier) add('error', 'no-bundle-id', 'ios.bundleIdentifier is missing');
    if (!expo.android?.package) add('error', 'no-android-package', 'android.package is missing');
    if (!expo.scheme) add('warn', 'no-scheme', 'no scheme set; deep links and OAuth redirects need one, and it cannot change over the air');
    if (!expo.owner && !expo.extra?.eas?.projectId) add('warn', 'no-eas-project', 'extra.eas.projectId missing; run `eas init`');

    if (deps['expo-updates']) {
      const rv = expo.runtimeVersion ?? expo.ios?.runtimeVersion ?? expo.android?.runtimeVersion;
      if (rv === undefined) add('error', 'no-runtime-version', 'expo-updates is installed but runtimeVersion is not set; use a policy such as { "policy": "fingerprint" }');
      else if (typeof rv === 'string') add('warn', 'manual-runtime-version', `runtimeVersion is the fixed string "${rv}"; a policy (fingerprint or appVersion) prevents incompatible updates`);
      else if (rv && !['fingerprint', 'appVersion', 'nativeVersion', 'sdkVersion'].includes(rv.policy)) add('error', 'bad-runtime-policy', `unknown runtimeVersion policy "${rv.policy}"`);
      else if (rv?.policy === 'nativeVersion' || rv?.policy === 'sdkVersion') add('warn', 'weak-runtime-policy', `runtimeVersion policy "${rv.policy}" can match builds with different native code; fingerprint is safer`);
      if (!expo.updates?.url) add('warn', 'no-updates-url', 'updates.url is missing; run `eas update:configure`');
    } else {
      add('info', 'no-expo-updates', 'expo-updates is not installed; over-the-air updates are not available');
    }
  }

  const eas = readJson(join(root, 'eas.json'));
  if (!eas) {
    add('error', 'no-eas-json', 'eas.json not found; run `eas build:configure`');
  } else {
    const profiles = eas.build || {};
    const prod = profiles.production;
    if (!prod) add('error', 'no-production-profile', 'eas.json has no "production" build profile');
    else {
      if (prod.developmentClient) add('error', 'prod-dev-client', 'production profile has developmentClient: true');
      if (prod.distribution === 'internal') add('warn', 'prod-internal', 'production profile uses distribution "internal"; store builds use "store"');
      if (deps['expo-updates'] && !prod.channel && !extendsChannel(profiles, 'production')) add('warn', 'prod-no-channel', 'production profile has no channel; over-the-air updates cannot target it');
      const source = eas.cli?.appVersionSource;
      if (source !== 'remote' && !prod.autoIncrement) add('warn', 'no-auto-increment', 'production does not auto-increment build numbers; set cli.appVersionSource to "remote" or autoIncrement: true');
    }
    if (eas.cli?.appVersionSource === 'remote' && (expo?.ios?.buildNumber || expo?.android?.versionCode)) add('warn', 'remote-source-local-numbers', 'appVersionSource is remote but app config sets buildNumber/versionCode; the remote values win, remove the local ones to avoid confusion');
    const preview = profiles.preview;
    if (!preview) add('warn', 'no-preview-profile', 'no "preview" build profile for internal testing');
    else if (deps['expo-updates'] && !preview.channel && !extendsChannel(profiles, 'preview')) add('warn', 'preview-no-channel', 'preview profile has no channel');
    if (!profiles.development) add('info', 'no-development-profile', 'no "development" profile; add one with developmentClient: true if you use a dev build');
    if (!eas.submit?.production) add('warn', 'no-submit-profile', 'eas.json has no submit.production profile');
    if (!eas.cli?.appVersionSource) add('info', 'no-app-version-source', 'cli.appVersionSource is unset; set it explicitly ("remote" is recommended)');

    for (const [name, p] of Object.entries(profiles)) {
      for (const k of Object.keys(p?.env || {})) {
        const level = sensitiveName(k);
        if (level) add(level, 'public-secret-name', `eas.json build.${name}.env sets ${k}; EXPO_PUBLIC_ values ship in the app bundle`);
      }
    }
  }

  let envFiles = [];
  try {
    envFiles = readdirSync(root).filter((f) => f === '.env' || f.startsWith('.env.'));
  } catch {
    // unreadable directory: skip env scan
  }
  for (const f of envFiles) {
    let names = [];
    try {
      names = parseEnvNames(readFileSync(join(root, f), 'utf8'));
    } catch {
      continue;
    }
    for (const n of names) {
      const level = sensitiveName(n);
      if (level) add(level, 'public-secret-name', `${f} defines ${n}; EXPO_PUBLIC_ values ship in the app bundle`);
    }
  }

  return findings;
}

function extendsChannel(profiles, name) {
  const seen = new Set();
  let cur = profiles[name];
  while (cur?.extends && !seen.has(cur.extends)) {
    seen.add(cur.extends);
    cur = profiles[cur.extends];
    if (cur?.channel) return true;
  }
  return false;
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const dir = args.find((a) => !a.startsWith('--')) || '.';
  const findings = checkRelease(dir);
  if (json) console.log(JSON.stringify(findings, null, 2));
  else {
    for (const f of findings) console.log(`${f.level.toUpperCase().padEnd(5)} ${f.code}: ${f.message}`);
    const errors = findings.filter((f) => f.level === 'error').length;
    const warns = findings.filter((f) => f.level === 'warn').length;
    console.log(`${errors} error(s), ${warns} warning(s)`);
  }
  process.exit(findings.some((f) => f.level === 'error') ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
