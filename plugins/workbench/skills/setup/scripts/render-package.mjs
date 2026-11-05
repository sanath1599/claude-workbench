#!/usr/bin/env node
// Render a personalised copy of the workbench marketplace.
//   node render-package.mjs --profile <profile.json> [--out <dir>] [--source <dir>]
//                           [--name <marketplace-name>] [--plugins a,b] [--dry-run] [--locate]
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTokens } from '../../../scripts/lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXCLUDE = new Set(['.git', 'node_modules', 'tests', '.github', 'results', 'out']);
const RENDER_EXT = /\.(?:md|tmpl|txt)$/i;

function hasMarketplace(dir) {
  return existsSync(join(dir, '.claude-plugin', 'marketplace.json'));
}

/** Find the marketplace root: walk up from this script, then installed marketplaces. */
export function locateSource(explicit) {
  if (explicit) return hasMarketplace(resolve(explicit)) ? resolve(explicit) : null;
  let dir = HERE;
  for (let i = 0; i < 8; i += 1) {
    if (hasMarketplace(dir)) return dir;
    dir = dirname(dir);
  }
  const installed = join(homedir(), '.claude', 'plugins', 'marketplaces');
  if (existsSync(installed)) {
    for (const name of readdirSync(installed)) {
      const root = join(installed, name);
      try {
        const mk = JSON.parse(readFileSync(join(root, '.claude-plugin', 'marketplace.json'), 'utf8'));
        if ((mk.plugins || []).some((p) => p.name === 'workbench')) return root;
      } catch {
        /* not a marketplace we know */
      }
    }
  }
  return null;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

export function renderPackage({ source, out, profile, name, plugins, dryRun = false }) {
  const marketplace = JSON.parse(readFileSync(join(source, '.claude-plugin', 'marketplace.json'), 'utf8'));
  const wanted = plugins && plugins.length ? new Set(plugins) : null;
  const keptPlugins = marketplace.plugins.filter((p) => !wanted || wanted.has(p.name));
  if (!keptPlugins.some((p) => p.name === 'workbench')) {
    keptPlugins.unshift(marketplace.plugins.find((p) => p.name === 'workbench'));
  }
  const pluginDirs = new Set(keptPlugins.map((p) => String(p.source).replace(/^\.\//, '')));
  const files = walk(source).filter((f) => {
    const rel = relative(source, f);
    if (!rel.startsWith('plugins/')) return true;
    const dir = rel.split('/').slice(0, 2).join('/');
    return pluginDirs.has(dir);
  });

  let rendered = 0;
  if (!dryRun) {
    if (existsSync(out)) rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
  }
  for (const file of files) {
    const rel = relative(source, file);
    const dest = join(out, rel);
    if (dryRun) {
      if (RENDER_EXT.test(file) && /\{\{\s*wb\./.test(readFileSync(file, 'utf8'))) rendered += 1;
      continue;
    }
    mkdirSync(dirname(dest), { recursive: true });
    if (RENDER_EXT.test(file)) {
      const text = readFileSync(file, 'utf8');
      const next = renderTokens(text, profile);
      if (next !== text) rendered += 1;
      writeFileSync(dest, next);
    } else {
      cpSync(file, dest);
    }
  }

  const finalName = name || `${profile.github_owner || 'my'}-workbench`;
  const nextMarketplace = {
    ...marketplace,
    name: finalName,
    owner: { name: profile.owner_name || marketplace.owner?.name || 'owner', ...(profile.owner_email ? { email: profile.owner_email } : {}) },
    description: `${marketplace.description} Personalised for ${profile.owner_name || finalName}.`,
    plugins: keptPlugins,
  };
  if (!dryRun) {
    writeFileSync(join(out, '.claude-plugin', 'marketplace.json'), `${JSON.stringify(nextMarketplace, null, 2)}\n`);
    writeFileSync(join(out, 'plugins', 'workbench', 'profile.defaults.json'), `${JSON.stringify({ ...profile, personalised: true }, null, 2)}\n`);
    writeFileSync(
      join(out, 'PERSONALISED.md'),
      `# Personalised workbench\n\nRendered ${new Date().toISOString()} from ${source} for ${profile.owner_name || finalName}.\nMarketplace name: \`${finalName}\`. Plugins: ${keptPlugins.map((p) => p.name).join(', ')}.\nRe-render with \`/workbench:setup --refresh\`.\n`,
    );
  }
  return { out, name: finalName, plugins: keptPlugins.map((p) => p.name), files: files.length, rendered };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run' || a === '--locate' || a === '--help') args[a.slice(2)] = true;
    else if (a.startsWith('--')) args[a.slice(2)] = argv[(i += 1)];
  }
  return args;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write('render-package.mjs --profile <file> [--out <dir>] [--source <dir>] [--name <marketplace>] [--plugins a,b] [--dry-run] [--locate]\n');
    process.exit(0);
  }
  const source = locateSource(args.source);
  if (args.locate) {
    process.stdout.write(`${source || ''}\n`);
    process.exit(source ? 0 : 1);
  }
  if (!source) {
    process.stderr.write('Could not find the workbench marketplace source. Pass --source <dir> (a clone of the workbench repo).\n');
    process.exit(1);
  }
  const profilePath = (args.profile || join(homedir(), '.claude', 'workbench', 'profile.json')).replace(/^~/, homedir());
  if (!existsSync(profilePath)) {
    process.stderr.write(`Profile not found: ${profilePath}\n`);
    process.exit(1);
  }
  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  const out = resolve((args.out || join(homedir(), '.claude', 'workbench', 'package')).replace(/^~/, homedir()));
  if (out === source) {
    process.stderr.write('Refusing to render over the source marketplace.\n');
    process.exit(1);
  }
  const result = renderPackage({ source, out, profile, name: args.name, plugins: args.plugins ? args.plugins.split(',').map((s) => s.trim()).filter(Boolean) : null, dryRun: Boolean(args['dry-run']) });
  process.stdout.write(`${args['dry-run'] ? 'Would render' : 'Rendered'} ${result.plugins.length} plugins (${result.files} files, ${result.rendered} personalised) as marketplace "${result.name}" at ${result.out}\n`);
}
