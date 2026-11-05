#!/usr/bin/env node
// IaC sync. When .claude/workbench.json has "iacSync": true, every infrastructure-changing
// az/aws/gcloud command is logged to .workbench/iac-pending.jsonl, and the Stop hook blocks
// once until infra/ (Terraform or Bicep) has been updated and `done` has been run.
//   node iac-sync.mjs post-tool-use   PostToolUse hook (matcher Bash), reads JSON on stdin
//   node iac-sync.mjs stop            Stop hook, reads JSON on stdin
//   node iac-sync.mjs status          list pending entries
//   node iac-sync.mjs done [--note "..."]   move pending entries to iac-history.jsonl
// Node 20+, no dependencies. Self-contained on purpose: plugins install separately.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const PENDING = 'iac-pending.jsonl';
const HISTORY = 'iac-history.jsonl';
const MAX_COMMAND = 300;

// ---- project helpers (small copies of the workbench plugin's lib.mjs) ----

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function findProjectRoot(start = process.cwd()) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, '.git')) || existsSync(join(dir, '.claude', 'workbench.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(start);
    dir = parent;
  }
}

export function loadProjectConfig(cwd = process.cwd()) {
  const root = findProjectRoot(cwd);
  const data = readJson(join(root, '.claude', 'workbench.json')) || {};
  return { root, config: data };
}

// ---- redaction (minimal copy of the workbench secret-scan rules) ----

