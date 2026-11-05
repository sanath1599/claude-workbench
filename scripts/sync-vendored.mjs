#!/usr/bin/env node
// Refresh the third-party skills bundled in plugins/toolbelt from their upstream packages (all MIT):
//   graphify (PyPI graphifyy) · MulmoTerminal skills (npm mulmoterminal) · reverse-engineer-anything (npm rea-agents)
//   node scripts/sync-vendored.mjs [--only graphify,mulmoterminal,rea] [--dry-run]
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = join(ROOT, 'plugins', 'toolbelt');
const SKILLS = join(PLUGIN, 'skills');
const LICENSES = join(PLUGIN, 'licenses');
const MANIFEST = join(PLUGIN, 'VENDORED.json');
// Frontmatter keys Claude Code understands; others are dropped so strict validation passes.
const KEEP_KEYS = new Set(['name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable', 'allowed-tools', 'disallowed-tools', 'model', 'effort', 'context', 'agent', 'hooks', 'paths', 'shell', 'metadata', 'license', 'compatibility']);

const sh = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 }).trim();

export function cleanFrontmatter(text, extraNote) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return text;
  const out = [];
  let keep = true;
  for (const line of m[1].split('\n')) {
    const key = /^([A-Za-z_-]+):/.exec(line)?.[1];
    if (key) keep = KEEP_KEYS.has(key);
    if (keep) out.push(line);
  }
  const body = text.slice(m[0].length);
  return `---\n${out.join('\n')}\n---\n${extraNote ? `\n<!-- ${extraNote} -->\n` : ''}${body}`;
}

function npmPack(pkg, version, work) {
  const file = sh('npm', ['pack', `${pkg}@${version}`, '--silent'], work).split('\n').pop();
  const dir = join(work, pkg.replace(/[^a-z0-9]/gi, '_'));
  mkdirSync(dir, { recursive: true });
  sh('tar', ['-xzf', join(work, file), '-C', dir]);
  const v = JSON.parse(readFileSync(join(dir, 'package', 'package.json'), 'utf8')).version;
  return { root: join(dir, 'package'), version: v };
}

function copySkill(from, name, note) {
  const dest = join(SKILLS, name);
  rmSync(dest, { recursive: true, force: true });
  cpSync(from, dest, { recursive: true });
  const skill = join(dest, 'SKILL.md');
  writeFileSync(skill, cleanFrontmatter(readFileSync(skill, 'utf8'), note));
}

function syncMulmo(work, version) {
  const { root, version: v } = npmPack('mulmoterminal', version, work);
  const src = join(root, 'server', 'skills');
  const names = readdirSync(src).filter((n) => existsSync(join(src, n, 'SKILL.md')));
  for (const n of names) copySkill(join(src, n), n, `Vendored from mulmoterminal ${v} (MIT, https://github.com/receptron/mulmoterminal). Refresh with node scripts/sync-vendored.mjs.`);
  cpSync(join(root, 'LICENSE'), join(LICENSES, 'mulmoterminal.LICENSE'));
  return { package: 'mulmoterminal', ecosystem: 'npm', version: v, skills: names };
}

function syncRea(work, version) {
  const { root, version: v } = npmPack('rea-agents', version, work);
  copySkill(join(root, 'skills', 'reverse-engineer-anything'), 'reverse-engineer-anything', `Vendored from rea-agents ${v} (MIT, https://github.com/morluto/rea). Refresh with node scripts/sync-vendored.mjs.`);
  cpSync(join(root, 'LICENSE'), join(LICENSES, 'rea.LICENSE'));
  return { package: 'rea-agents', ecosystem: 'npm', version: v, skills: ['reverse-engineer-anything'] };
}

function syncGraphify(work, version) {
  const spec = version === 'latest' ? 'graphifyy' : `graphifyy==${version}`;
  sh('python3', ['-m', 'pip', 'download', spec, '--no-deps', '--only-binary=:all:', '-d', work, '-q']);
  const wheel = readdirSync(work).find((f) => /^graphifyy-.*\.whl$/.test(f));
  const v = /^graphifyy-([^-]+)-/.exec(wheel)[1];
  const dir = join(work, 'graphify-wheel');
  mkdirSync(dir, { recursive: true });
  sh('python3', ['-c', `import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])`, join(work, wheel), dir]);
  const tmpSkill = join(work, 'graphify-skill');
  mkdirSync(tmpSkill, { recursive: true });
  cpSync(join(dir, 'graphify', 'skill.md'), join(tmpSkill, 'SKILL.md'));
  copySkill(tmpSkill, 'graphify', `Vendored from graphifyy ${v} (MIT, https://github.com/safishamsi/graphify). Needs the CLI: pipx install graphifyy. Refresh with node scripts/sync-vendored.mjs.`);
  const lic = readdirSync(dir).filter((d) => d.endsWith('.dist-info')).map((d) => join(dir, d)).flatMap((d) => [join(d, 'LICENSE'), join(d, 'licenses', 'LICENSE'), join(d, 'LICENSE.txt')]).find(existsSync);
  if (lic) cpSync(lic, join(LICENSES, 'graphify.LICENSE'));
  return { package: 'graphifyy', ecosystem: 'PyPI', version: v, skills: ['graphify'] };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : ['graphify', 'mulmoterminal', 'rea'];
  const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
  const want = (k, d) => (args.includes(`--${k}-version`) ? args[args.indexOf(`--${k}-version`) + 1] : d);
  mkdirSync(SKILLS, { recursive: true });
  mkdirSync(LICENSES, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), 'wb-vendor-'));
  try {
    if (only.includes('mulmoterminal')) manifest.mulmoterminal = syncMulmo(work, want('mulmoterminal', 'latest'));
    if (only.includes('rea')) manifest.rea = syncRea(work, want('rea', 'latest'));
    if (only.includes('graphify')) manifest.graphify = syncGraphify(work, want('graphify', 'latest'));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  manifest.synced = new Date().toISOString().slice(0, 10);
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  for (const k of ['graphify', 'mulmoterminal', 'rea']) if (manifest[k]) process.stdout.write(`${manifest[k].package} ${manifest[k].version}: ${manifest[k].skills.join(', ')}\n`);
}
