#!/usr/bin/env node
// Write a git-ignored .env.cloud with only the variables a cloud session should get. Prints names, never values.
//   node make-cloud-env.mjs --from-example | --keys A,B,C   [--repo <path>] [--exclude-prefix NEON_,PROD_,DEPLOY_]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseEnv(text) {
  const out = new Map();
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (m) out.set(m[1], m[2]);
  }
  return out;
}

export function selectKeys({ example, keys, excludePrefixes }) {
  const wanted = keys && keys.length ? keys : [...parseEnv(example).keys()];
  return wanted.filter((k) => !excludePrefixes.some((p) => k.startsWith(p)));
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const val = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
  const repo = resolve(val('--repo') || process.cwd());
  const excludePrefixes = (val('--exclude-prefix') || 'NEON_,PROD_,DEPLOY_,VERCEL_TOKEN,LIVEKIT_DEPLOY').split(',').filter(Boolean);
  const example = existsSync(join(repo, '.env.example')) ? readFileSync(join(repo, '.env.example'), 'utf8') : '';
  const keys = selectKeys({ example, keys: val('--keys') ? val('--keys').split(',') : null, excludePrefixes });
  const values = new Map();
  for (const f of ['.env', '.env.local']) if (existsSync(join(repo, f))) for (const [k, v] of parseEnv(readFileSync(join(repo, f), 'utf8'))) values.set(k, v);
  const present = keys.filter((k) => values.has(k) && values.get(k) !== '');
  const absent = keys.filter((k) => !present.includes(k));
  writeFileSync(join(repo, '.env.cloud'), `${present.map((k) => `${k}=${values.get(k)}`).join('\n')}\n`, { mode: 0o600 });
  process.stdout.write(`Wrote .env.cloud with ${present.length} variable(s): ${present.join(', ') || 'none'}\n`);
  if (absent.length) process.stdout.write(`No value found for: ${absent.join(', ')} (the cloud session will use mocks for these)\n`);
  process.stdout.write('Copy it with: pbcopy < .env.cloud   then paste into the cloud environment. Delete it afterwards: rm .env.cloud\n');
}
