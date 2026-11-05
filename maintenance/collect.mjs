#!/usr/bin/env node
// Daily maintenance, deterministic part. No LLM, no secrets needed (GITHUB_TOKEN optional for rate limits).
// Writes maintenance/out/report.json and report.md, and prints a one-line summary.
//   node maintenance/collect.mjs [--offline] [--skip-links]
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'maintenance', 'out');
const STATE = join(ROOT, 'maintenance', 'state.json');
const UA = 'starter-pack-maintenance';
const STALE_DAYS = 60;

const readJson = (p, d = null) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return d;
  }
};

function walk(dir, pred, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (['node_modules', '.git', 'out', 'results'].includes(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, pred, out);
    else if (pred(p)) out.push(p);
  }
  return out;
}

export function loadTracked(root = ROOT) {
  const dir = join(root, 'maintenance', 'tracked-packages.d');
  const map = new Map();
  for (const f of existsSync(dir) ? readdirSync(dir).filter((x) => x.endsWith('.json')) : []) {
    for (const p of readJson(join(dir, f), []) || []) {
      const key = `${p.ecosystem}:${p.name}`;
      const prev = map.get(key);
      map.set(key, prev ? { ...prev, skills: [...new Set([...(prev.skills || []), ...(p.skills || [])])], files: [...prev.files, f] } : { ...p, files: [f] });
    }
  }
  return [...map.values()];
}

export function isStable(v) {
  return /^\d+(\.\d+){0,3}$/.test(String(v).replace(/^v/, ''));
}

export function cmp(a, b) {
  const pa = String(a).replace(/^v/, '').split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  const pb = String(b).replace(/^v/, '').split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i += 1) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0) ? -1 : 1;
  return 0;
}

async function getJson(url, init = {}) {
  const headers = { 'user-agent': UA, accept: 'application/json', ...(init.headers || {}) };
  if (url.startsWith('https://api.github.com') && process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export async function latestVersion(pkg) {
  if (pkg.ecosystem === 'npm') {
    const doc = await getJson(`https://registry.npmjs.org/${pkg.name}`);
    const latest = doc['dist-tags']?.latest;
    if (latest && isStable(latest)) return latest;
    return Object.keys(doc.versions || {}).filter(isStable).sort(cmp).pop() || latest;
  }
  if (pkg.ecosystem === 'PyPI') {
    const doc = await getJson(`https://pypi.org/pypi/${pkg.name}/json`);
    const stable = Object.keys(doc.releases || {}).filter(isStable).sort(cmp).pop();
    return stable || doc.info?.version;
  }
  if (pkg.ecosystem === 'github') {
    const rel = await getJson(`https://api.github.com/repos/${pkg.repo}/releases/latest`);
    return String(rel.tag_name || '').replace(/^v/, '');
  }
  return null;
}

async function vulnerabilities(pkgs) {
  const queryable = pkgs.filter((p) => ['npm', 'PyPI'].includes(p.ecosystem));
  if (!queryable.length) return {};
  const body = { queries: queryable.flatMap((p) => [p.documented, p.latest].filter(Boolean).map((version) => ({ package: { name: p.name, ecosystem: p.ecosystem }, version }))) };
  const res = await getJson('https://api.osv.dev/v1/querybatch', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  const out = {};
  const ids = new Set();
  res.results.forEach((r, i) => {
    const q = body.queries[i];
    const key = `${q.package.ecosystem}:${q.package.name}@${q.version}`;
    out[key] = (r.vulns || []).map((v) => v.id);
    out[key].forEach((id) => ids.add(id));
  });
  const details = {};
  await Promise.all(
    [...ids].slice(0, 60).map(async (id) => {
      try {
        const v = await getJson(`https://api.osv.dev/v1/vulns/${id}`);
        const sev = (v.database_specific?.severity || v.affected?.[0]?.ecosystem_specific?.severity || '').toString().toUpperCase();
        details[id] = { id, summary: v.summary || v.details?.slice(0, 160) || '', severity: sev || 'UNKNOWN', url: `https://osv.dev/vulnerability/${id}` };
      } catch {
        details[id] = { id, severity: 'UNKNOWN', summary: '', url: `https://osv.dev/vulnerability/${id}` };
      }
    }),
  );
  return { byPackageVersion: out, details };
}

export function extractLinks(text) {
  return [...new Set([...String(text).matchAll(/https?:\/\/[^\s)<>"'`\]|]+/g)].map((m) => m[0].replace(/[.,;:]+$/, '')))].filter((u) => !/\{\{|<|example\.(?:com|org)|localhost|127\.0\.0\.1|\$\{/.test(u))
    .filter((u) => {
      try {
        const { hostname, pathname } = new URL(u);
        if (!hostname.includes('.') || /\.(?:example|test|local|internal|invalid)$/.test(hostname)) return false; // placeholders
        return !/\/(?:v\d+|api|mcp)\/?$/.test(pathname); // API base URLs, not pages
      } catch {
        return false;
      }
    });
}

async function checkLinks(urls) {
  const broken = [];
  const queue = [...urls];
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift();
      try {
        let res = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(12000) });
        if (res.status === 405 || res.status === 403) res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(12000) });
        if (res.status === 404 || res.status === 410 || res.status >= 500) broken.push({ url, status: res.status });
      } catch (e) {
        broken.push({ url, status: String(e.name || 'error') });
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  return broken;
}

async function checkMcp(root) {
  const results = [];
  for (const f of walk(join(root, 'plugins'), (p) => p.endsWith('.mcp.json'))) {
    const servers = readJson(f, {})?.mcpServers || {};
    for (const [name, s] of Object.entries(servers)) {
      if (!s.url) {
        results.push({ file: relative(root, f), name, kind: 'local', command: [s.command, ...(s.args || [])].join(' ') });
        continue;
      }
      try {
        const res = await fetch(s.url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'user-agent': UA }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: UA, version: '1' } } }), signal: AbortSignal.timeout(12000) });
        results.push({ file: relative(root, f), name, url: s.url, status: res.status, alive: [200, 202, 401, 403, 405, 406, 415].includes(res.status) });
      } catch (e) {
        results.push({ file: relative(root, f), name, url: s.url, status: String(e.name || 'error'), alive: false });
      }
    }
  }
  return results;
}

