#!/usr/bin/env node
// Copy what a cloud session needs into a repo, because cloud sessions don't load plugins.
//   node vendor-cloud-kit.mjs --repo <path> [--skills plugin:skill,...] [--dry-run]
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { locatePlugin, locateSkill } from './locate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MARK = '.claude/hooks/workbench/';

/** Dependency name (regex) -> skills worth vendoring. */
export const DEPENDENCY_SKILLS = [
  [/^@tanstack\//, ['stack-web:building-tanstack-frontends']],
  [/^next$/, ['stack-web:working-in-nextjs-16']],
  [/^resend$/, ['stack-web:sending-email-with-resend']],
  [/^(?:prisma|@prisma\/client|sqlalchemy|alembic|psycopg|asyncpg|pg)$/, ['stack-python:modeling-data-in-postgres']],
  [/^(?:pydantic-ai|pydantic-ai-slim)$/, ['stack-python:building-pydantic-ai-agents']],
  [/^(?:temporalio|@temporalio\/client)$/, ['stack-python:orchestrating-with-temporal']],
  [/^(?:qdrant-client|@qdrant\/js-client-rest)$/, ['stack-python:searching-with-qdrant']],
  [/^(?:livekit-agents|@livekit\/agents)$/, ['stack-python:building-voice-agents']],
  [/^fastapi$/, ['stack-python:building-fastapi-services']],
  [/^(?:ollama|anthropic|@anthropic-ai\/sdk|openai)$/, ['stack-python:calling-llms-reliably']],
  [/^(?:react|react-dom)$/, ['workbench:using-sileo-toasts', 'design-studio:designing-without-ai-slop']],
];
export const ALWAYS = ['workbench:committing-and-pushing', 'workbench:handling-secrets', 'engineering-craft:planning-tests', 'workflow:verifying-before-done', 'workflow:debugging-systematically'];

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function dependencyNames(repo) {
  const names = new Set();
  const dirs = [repo, ...readdirSync(repo, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules').map((d) => join(repo, d.name))];
  for (const dir of dirs) {
    const pkg = readJson(join(dir, 'package.json'));
    if (pkg) for (const n of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) names.add(n);
    for (const f of ['pyproject.toml', 'requirements.txt']) {
      const p = join(dir, f);
      if (!existsSync(p)) continue;
      for (const m of readFileSync(p, 'utf8').matchAll(/["'\n]\s*([A-Za-z][A-Za-z0-9_.-]*)(?:\[[^\]]*\])?\s*(?:[<>=~!]=?|["'])/g)) names.add(m[1].toLowerCase());
    }
  }
  return names;
}

export function chooseSkills(deps, explicit) {
  if (explicit && explicit.length) return [...new Set(explicit)];
  const out = new Set(ALWAYS);
  for (const name of deps) for (const [re, skills] of DEPENDENCY_SKILLS) if (re.test(name)) skills.forEach((s) => out.add(s));
  return [...out];
}

function loadProfile(workbenchDir) {
  const defaults = readJson(join(workbenchDir, 'profile.defaults.json')) || {};
  const personal = readJson(join(homedir(), '.claude', 'workbench', 'profile.json')) || {};
  const profile = { ...defaults, ...personal };
  // A repo copy never carries personal addresses.
  delete profile.owner_email;
  delete profile.git_author_email;
  return profile;
}

function render(text, profile) {
  return String(text).replace(/\{\{\s*wb\.([a-z0-9_]+)\s*\}\}/gi, (whole, key) => {
    const v = profile[key];
    if (v === undefined || v === null || v === '') return `(${key}: see the owner)`;
    return Array.isArray(v) ? v.join(', ') : String(v);
  });
}

function copyRendered(src, dest, profile, writes) {
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const d = join(dest, entry);
    if (statSync(s).isDirectory()) copyRendered(s, d, profile, writes);
    else if (/\.(?:md|txt|tmpl)$/.test(entry)) writes.push([d, render(readFileSync(s, 'utf8'), profile)]);
    else writes.push([d, readFileSync(s)]);
  }
}

function guarded(script) {
  return `[ "$CLAUDE_CODE_REMOTE" = "true" ] && node "$CLAUDE_PROJECT_DIR/${MARK}scripts/${script}" || true`;
}

export function mergeSettings(existing) {
  const settings = existing ? structuredClone(existing) : {};
  settings.hooks ||= {};
  const strip = (arr) => (arr || []).map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !String(h.command || '').includes(MARK) && !String(h.command || '').includes('cloud-setup.sh')) })).filter((g) => g.hooks.length);
  for (const ev of ['SessionStart', 'PreToolUse']) settings.hooks[ev] = strip(settings.hooks[ev]);
  settings.hooks.SessionStart.push({
    hooks: [
      { type: 'command', command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/cloud-setup.sh"', timeout: 600 },
      { type: 'command', command: guarded('session-context.mjs'), timeout: 10 },
    ],
  });
  settings.hooks.PreToolUse.push(
    { matcher: 'Bash', hooks: [{ type: 'command', command: guarded('guard-bash.mjs'), timeout: 30 }] },
    { matcher: 'Write|Edit|MultiEdit', hooks: [{ type: 'command', command: guarded('guard-write.mjs'), timeout: 10 }] },
  );
  return settings;
}

export function planKit({ repo, skills, workbenchDir, kickoffSkillDir }) {
  const profile = loadProfile(workbenchDir);
  const writes = [];
  const missing = [];
  // 1. House rules as an always-loaded rules file.
  const rules = render(readFileSync(join(workbenchDir, 'rules.md'), 'utf8'), profile);
  writes.push([join(repo, '.claude', 'rules', 'workbench.md'), `<!-- Vendored from the workbench plugin on ${new Date().toISOString().slice(0, 10)}. Re-run vendor-cloud-kit.mjs to refresh. -->\n${rules}`]);
  // 2. Skills.
  for (const id of skills) {
    const [plugin, skill] = id.split(':');
    const dir = locateSkill(plugin, skill, kickoffSkillDir);
    if (!dir) {
      missing.push(id);
      continue;
    }
    copyRendered(dir, join(repo, '.claude', 'skills', skill), profile, writes);
  }
  // 3. Guard hooks (active only in cloud sessions).
  const hookRoot = join(repo, '.claude', 'hooks', 'workbench');
  for (const f of ['lib.mjs', 'secret-scan.mjs', 'guard-bash.mjs', 'guard-write.mjs', 'session-context.mjs']) {
    writes.push([join(hookRoot, 'scripts', f), readFileSync(join(workbenchDir, 'scripts', f))]);
  }
  writes.push([join(hookRoot, 'rules.md'), readFileSync(join(workbenchDir, 'rules.md'), 'utf8')]);
  writes.push([join(hookRoot, 'profile.defaults.json'), `${JSON.stringify({ ...profile, personalised: true }, null, 2)}\n`]);
  // 4. Cloud setup script and environment doc (never overwrite project edits).
  const setup = join(repo, '.claude', 'hooks', 'cloud-setup.sh');
  if (!existsSync(setup)) writes.push([setup, readFileSync(join(kickoffSkillDir, 'assets', 'cloud-setup.sh'), 'utf8')]);
  const envDoc = join(repo, 'docs', 'cloud', 'ENVIRONMENT.md');
  if (!existsSync(envDoc)) {
    const names = existsSync(join(repo, '.env.example'))
      ? readFileSync(join(repo, '.env.example'), 'utf8').split('\n').map((l) => /^([A-Z][A-Z0-9_]*)=/.exec(l)?.[1]).filter(Boolean)
      : [];
    const text = readFileSync(join(kickoffSkillDir, 'assets', 'ENVIRONMENT.md'), 'utf8')
      .replaceAll('<project>', repo.split('/').pop())
      .replace('<variable names>', names.length ? names.map((n) => `- \`${n}\``).join('\n') : '- (add names from .env.example)');
    writes.push([envDoc, text]);
  }
  // 5. Settings.
  const settingsPath = join(repo, '.claude', 'settings.json');
  writes.push([settingsPath, `${JSON.stringify(mergeSettings(readJson(settingsPath)), null, 2)}\n`]);
  return { writes, missing };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const val = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
  const repo = resolve(val('--repo') || process.cwd());
  const dry = args.includes('--dry-run');
  const workbenchDir = val('--workbench') || locatePlugin('workbench', HERE);
  if (!workbenchDir) {
    process.stderr.write('Could not find the workbench plugin. Pass --workbench <dir>.\n');
    process.exit(1);
  }
  if (!existsSync(join(repo, '.git'))) {
    process.stderr.write(`${repo} is not a git repository.\n`);
    process.exit(1);
  }
  const explicit = val('--skills') ? val('--skills').split(',').map((s) => s.trim()).filter(Boolean) : null;
  const skills = chooseSkills(dependencyNames(repo), explicit);
  const { writes, missing } = planKit({ repo, skills, workbenchDir, kickoffSkillDir: dirname(HERE) });
  for (const [path, content] of writes) {
    if (dry) continue;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    if (path.endsWith('.sh')) chmodSync(path, 0o755);
  }
  process.stdout.write(`${dry ? 'Would write' : 'Wrote'} ${writes.length} files into ${repo}\n`);
  process.stdout.write(`Skills: ${skills.filter((s) => !missing.includes(s)).join(', ') || 'none'}\n`);
  if (missing.length) process.stdout.write(`Not found (plugin not installed here?): ${missing.join(', ')}\n`);
  if (dry) for (const [p] of writes) process.stdout.write(`  ${relative(repo, p)}\n`);
  else process.stdout.write('Next: review .claude/hooks/cloud-setup.sh and docs/cloud/ENVIRONMENT.md, then commit and push.\n');
}
