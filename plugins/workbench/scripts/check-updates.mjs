#!/usr/bin/env node
// SessionStart: list watched dependencies of this project that have a newer release than the
// installed version and no recorded decision yet. Cached; finishes in ~3 s or says nothing.
//   node check-updates.mjs            (hook mode: reads stdin, prints hook JSON)
//   node check-updates.mjs --report   (prints a plain table for the review skill)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { additionalContext, findProjectRoot, isMain, loadProfile, loadProjectConfig, readStdinJson, runSafely } from './lib.mjs';

export const DEFAULT_WATCH = {
  PyPI: ['temporalio', 'pydantic', 'pydantic-ai', 'pydantic-ai-slim', 'pydantic-settings', 'pydantic-graph', 'pydantic-evals', 'logfire', 'qdrant-client', 'fastapi', 'resend', 'livekit-agents', 'anthropic', 'ollama', 'sqlalchemy', 'alembic', 'httpx'],
  npm: ['@tanstack/react-router', '@tanstack/react-query', '@tanstack/react-start', '@tanstack/react-form', '@tanstack/react-table', '@tanstack/router-plugin', 'vite', 'typescript', 'resend', '@temporalio/client', '@temporalio/worker', '@temporalio/workflow', '@qdrant/js-client-rest', 'prisma', '@prisma/client', 'next', 'react', 'zod', 'sileo', 'ai', '@anthropic-ai/sdk', 'livekit-client', '@livekit/agents', 'lucide-react', 'playwright', '@playwright/test', 'vitest'],
};

const TTL_MS = 12 * 60 * 60 * 1000;
const BUDGET_MS = 2800;

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

const norm = (n) => n.toLowerCase().replace(/[-_.]+/g, '-');

const MANIFESTS = ['package.json', 'pyproject.toml', 'uv.lock', 'requirements.txt'];
const SKIP_DIRS = new Set(['node_modules', '.git', '.venv', 'venv', 'dist', 'build', '.next', 'coverage', 'graphify-out']);

/** The project root plus first-level folders that carry their own manifest (monorepos: web/, api/, agent/). */
export function manifestDirs(root) {
  const dirs = [root];
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      const dir = join(root, entry.name);
      if (MANIFESTS.some((m) => existsSync(join(dir, m)))) dirs.push(dir);
    }
  } catch {
    /* unreadable root */
  }
  return dirs;
}

/** Installed versions across the root and first-level manifest folders. */
export function installedVersions(root) {
  const found = { npm: {}, PyPI: {} };
  for (const dir of manifestDirs(root)) {
    const one = installedVersionsIn(dir);
    for (const eco of ['npm', 'PyPI']) for (const [k, v] of Object.entries(one[eco])) found[eco][k] ??= v;
  }
  return found;
}

