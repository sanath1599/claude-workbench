#!/usr/bin/env node
// Bump a plugin's semver and record it: node scripts/bump-version.mjs <plugin> patch|minor|major ["note"]
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function bump(version, level) {
  const [major, minor, patch] = String(version || '0.0.0').split('.').map((n) => Number.parseInt(n, 10) || 0);
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [plugin, level = 'patch', ...noteParts] = process.argv.slice(2);
  const manifest = join(ROOT, 'plugins', plugin || '', '.claude-plugin', 'plugin.json');
  if (!plugin || !existsSync(manifest) || !['patch', 'minor', 'major'].includes(level)) {
    process.stderr.write('usage: node scripts/bump-version.mjs <plugin> patch|minor|major ["note"]\n');
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(manifest, 'utf8'));
  const from = data.version;
  data.version = bump(from, level);
  writeFileSync(manifest, `${JSON.stringify(data, null, 2)}\n`);
  const note = noteParts.join(' ');
  const changelog = join(ROOT, 'CHANGELOG.md');
  if (!existsSync(changelog)) writeFileSync(changelog, '# Changelog\n\n');
  appendFileSync(changelog, `- ${new Date().toISOString().slice(0, 10)} · ${plugin} ${from} → ${data.version}${note ? ` · ${note}` : ''}\n`);
  process.stdout.write(`${plugin}: ${from} -> ${data.version}\n`);
}
