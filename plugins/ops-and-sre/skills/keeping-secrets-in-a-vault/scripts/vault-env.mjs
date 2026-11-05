#!/usr/bin/env node
// Vault helper. Node 20+, no dependencies. Never prints values: only variable names and counts.
//   node vault-env.mjs check
//   node vault-env.mjs diff-keys [--file secrets/dev.env] [--example .env.example]
//   node vault-env.mjs sync-github --repo owner/repo [--env name] [--file secrets/dev.env] [--only A,B] [--apply]
//   node vault-env.mjs sync-vercel --env production [--file secrets/prod.env] [--only A,B] [--apply]
// Sync commands are dry-run unless --apply is given. Values travel on stdin of the child process.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Default command runner. Returns { status, stdout, stderr }. Values only ever go in `input`. */
export function defaultRun(cmd, args, { input, cwd } = {}) {
  const r = spawnSync(cmd, args, { input, cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
  if (r.error) return { status: r.error.code === 'ENOENT' ? 127 : 1, stdout: '', stderr: String(r.error.code || r.error.message) };
  return { status: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/** Parse dotenv text into a Map of name -> value. */
export function parseEnv(text) {
  const out = new Map();
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) v = v.slice(1, -1);
    out.set(m[1], v);
  }
  return out;
}

/** Variable names declared in a dotenv-style example file. */
export function exampleNames(text) {
  return [...parseEnv(text).keys()];
}

/** Decrypt an encrypted env file in memory through `sops`. Returns Map or throws (message has no values). */
export function decryptEnv(file, run = defaultRun) {
  const r = run('sops', ['decrypt', '--input-type', 'dotenv', '--output-type', 'dotenv', file]);
  if (r.status !== 0) throw new Error(`sops could not decrypt ${file} (exit ${r.status})`);
  return parseEnv(r.stdout);
}

export function diffNames(expected, actual) {
  const a = new Set(actual);
  const e = new Set(expected);
  return { missing: [...e].filter((n) => !a.has(n)).sort(), extra: [...a].filter((n) => !e.has(n)).sort() };
}

/** Check tools and .sops.yaml. Returns [{name, ok, detail}]. Detail never contains key material. */
export function check({ run = defaultRun, cwd = process.cwd(), exists = existsSync, read = (p) => readFileSync(p, 'utf8') } = {}) {
  const results = [];
  const tool = (name, cmd, args, required) => {
    const r = run(cmd, args);
    const ok = r.status === 0;
    const version = ok ? (/\d+\.\d+\.\d+/.exec(r.stdout + r.stderr) || [''])[0] : '';
    results.push({ name, ok: ok || !required, detail: ok ? `found ${version}`.trim() : required ? 'missing' : 'not installed (optional)' });
  };
  tool('sops', 'sops', ['--version'], true);
  tool('age', 'age', ['--version'], true);
  tool('age-keygen', 'age-keygen', ['--version'], true);
  tool('infisical', 'infisical', ['--version'], false);
  tool('bao', 'bao', ['version'], false);

  const keyFile = process.env.SOPS_AGE_KEY_FILE;
  results.push({ name: 'SOPS_AGE_KEY_FILE', ok: Boolean(keyFile) && exists(keyFile), detail: keyFile ? (exists(keyFile) ? 'set, file exists' : 'set, file missing') : 'not set' });
  if (keyFile && cwd && keyFile.startsWith(cwd + '/')) results.push({ name: 'key location', ok: false, detail: 'age key file is inside the repo; move it outside' });

  const cfg = join(cwd, '.sops.yaml');
  if (!exists(cfg)) {
    results.push({ name: '.sops.yaml', ok: false, detail: 'missing' });
  } else {
    const t = read(cfg);
    const rules = (t.match(/path_regex:/g) || []).length;
    const recipients = (t.match(/age1[a-z0-9]{20,}/g) || []).length;
    results.push({ name: '.sops.yaml', ok: /creation_rules:/.test(t) && rules > 0, detail: `${rules} rule(s), ${recipients} age recipient(s)` });
    results.push({ name: 'no private key in config', ok: !/AGE-SECRET-KEY-/.test(t), detail: /AGE-SECRET-KEY-/.test(t) ? 'private key found in .sops.yaml' : 'ok' });
  }
  const gi = join(cwd, '.gitignore');
  const giText = exists(gi) ? read(gi) : '';
  results.push({ name: '.gitignore covers .env', ok: /^\.env\*?$|^\.env\.\*$/m.test(giText), detail: /^\.env/m.test(giText) ? 'ok' : 'add .env and .env.*' });
  return results;
}

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') opts.apply = true;
    else if (a.startsWith('--')) opts[a.slice(2)] = argv[++i];
    else opts._.push(a);
  }
  return opts;
}