const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY(?: BLOCK)?-----|$)/g,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/g,
  /\bsk-ant-(?:api|admin)\d{2}-[A-Za-z0-9_-]{40,}/g,
  /\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{40,}/g,
  /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g,
];
const CREDENTIAL_URL = /\b((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?|amqps?|https?):\/\/[^\s:@/'"`]+:)([^\s@'"`]{3,})(@)/g;
const SECRET_ASSIGNMENT = /\b([A-Za-z0-9_]*(?:SECRET|TOKEN|API_?KEY|APIKEY|PASSWORD|PASSWD|PRIVATE_?KEY|ACCESS_?KEY|AUTH_?KEY|CONNECTION_?STRING)[A-Za-z0-9_]*)(["']?\s*[:=]\s*["'`]?)(?![$"'`\s])([^\s"'`;]{6,})/gi;
const SECRET_FLAG = /(--(?:value|password|admin-password|client-secret|secret|account-key|sas-token|connection-string|token|key|secret-string|secret-access-key)(?:=|\s+))(?!\$|['"]?\$)("[^"]*"|'[^']*'|\S+)/gi;

export function redact(text) {
  let out = String(text);
  for (const re of SECRET_PATTERNS) out = out.replace(re, '[REDACTED]');
  out = out.replace(CREDENTIAL_URL, '$1[REDACTED]$3');
  out = out.replace(SECRET_ASSIGNMENT, '$1$2[REDACTED]');
  out = out.replace(SECRET_FLAG, '$1[REDACTED]');
  return out;
}

export function truncate(text, max = MAX_COMMAND) {
  const s = String(text).replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

// ---- command classification ----

const SEGMENT_SPLIT = /\|\||&&|[|;&\n]/;
const WRAPPERS = new Set(['sudo', 'time', 'command', 'exec', 'nohup', 'env']);

// Groups that never change cloud infrastructure (local config, login, identity, help).
const NON_INFRA_GROUPS = {
  az: new Set(['account', 'login', 'logout', 'configure', 'config', 'version', 'help', 'cache', 'extension', 'feedback', 'find', 'interactive', 'upgrade', 'bicep', 'survey', 'demo']),
  aws: new Set(['configure', 'sts', 'sso', 'help', 'history', 'login', 'logout', 'cli-dev', 'wizard']),
  gcloud: new Set(['auth', 'config', 'info', 'version', 'help', 'components', 'init', 'topic', 'meta', 'feedback', 'survey', 'cheat-sheet']),
};

const READ_VERB = /^(?:show|list|get|describe|query|check|exists|validate|what-if|wait|view|read|download|export|diff|lookup|search|tail|head|ls|login|logout|help|version|estimate|preview)(?:-|$)/;
const AZ_MUTATING = /^(?:create|update|set|delete|deploy|assign|add|remove|start|stop|restart|swap|scale|purge|move|import|up|apply|enable|disable|attach|detach|grant|revoke|rotate|regenerate-key|restore|failover|promote|upload|sync|cancel|tag|lock|unlock|link|unlink|register|unregister|redeploy|rollback|reset-[a-z-]+|create-[a-z-]+|update-[a-z-]+|delete-[a-z-]+|put-[a-z-]+)$/;
const AWS_MUTATING = /^(?:create|update|delete|put|run|terminate|start|stop|reboot|modify|attach|detach|associate|disassociate|register|deregister|authorize|revoke|tag|untag|enable|disable|deploy|apply|import|restore|rotate|set|add|remove|replace|cancel)(?:-[a-z0-9-]+)?$/;
const AWS_S3_MUTATING = new Set(['cp', 'sync', 'mv', 'rm', 'mb', 'rb']);
const GCLOUD_MUTATING = /^(?:create|update|delete|deploy|add|remove|set|enable|disable|import|resize|start|stop|reset|attach|detach|move|patch|replace|restore|rollback|promote|add-[a-z-]+|remove-[a-z-]+|set-[a-z-]+|update-[a-z-]+|delete-[a-z-]+|create-[a-z-]+)$/;
const AWS_NOT_INFRA = new Set(['update-kubeconfig']);

function stripLead(segment) {
  let s = segment.replace(/^[\s({`]+|^\$\(\s*/g, '');
  const toks = s.split(/\s+/).filter(Boolean);
  while (toks.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(toks[0]) || WRAPPERS.has(toks[0]))) toks.shift();
  return toks;
}

/** Classify one shell segment. Returns { cloud, mutating } or null when it is not az/aws/gcloud. */
export function classifySegment(segment) {
  const toks = stripLead(segment);
  const cloud = toks[0];
  if (cloud !== 'az' && cloud !== 'aws' && cloud !== 'gcloud') return null;
  const words = [];
  for (const t of toks.slice(1)) {
    if (t.startsWith('-')) break;
    words.push(t.replace(/^['"]|['"]$/g, ''));
  }
  while (cloud === 'gcloud' && ['beta', 'alpha', 'preview'].includes(words[0])) words.shift();
  const rest = toks.slice(1).join(' ');
  if (!words.length || NON_INFRA_GROUPS[cloud].has(words[0])) return { cloud, mutating: false };

  if (cloud === 'aws' && words[0] === 's3') return { cloud, mutating: AWS_S3_MUTATING.has(words[1]) && !/--dryrun\b/.test(rest) };
  if (cloud === 'az' && words[0] === 'rest') return { cloud, mutating: /(?:--method|-m)[=\s]+['"]?(?:put|post|patch|delete)\b/i.test(rest) };
  const mutatingRe = cloud === 'az' ? AZ_MUTATING : cloud === 'aws' ? AWS_MUTATING : GCLOUD_MUTATING;
  // The verb is the first word after the service/group that looks like a verb; later words are resource names.
  const verb = words.slice(1).find((w) => READ_VERB.test(w) || mutatingRe.test(w)) || '';
  if (!verb || READ_VERB.test(verb)) return { cloud, mutating: false };

  const mutating = !(cloud === 'aws' && AWS_NOT_INFRA.has(verb));
  return { cloud, mutating };
}

/** All infrastructure-changing cloud CLI calls in a command line: [{ cloud, segment }]. */
export function classifyCommand(command) {
  if (!command || typeof command !== 'string') return [];
  const found = [];
  for (const segment of command.split(SEGMENT_SPLIT)) {
    const c = classifySegment(segment);
    if (c && c.mutating) found.push({ cloud: c.cloud, segment: segment.trim() });
  }
  return found;
}

// ---- pending / history files ----

const stateDir = (root) => join(root, '.workbench');
export const pendingPath = (root) => join(stateDir(root), PENDING);
export const historyPath = (root) => join(stateDir(root), HISTORY);

export function readPending(root) {
  const path = pendingPath(root);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function markDone(root, { note = '', now = new Date() } = {}) {
  const entries = readPending(root);
  if (entries.length) {
    const synced = now.toISOString();
    const lines = entries.map((e) => JSON.stringify({ ...e, synced, ...(note ? { note } : {}) })).join('\n');
    appendFileSync(historyPath(root), `${lines}\n`);
  }
  if (existsSync(pendingPath(root))) writeFileSync(pendingPath(root), '');
  return entries.length;
}

// ---- hook handlers ----

/** PostToolUse for Bash. Returns the hook output object, or null. */
export function handlePostToolUse(input, { now = new Date() } = {}) {
  if (!input || (input.tool_name && input.tool_name !== 'Bash')) return null;
  const command = input.tool_input?.command;
  const { root, config } = loadProjectConfig(input.cwd || process.cwd());
  if (config.iacSync !== true) return null;
  const hits = classifyCommand(command);
  if (!hits.length) return null;
  mkdirSync(stateDir(root), { recursive: true });
  const ts = now.toISOString();
  const lines = hits.map((h) => JSON.stringify({ ts, cloud: h.cloud, command: truncate(redact(h.segment)) }));
  appendFileSync(pendingPath(root), `${lines.join('\n')}\n`);
  return { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 'Logged for IaC sync: update infra/ before finishing this round.' } };
}

/** Stop hook. Blocks once while changes are pending; never when stop_hook_active is true. */
export function handleStop(input, env = process.env) {
  if (!input || input.stop_hook_active === true) return null;
  const { root, config } = loadProjectConfig(input.cwd || process.cwd());
  if (config.iacSync !== true) return null;
  const pending = readPending(root);
  if (!pending.length) return null;
  const script = env.CLAUDE_PLUGIN_ROOT ? join(env.CLAUDE_PLUGIN_ROOT, 'scripts', 'iac-sync.mjs') : SELF;
  const list = pending.slice(0, 10).map((e) => `- ${e.cloud}: ${e.command}`).join('\n');
  const more = pending.length > 10 ? `\n- ... and ${pending.length - 10} more` : '';
  return {
    decision: 'block',
    reason: `IaC sync: ${pending.length} infrastructure change${pending.length === 1 ? '' : 's'} since the last sync:\n${list}${more}\nUpdate infra/ (Terraform or Bicep) to match, run the validation, append a dated entry to infra/CHANGES.md, then run: node "${script}" done`,
  };
}

// ---- CLI ----

async function readStdinJson() {
  if (process.stdin.isTTY) return {};
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8').trim() || '{}');
  } catch {
    return {};
  }
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  if (cmd === 'post-tool-use' || cmd === 'stop') {
    const input = await readStdinJson();
    const out = cmd === 'stop' ? handleStop(input) : handlePostToolUse(input);
    if (out) process.stdout.write(JSON.stringify(out));
    return;
  }
  const { root } = loadProjectConfig(process.cwd());
  if (cmd === 'status') {
    const pending = readPending(root);
    if (!pending.length) process.stdout.write('No pending infrastructure changes.\n');
    for (const e of pending) process.stdout.write(`${e.ts}  ${e.cloud}  ${e.command}\n`);
    return;
  }
  if (cmd === 'done') {
    const i = rest.indexOf('--note');
    const n = markDone(root, { note: i >= 0 ? rest[i + 1] || '' : '' });
    process.stdout.write(`Marked ${n} change${n === 1 ? '' : 's'} as synced.\n`);
    return;
  }
  process.stderr.write('Usage: iac-sync.mjs status | done [--note "..."] | post-tool-use | stop\n');
  process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`[iac-sync] ${err?.message || err}\n`);
    process.exit(0); // never break a session
  });
}
