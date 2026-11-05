// Shared helpers for the workbench hook scripts. No dependencies: Node 18+ only.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT
  ? resolve(process.env.CLAUDE_PLUGIN_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function readStdinJson() {
  if (process.stdin.isTTY) return {};
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** Walk up from `start` to the nearest directory holding .git or .claude/workbench.json. */
export function findProjectRoot(start = process.cwd()) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, '.git')) || existsSync(join(dir, '.claude', 'workbench.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(start);
    dir = parent;
  }
}

export const PROJECT_DEFAULTS = Object.freeze({
  commits: 'ask', // 'per-increment' | 'on-request' | 'ask'
  coAuthorTrailer: 'ask', // true | false | 'ask'
  branchPolicy: 'feature-branch', // 'feature-branch' | 'branch-per-commit' | 'main'
  cloudHandoff: 'ask', // 'yes' | 'no' | 'maybe' | 'ask'
  productionDeploys: 'ask', // 'ask' | 'auto-on-main'
  graphify: true,
  watchPackages: [],
  deploymentTier: 'internal', // 'dev' | 'internal' | 'enterprise'
  cloud: '', // 'azure' | 'aws' | 'gcp' (enterprise only)
  cicd: 'none', // 'none' | name of an existing pipeline
  iac: '', // 'cli-then-iac' | 'terraform' | 'bicep' | 'cli-only'
  iacTool: '', // 'terraform' | 'bicep' when iac is cli-then-iac
  iacSync: false, // true: update infra/ after every round of cloud CLI changes
});

/** Project settings written by kickoff:starting-a-project into .claude/workbench.json. */
export function loadProjectConfig(cwd = process.cwd()) {
  const root = findProjectRoot(cwd);
  const path = join(root, '.claude', 'workbench.json');
  const found = existsSync(path);
  const data = found ? readJson(path) || {} : {};
  return { root, path: found ? path : null, config: { ...PROJECT_DEFAULTS, ...data } };
}

/** The person's profile: env override, then ~/.claude/workbench/profile.json, then the bundled defaults. */
export function loadProfile() {
  const candidates = [
    process.env.WORKBENCH_PROFILE,
    join(homedir(), '.claude', 'workbench', 'profile.json'),
  ].filter(Boolean);
  const defaults = readJson(join(PLUGIN_ROOT, 'profile.defaults.json')) || {};
  for (const path of candidates) {
    if (existsSync(path)) {
      const data = readJson(path);
      if (data) return { source: path, personalised: true, profile: { ...defaults, ...data } };
    }
  }
  return { source: 'bundled defaults', personalised: Boolean(defaults.personalised), profile: defaults };
}

/** Replace {{wb.key}} tokens with profile values. Arrays join with ", ". Unknown keys stay visible. */
export function renderTokens(text, profile = {}) {
  return String(text).replace(/\{\{\s*wb\.([a-z0-9_]+)\s*\}\}/gi, (whole, key) => {
    const value = profile[key];
    if (value === undefined || value === null || value === '') return `${whole} (not set; run /workbench:setup)`;
    return Array.isArray(value) ? value.join(', ') : String(value);
  });
}

export function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}

export function preToolUseDecision(decision, reason) {
  emit({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  });
}

export function additionalContext(eventName, text) {
  emit({ hookSpecificOutput: { hookEventName: eventName, additionalContext: text } });
}

/** True when this module is the entry point (so tests can import without running main). */
export function isMain(metaUrl) {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(metaUrl);
}

/** Never let a hook crash the session: log to stderr and exit 0. */
export function runSafely(main) {
  Promise.resolve()
    .then(main)
    .catch((err) => {
      process.stderr.write(`[workbench hook] ${err?.message || err}\n`);
      process.exit(0);
    });
}