function selectNames(env, only) {
  const names = [...env.keys()];
  if (!only) return names;
  const want = new Set(String(only).split(',').map((s) => s.trim()).filter(Boolean));
  return names.filter((n) => want.has(n));
}

/** Push each variable to a platform CLI via stdin. Dry-run unless apply. Returns { planned, set, failed }. */
export function syncEach(env, names, build, { apply, run }) {
  const res = { planned: names.slice(), set: [], failed: [] };
  if (!apply) return res;
  for (const name of names) {
    const { cmd, args } = build(name);
    const r = run(cmd, args, { input: env.get(name) });
    (r.status === 0 ? res.set : res.failed).push(name);
  }
  return res;
}

export function buildGithub(repo, env) {
  return (name) => ({ cmd: 'gh', args: ['secret', 'set', name, '--repo', repo, ...(env ? ['--env', env] : [])] });
}

export function buildVercel(target) {
  return (name) => ({ cmd: 'vercel', args: ['env', 'add', name, target, '--sensitive', '--force', '--yes'] });
}

function report(label, res, apply, print) {
  print(`${label}: ${res.planned.length} variable(s) ${apply ? 'processed' : 'planned (dry run, pass --apply to execute)'}`);
  for (const n of res.planned) print(`  ${res.failed.includes(n) ? 'FAILED' : res.set.includes(n) ? 'set   ' : 'plan  '} ${n}`);
}

export function main(argv, { run = defaultRun, cwd = process.cwd(), log = console.log } = {}) {
  const [cmd, ...rest] = argv;
  const o = parseArgs(rest);
  const print = (s) => log(s);
  try {
    if (cmd === 'check') {
      const results = check({ run, cwd });
      for (const r of results) print(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}: ${r.detail}`);
      return results.every((r) => r.ok) ? 0 : 1;
    }
    if (cmd === 'diff-keys') {
      const example = join(cwd, o.example || '.env.example');
      const file = o.file || 'secrets/dev.env';
      if (!existsSync(example)) { print(`missing ${o.example || '.env.example'}`); return 2; }
      const actual = decryptEnv(file, run);
      const { missing, extra } = diffNames(exampleNames(readFileSync(example, 'utf8')), actual.keys());
      print(`vault has ${actual.size} name(s); missing from vault: ${missing.length}; not in example: ${extra.length}`);
      for (const n of missing) print(`  missing ${n}`);
      for (const n of extra) print(`  extra   ${n}`);
      return missing.length ? 1 : 0;
    }
    if (cmd === 'sync-github') {
      if (!/^[\w.-]+\/[\w.-]+$/.test(o.repo || '')) { print('--repo owner/repo is required'); return 2; }
      const env = decryptEnv(o.file || 'secrets/dev.env', run);
      const names = selectNames(env, o.only);
      const res = syncEach(env, names, buildGithub(o.repo, o.env), { apply: o.apply, run });
      report(`github ${o.repo}${o.env ? ` (${o.env})` : ''}`, res, o.apply, print);
      return res.failed.length ? 1 : 0;
    }
    if (cmd === 'sync-vercel') {
      if (!['production', 'preview', 'development'].includes(o.env)) { print('--env production|preview|development is required'); return 2; }
      const env = decryptEnv(o.file || `secrets/${o.env === 'production' ? 'prod' : 'dev'}.env`, run);
      const names = selectNames(env, o.only);
      const res = syncEach(env, names, buildVercel(o.env), { apply: o.apply, run });
      report(`vercel ${o.env}`, res, o.apply, print);
      return res.failed.length ? 1 : 0;
    }
  } catch (e) {
    print(String(e.message));
    return 1;
  }
  print('usage: vault-env.mjs check | diff-keys | sync-github --repo o/r | sync-vercel --env production  [--file F] [--only A,B] [--apply]');
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