/** Installed versions for npm and PyPI dependencies declared in one folder. */
export function installedVersionsIn(root) {
  const found = { npm: {}, PyPI: {} };
  const pkg = readJson(join(root, 'package.json'));
  if (pkg) {
    const lock = readJson(join(root, 'package-lock.json'));
    for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
      const fromLock = lock?.packages?.[`node_modules/${name}`]?.version;
      const fromModules = readJson(join(root, 'node_modules', name, 'package.json'))?.version;
      const declared = (pkg.dependencies?.[name] || pkg.devDependencies?.[name] || '').replace(/^[^\d]*/, '');
      const v = fromLock || fromModules || declared;
      if (v) found.npm[name] = v;
    }
  }
  const uvLock = existsSync(join(root, 'uv.lock')) ? readFileSync(join(root, 'uv.lock'), 'utf8') : '';
  for (const m of uvLock.matchAll(/\[\[package\]\]\s*\nname\s*=\s*"([^"]+)"\s*\nversion\s*=\s*"([^"]+)"/g)) found.PyPI[norm(m[1])] = m[2];
  for (const file of ['requirements.txt', 'requirements-dev.txt']) {
    const p = join(root, file);
    if (!existsSync(p)) continue;
    for (const m of readFileSync(p, 'utf8').matchAll(/^\s*([A-Za-z0-9_.-]+)(?:\[[^\]]*\])?\s*==\s*([0-9][^\s;#]*)/gm)) found.PyPI[norm(m[1])] ??= m[2];
  }
  const pyproject = existsSync(join(root, 'pyproject.toml')) ? readFileSync(join(root, 'pyproject.toml'), 'utf8') : '';
  for (const m of pyproject.matchAll(/["']([A-Za-z0-9_.-]+)(?:\[[^\]]*\])?\s*(?:==|>=|~=)\s*([0-9][^"',;\s]*)["']/g)) found.PyPI[norm(m[1])] ??= m[2];
  return found;
}

export function compareVersions(a, b) {
  const pa = String(a).split(/[.+-]/).map((x) => Number.parseInt(x, 10));
  const pb = String(b).split(/[.+-]/).map((x) => Number.parseInt(x, 10));
  for (let i = 0; i < 3; i += 1) {
    const x = Number.isNaN(pa[i]) ? 0 : pa[i] || 0;
    const y = Number.isNaN(pb[i]) ? 0 : pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export function isPrerelease(v) {
  return /[a-z]/i.test(String(v).replace(/^v/, ''));
}

export function alreadyDecided(decisionsText, name, latest) {
  return String(decisionsText)
    .split('\n')
    .some((line) => line.includes(name) && line.includes(latest));
}

function cachePath() {
  const dir = process.env.CLAUDE_PLUGIN_DATA || join(homedir(), '.claude', 'workbench', 'cache');
  mkdirSync(dir, { recursive: true });
  return join(dir, 'latest-versions.json');
}

async function fetchLatest(ecosystem, name, signal) {
  const url = ecosystem === 'npm' ? `https://registry.npmjs.org/${name}/latest` : `https://pypi.org/pypi/${name}/json`;
  const res = await fetch(url, { signal, headers: { accept: 'application/json' } });
  if (!res.ok) return null;
  const data = await res.json();
  return ecosystem === 'npm' ? data.version : data.info?.version;
}

export async function findUpdates(root, { watch = DEFAULT_WATCH, extra = [], fetcher = fetchLatest, now = Date.now() } = {}) {
  const installed = installedVersions(root);
  const targets = [];
  for (const eco of ['npm', 'PyPI']) {
    const names = new Set([...(watch[eco] || []), ...extra.filter((e) => e.ecosystem === eco).map((e) => e.name)]);
    for (const name of names) {
      const key = eco === 'PyPI' ? norm(name) : name;
      if (installed[eco][key]) targets.push({ ecosystem: eco, name, installed: installed[eco][key] });
    }
  }
  if (!targets.length) return [];

  const cacheFile = cachePath();
  const cache = readJson(cacheFile) || {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BUDGET_MS);
  await Promise.all(
    targets.map(async (t) => {
      const k = `${t.ecosystem}:${t.name}`;
      if (cache[k] && now - cache[k].at < TTL_MS) {
        t.latest = cache[k].latest;
        return;
      }
      try {
        const latest = await fetcher(t.ecosystem, t.name, controller.signal);
        if (latest) {
          cache[k] = { latest, at: now };
          t.latest = latest;
        }
      } catch {
        /* offline or slow: skip */
      }
    }),
  );
  clearTimeout(timer);
  try {
    writeFileSync(cacheFile, JSON.stringify(cache));
  } catch {
    /* cache is best effort */
  }

  const decisionsFile = join(root, 'docs', 'dependency-decisions.md');
  const decisions = existsSync(decisionsFile) ? readFileSync(decisionsFile, 'utf8') : '';
  return targets
    .filter((t) => t.latest && !isPrerelease(t.latest) && compareVersions(t.installed, t.latest) < 0)
    .filter((t) => !alreadyDecided(decisions, t.name, t.latest))
    .map((t) => ({ ...t, major: compareVersions(t.installed.split('.')[0], t.latest.split('.')[0]) < 0 }));
}

export function formatUpdates(updates) {
  return updates.map((u) => `- ${u.name} (${u.ecosystem}) ${u.installed} → ${u.latest}${u.major ? '  MAJOR' : ''}`).join('\n');
}

if (isMain(import.meta.url)) {
  runSafely(async () => {
    const report = process.argv.includes('--report');
    const input = report ? {} : await readStdinJson();
    const root = findProjectRoot(input.cwd || process.cwd());
    const { profile } = loadProfile();
    const { config } = loadProjectConfig(root);
    const extra = [...(profile.watch_packages || []), ...(config.watchPackages || [])];
    const updates = await findUpdates(root, { extra });
    if (report) {
      process.stdout.write(updates.length ? `${formatUpdates(updates)}\n` : 'No undecided updates for watched packages.\n');
      return;
    }
    if (!updates.length) return;
    additionalContext(
      'SessionStart',
      `**Dependency updates waiting for a decision** (installed → latest):\n${formatUpdates(updates)}\nThe owner wants these reviewed at session start. Use workbench:reviewing-dependency-updates: read the changelogs, adopt what benefits the app, and record every decision, including declines with the reason, in docs/dependency-decisions.md. If the owner's first request is urgent, do it first, then come back to this.`,
    );
  });
}