export function staleVerifications(files, now = new Date()) {
  const out = [];
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/verified (\d{4}-\d{2}-\d{2})/g)) {
      const days = Math.floor((now - new Date(m[1])) / 86400000);
      if (days > STALE_DAYS) out.push({ file: f, date: m[1], days });
    }
  }
  return out;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const offline = process.argv.includes('--offline');
  const skipLinks = process.argv.includes('--skip-links');
  mkdirSync(OUT, { recursive: true });
  const state = readJson(STATE, {});
  const tracked = loadTracked();
  const skillFiles = walk(join(ROOT, 'plugins'), (p) => p.endsWith('.md'));
  const report = { date: new Date().toISOString().slice(0, 10), updates: [], errors: [], vulns: [], brokenLinks: [], mcp: [], stale: [], claudeCode: null };

  if (!offline) {
    await Promise.all(
      tracked.map(async (p) => {
        try {
          p.latest = await latestVersion(p);
          if (p.latest && p.documented && cmp(p.documented, p.latest) < 0) report.updates.push({ name: p.name, ecosystem: p.ecosystem, from: p.documented, to: p.latest, major: cmp(p.documented.split('.')[0], p.latest.split('.')[0]) < 0, changelog: p.changelog, skills: p.skills, files: p.files });
        } catch (e) {
          report.errors.push(`${p.ecosystem}:${p.name}: ${e.message}`);
        }
      }),
    );
    try {
      const v = await vulnerabilities(tracked);
      for (const [key, ids] of Object.entries(v.byPackageVersion || {})) {
        for (const id of ids) {
          const d = v.details[id] || { id, severity: 'UNKNOWN' };
          report.vulns.push({ package: key, ...d, major: ['HIGH', 'CRITICAL'].includes(d.severity) });
        }
      }
    } catch (e) {
      report.errors.push(`osv: ${e.message}`);
    }
    if (!skipLinks) report.brokenLinks = await checkLinks([...new Set(skillFiles.flatMap((f) => extractLinks(readFileSync(f, 'utf8'))))]);
    report.mcp = await checkMcp(ROOT);
    try {
      const cc = await getJson('https://registry.npmjs.org/@anthropic-ai/claude-code/latest');
      report.claudeCode = { latest: cc.version, lastSeen: state.claudeCode || null, changed: cc.version !== state.claudeCode };
      state.claudeCode = cc.version;
    } catch (e) {
      report.errors.push(`claude-code: ${e.message}`);
    }
  }
  report.stale = staleVerifications(skillFiles).map((s) => ({ ...s, file: relative(ROOT, s.file) }));
  report.majorVulns = report.vulns.filter((v) => v.major);
  report.needsAttention = Boolean(report.updates.length || report.vulns.length || report.brokenLinks.length || report.mcp.some((m) => m.alive === false) || report.stale.length || report.claudeCode?.changed);

  writeFileSync(join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    `# Workbench maintenance report — ${report.date}`,
    '',
    `## Package updates (${report.updates.length})`,
    ...report.updates.map((u) => `- ${u.name} (${u.ecosystem}) ${u.from} → ${u.to}${u.major ? ' **major**' : ''} — skills: ${(u.skills || []).join(', ') || 'n/a'} — ${u.changelog || ''}`),
    '',
    `## Vulnerabilities (${report.vulns.length}, high/critical: ${report.majorVulns.length})`,
    ...report.vulns.map((v) => `- ${v.package}: ${v.id} ${v.severity} — ${v.summary} ${v.url}`),
    '',
    `## Broken links (${report.brokenLinks.length})`,
    ...report.brokenLinks.map((b) => `- ${b.status} ${b.url}`),
    '',
    `## MCP endpoints`,
    ...report.mcp.filter((m) => m.url).map((m) => `- ${m.alive ? 'ok' : 'DOWN'} ${m.name} ${m.url} (${m.status})`),
    '',
    `## Stale verification dates (> ${STALE_DAYS} days): ${report.stale.length}`,
    ...report.stale.slice(0, 40).map((s) => `- ${s.file}: ${s.date} (${s.days} days)`),
    '',
    `## Claude Code: ${report.claudeCode ? `${report.claudeCode.latest}${report.claudeCode.changed ? ` (new since ${report.claudeCode.lastSeen || 'first run'})` : ''}` : 'unknown'}`,
    '',
    report.errors.length ? `## Errors\n${report.errors.map((e) => `- ${e}`).join('\n')}` : '',
  ].join('\n');
  writeFileSync(join(OUT, 'report.md'), `${md}\n`);
  if (!offline) writeFileSync(STATE, `${JSON.stringify(state, null, 2)}\n`);
  process.stdout.write(`updates=${report.updates.length} vulns=${report.vulns.length} major=${report.majorVulns.length} broken_links=${report.brokenLinks.length} mcp_down=${report.mcp.filter((m) => m.alive === false).length} stale=${report.stale.length} claude_code_changed=${Boolean(report.claudeCode?.changed)} needs_attention=${report.needsAttention}\n`);
}
