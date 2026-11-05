#!/usr/bin/env node
// Installs the Starter Pack skills and house rules for the Codex CLI. Node 20+, no dependencies.
// Usage: node scripts/install-codex.mjs [--plugins a,b] [--codex-home <dir>] [--profile <file>] [--dry-run] [--uninstall]
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProfile, renderTokens } from '../plugins/workbench/scripts/lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGINS_DIR = join(ROOT, 'plugins');
const MARKER = '.starter-pack';
const RULES_START = '<!-- starter-pack:rules:start -->';
const RULES_END = '<!-- starter-pack:rules:end -->';
const EXCLUDED_BY_DEFAULT = new Set(['toolbelt', 'stack-connectors']);

function parseArgs(argv) {
  const o = { plugins: null, codexHome: null, profile: null, dryRun: false, uninstall: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--plugins') o.plugins = val().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--codex-home') o.codexHome = val();
    else if (a === '--profile') o.profile = val();
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--uninstall') o.uninstall = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  o.codexHome = resolve(o.codexHome || process.env.CODEX_HOME || join(homedir(), '.codex'));
  return o;
}

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function getProfile(file) {
  if (file) {
    const defaults = readJson(join(PLUGINS_DIR, 'workbench', 'profile.defaults.json'));
    return { source: file, profile: { ...defaults, ...readJson(resolve(file)) } };
  }
  const { source, profile } = loadProfile();
  return { source, profile };
}

function allPlugins() {
  return readdirSync(PLUGINS_DIR).filter((n) => existsSync(join(PLUGINS_DIR, n, '.claude-plugin', 'plugin.json'))).sort();
}

function collectSkills(pluginNames) {
  const byName = new Map();
  for (const plugin of pluginNames) {
    const dir = join(PLUGINS_DIR, plugin, 'skills');
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      const src = join(dir, name);
      if (!statSync(src).isDirectory() || !existsSync(join(src, 'SKILL.md'))) continue;
      if (byName.has(name)) {
        throw new Error(`Skill name collision: "${name}" exists in both ${byName.get(name).plugin} and ${plugin}. Skill names must be unique; install one of them with --plugins.`);
      }
      byName.set(name, { plugin, src });
    }
  }
  return byName;
}

function renderDir(dir, profile) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) renderDir(p, profile);
    else if (entry.name.endsWith('.md')) writeFileSync(p, renderTokens(readFileSync(p, 'utf8'), profile));
  }
}

function stripBlock(text) {
  const s = text.indexOf(RULES_START);
  const e = text.indexOf(RULES_END);
  if (s === -1 || e === -1 || e < s) return null;
  const before = text.slice(0, s).replace(/\n+$/, '');
  const after = text.slice(e + RULES_END.length).replace(/^\n+/, '');
  return [before, after].filter(Boolean).join('\n\n') + (before || after ? '\n' : '');
}

function withBlock(existing, rules) {
  const block = `${RULES_START}\n${rules.trim()}\n${RULES_END}`;
  const s = existing.indexOf(RULES_START);
  const e = existing.indexOf(RULES_END);
  if (s !== -1 && e !== -1 && e > s) return existing.slice(0, s) + block + existing.slice(e + RULES_END.length);
  const base = existing.replace(/\n+$/, '');
  return (base ? base + '\n\n' : '') + block + '\n';
}

function mcpSnippet() {
  const file = join(PLUGINS_DIR, 'stack-connectors', '.mcp.json');
  if (!existsSync(file)) return '';
  const servers = readJson(file).mcpServers || {};
  const lines = [
    '# Verify against the Codex docs before use (config keys may differ by version).',
    '# Add to ~/.codex/config.toml. Remote servers need Codex MCP support for streamable HTTP and OAuth.',
  ];
  for (const [name, s] of Object.entries(servers)) {
    lines.push('', `[mcp_servers.${name}]`);
    if (s.url) lines.push(`url = "${s.url}"`);
    else {
      lines.push(`command = "${s.command}"`);
      lines.push(`args = [${(s.args || []).map((a) => `"${a}"`).join(', ')}]`);
    }
  }
  return lines.join('\n');
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  const log = (m) => console.log((o.dryRun ? '[dry-run] ' : '') + m);
  const skillsDir = join(o.codexHome, 'skills');
  const agentsFile = join(o.codexHome, 'AGENTS.md');

  if (o.uninstall) {
    if (existsSync(skillsDir)) {
      for (const name of readdirSync(skillsDir).sort()) {
        const d = join(skillsDir, name);
        if (statSync(d).isDirectory() && existsSync(join(d, MARKER))) {
          log(`remove skill ${name}`);
          if (!o.dryRun) rmSync(d, { recursive: true, force: true });
        }
      }
    }
    if (existsSync(agentsFile)) {
      const stripped = stripBlock(readFileSync(agentsFile, 'utf8'));
      if (stripped !== null) {
        log(`remove rules block from ${agentsFile}`);
        if (!o.dryRun) writeFileSync(agentsFile, stripped);
      }
    }
    return;
  }

  const available = allPlugins();
  const selected = o.plugins || available.filter((n) => !EXCLUDED_BY_DEFAULT.has(n));
  for (const p of selected) if (!available.includes(p)) throw new Error(`Unknown plugin: ${p}. Available: ${available.join(', ')}`);
  const skills = collectSkills(selected);
  const { source, profile } = getProfile(o.profile);
  log(`profile: ${source}`);
  log(`codex home: ${o.codexHome}`);

  let installed = 0;
  const skipped = [];
  for (const [name, { plugin, src }] of skills) {
    const dest = join(skillsDir, name);
    if (existsSync(dest) && !existsSync(join(dest, MARKER))) {
      skipped.push(name);
      log(`skip ${name}: ${dest} exists without a ${MARKER} marker`);
      continue;
    }
    log(`install skill ${name} (${plugin})`);
    installed++;
    if (o.dryRun) continue;
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(skillsDir, { recursive: true });
    cpSync(src, dest, { recursive: true, filter: (p) => !p.includes('node_modules') });
    renderDir(dest, profile);
    writeFileSync(join(dest, MARKER), JSON.stringify({ plugin, installedBy: 'scripts/install-codex.mjs' }) + '\n');
  }

  const rulesFile = join(PLUGINS_DIR, 'workbench', 'rules.md');
  if (existsSync(rulesFile)) {
    log(`write rules block into ${agentsFile}`);
    if (!o.dryRun) {
      mkdirSync(o.codexHome, { recursive: true });
      const existing = existsSync(agentsFile) ? readFileSync(agentsFile, 'utf8') : '';
      writeFileSync(agentsFile, withBlock(existing, renderTokens(readFileSync(rulesFile, 'utf8'), profile)));
    }
  }

  console.log(`\n${installed} skill(s) ${o.dryRun ? 'would be ' : ''}installed, ${skipped.length} skipped${skipped.length ? ` (${skipped.join(', ')})` : ''}.`);
  const snippet = mcpSnippet();
  if (snippet) console.log(`\nMCP servers (not written automatically):\n\n${snippet}\n`);
}

try {
  main();
} catch (err) {
  console.error(`install-codex: ${err.message}`);
  process.exit(1);
}
