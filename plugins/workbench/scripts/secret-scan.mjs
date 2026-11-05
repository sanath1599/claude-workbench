#!/usr/bin/env node
// Secret scanner used by the commit/push guard, the prompt guard and as a CLI:
//   node secret-scan.mjs --staged | --working | --range A..B | --push | --tree | --text "..."
// Exit code 1 when findings exist. Output never prints a full secret.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { isMain } from './lib.mjs';

export const ALLOW_PRAGMA = 'workbench:allow-secret';

const PLACEHOLDER = /^(?:x+|\*+|\.+|changeme|change-me|password|passwd|secret|example|sample|test|dummy|placeholder|your[-_a-z]*|<[^>]*>|\$\{[^}]*\}|\$[A-Z_]+|%[A-Z_]+%|null|none|undefined)$/i;
const ENV_REFERENCE = /(?:process\.env|import\.meta\.env|os\.environ|os\.getenv|getenv\(|env\(|\$\{|\$\(|Deno\.env|settings\.|config\.)/;
const LOCAL_HOSTS = /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal|db|postgres|postgresql|database|redis|mysql|mongo)$/i;

export const RULES = [
  { id: 'private-key', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/g },
  { id: 'aws-access-key-id', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: 'github-token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/g },
  { id: 'anthropic-key', re: /\bsk-ant-(?:api|admin)\d{2}-[A-Za-z0-9_-]{40,}/g },
  { id: 'openai-key', re: /\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{40,}/g },
  { id: 'stripe-live-key', re: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}/g },
  { id: 'slack-token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { id: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'resend-key', re: /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}\b/g },
  { id: 'vercel-token', re: /\b(?:vcp|vck|vca|vcr|vci)_[A-Za-z0-9]{40,}\b/g },
  { id: 'npm-token', re: /\bnpm_[A-Za-z0-9]{36}\b/g },
  { id: 'jwt-like', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, check: (m, line) => /(secret|token|key|auth|bearer)/i.test(line) },
  {
    id: 'credential-url',
    re: /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|rediss?|amqps?|https?):\/\/([^\s:@/'"`]+):([^\s@'"`]{6,})@([^\s/:'"`?]+)/g,
    check: (m) => {
      const [, , password, host] = m;
      if (PLACEHOLDER.test(password) || /[<>{}$]/.test(password)) return false;
      if (LOCAL_HOSTS.test(host)) return false;
      return true;
    },
  },
  {
    id: 'secret-assignment',
    re: /\b([A-Za-z0-9_]*(?:SECRET|TOKEN|API_?KEY|APIKEY|PASSWORD|PASSWD|PRIVATE_?KEY|ACCESS_?KEY|AUTH_?KEY|CLIENT_?SECRET)[A-Za-z0-9_]*)["']?\s*[:=]\s*["'`]?([^\s"'`#,;)]{16,})/gi,
    check: (m, line) => {
      const value = m[2];
      if (PLACEHOLDER.test(value) || ENV_REFERENCE.test(value) || ENV_REFERENCE.test(line.slice(m.index, m.index + m[0].length + 20))) return false;
      if (/^[a-z_.]+\(?$/i.test(value) || /^(?:true|false|\d+)$/i.test(value)) return false;
      if (/[()[\]{}<>]/.test(value)) return false; // code (calls, generics, templates), not a literal secret
      if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(value)) return false; // member access like config.apiKey
      if (!/\d/.test(value) && value.length < 32) return false; // real keys almost always carry digits
      return entropy(value) >= 3.5;
    },
  },
];

export function entropy(s) {
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) || 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

export function redact(value) {
  const v = String(value);
  return v.length <= 8 ? `${v.slice(0, 2)}…` : `${v.slice(0, 4)}…(${v.length} chars)`;
}

/** Scan one line of text. Returns [{rule, preview}] */
export function scanLine(line) {
  if (!line || line.includes(ALLOW_PRAGMA)) return [];
  const found = [];
  const seen = new Set();
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(line)) !== null) {
      if (rule.check && !rule.check(m, line)) continue;
      const key = `${m.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ rule: rule.id, preview: redact(m[0]) });
    }
  }
  return found;
}

export function scanText(text, file = '(text)') {
  const findings = [];
  String(text)
    .split(/\r?\n/)
    .forEach((line, i) => {
      for (const f of scanLine(line)) findings.push({ file, line: i + 1, ...f });
    });
  return findings;
}

const SKIP_FILES = /(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|uv\.lock|poetry\.lock|Cargo\.lock|go\.sum|bun\.lockb)$/;
const SKIP_EXT = /\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|woff2?|ttf|otf|mp4|mov|mp3|wav|docx|xlsx|pptx)$/i;

export function isEnvFile(path) {
  const name = basename(path);
  return /^\.env(?:\..+)?$/.test(name) && !/\.(?:example|sample|template|dist)$/.test(name);
}

/** Parse `git diff -U0` output; scan added lines only. */
export function scanUnifiedDiff(diff) {
  const findings = [];
  let file = null;
  let lineNo = 0;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ')) {
      const p = raw.slice(4).trim();
      file = p === '/dev/null' ? null : p.replace(/^b\//, '');
      continue;
    }
    if (raw.startsWith('@@')) {
      const m = /\+(\d+)/.exec(raw);
      lineNo = m ? Number(m[1]) : 0;
      continue;
    }
    if (!file || SKIP_FILES.test(file) || SKIP_EXT.test(file)) continue;
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      for (const f of scanLine(raw.slice(1))) findings.push({ file, line: lineNo, ...f });
      lineNo += 1;
    }
  }
  return findings;
}

function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

function envFileFindings(paths) {
  return paths.filter(isEnvFile).map((file) => ({ file, line: 0, rule: 'env-file-tracked', preview: 'whole file' }));
}

export function scanStaged(cwd) {
  const diff = git(cwd, ['diff', '--cached', '-U0', '--no-color', '--no-ext-diff']) || '';
  const names = (git(cwd, ['diff', '--cached', '--name-only', '--diff-filter=ACMR']) || '').split('\n').filter(Boolean);
  return [...envFileFindings(names), ...scanUnifiedDiff(diff)];
}

/** Everything a commit could pick up: staged + unstaged tracked changes + untracked, non-ignored files. */
export function scanWorking(cwd) {
  const findings = scanStaged(cwd);
  const unstaged = git(cwd, ['diff', '-U0', '--no-color', '--no-ext-diff']) || '';
  findings.push(...scanUnifiedDiff(unstaged));
  const untracked = (git(cwd, ['ls-files', '--others', '--exclude-standard']) || '').split('\n').filter(Boolean);
  findings.push(...envFileFindings(untracked));
  for (const file of untracked) findings.push(...scanFile(cwd, file));
  return dedupe(findings);
}

export function scanRange(cwd, range) {
  const diff = git(cwd, ['diff', '-U0', '--no-color', '--no-ext-diff', range]) || '';
  const names = (git(cwd, ['diff', '--name-only', '--diff-filter=ACMR', range]) || '').split('\n').filter(Boolean);
  return dedupe([...envFileFindings(names), ...scanUnifiedDiff(diff)]);
}

function scanFile(cwd, file) {
  if (SKIP_FILES.test(file) || SKIP_EXT.test(file)) return [];
  const full = join(cwd, file);
  try {
    if (!existsSync(full) || statSync(full).size > 2 * 1024 * 1024) return [];
    const text = readFileSync(full, 'utf8');
    if (text.includes('\u0000')) return [];
    return scanText(text, file);
  } catch {
    return [];
  }
}

/** Every tracked file at HEAD (first push of a new repo). */
export function scanTree(cwd) {
  const files = (git(cwd, ['ls-files']) || '').split('\n').filter(Boolean);
  const findings = envFileFindings(files);
  for (const file of files) findings.push(...scanFile(cwd, file));
  return dedupe(findings);
}

/** What a `git push` would publish: commits not on the upstream, or the whole tree for a first push. */
export function scanPush(cwd) {
  const upstream = git(cwd, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (upstream && upstream.trim()) return scanRange(cwd, `${upstream.trim()}..HEAD`);
  const remoteHead = git(cwd, ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/HEAD']);
  if (remoteHead && remoteHead.trim()) {
    const base = git(cwd, ['merge-base', 'HEAD', 'refs/remotes/origin/HEAD']);
    if (base && base.trim()) return scanRange(cwd, `${base.trim()}..HEAD`);
  }
  return scanTree(cwd);
}

function dedupe(findings) {
  const seen = new Set();
  return findings.filter((f) => {
    const k = `${f.file}:${f.line}:${f.rule}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function formatFindings(findings, limit = 12) {
  const lines = findings.slice(0, limit).map((f) => `  - ${f.file}${f.line ? `:${f.line}` : ''}  ${f.rule}  ${f.preview}`);
  if (findings.length > limit) lines.push(`  - …and ${findings.length - limit} more`);
  return lines.join('\n');
}

if (isMain(import.meta.url)) {
  const [mode = '--staged', arg] = process.argv.slice(2);
  const cwd = process.cwd();
  const findings =
    mode === '--working' ? scanWorking(cwd)
    : mode === '--range' ? scanRange(cwd, arg)
    : mode === '--push' ? scanPush(cwd)
    : mode === '--tree' ? scanTree(cwd)
    : mode === '--text' ? scanText(arg || '')
    : scanStaged(cwd);
  if (findings.length) {
    process.stdout.write(`Possible secrets found:\n${formatFindings(findings, 50)}\n`);
    process.exit(1);
  }
  process.stdout.write('No secrets found.\n');
}
