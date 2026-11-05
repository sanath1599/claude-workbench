#!/usr/bin/env node
// PreToolUse guard for Bash. Blocks commits/pushes that carry secrets, asks before
// production/infra/outward actions, and keeps house rules (sileo, npm, no .env printing).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isMain, loadProfile, loadProjectConfig, preToolUseDecision, readStdinJson, runSafely } from './lib.mjs';
import { formatFindings, scanPush, scanText, scanWorking } from './secret-scan.mjs';

// One shell "segment" = text up to a command separator, so flags are matched to their own command.
const SEG = String.raw`[^|;&\n]*`;

export const ASK_RULES = [
  { id: 'vercel-prod', re: new RegExp(String.raw`\bvercel\b${SEG}(?:\s--prod\b|\s--production\b|\spromote\b|\srollback\b)`), why: 'deploys or changes Vercel production' },
  { id: 'vercel-alias', re: new RegExp(String.raw`\bvercel\s+(?:alias|domains)\s+(?:set|add|rm|remove)\b`), why: 'changes Vercel domains/aliases' },
  { id: 'vercel-env-prod', re: new RegExp(String.raw`\bvercel\s+env\s+(?:add|rm|remove|update)\b${SEG}\bproduction\b`), why: 'changes production environment variables' },
  { id: 'vercel-env-pull', re: new RegExp(String.raw`\bvercel\s+env\s+pull\b`), why: 'writes an env file (can overwrite local keys)' },
  { id: 'livekit-deploy', re: /\blk\s+agent\s+(?:deploy|create|update-secrets|delete|rollback)\b/, why: 'deploys or changes the LiveKit Cloud agent' },
  { id: 'prisma-destructive', re: new RegExp(String.raw`\bprisma\s+(?:migrate\s+reset\b|db\s+push\b${SEG}--(?:force-reset|accept-data-loss))`), why: 'can wipe database data' },
  { id: 'gh-public-repo', re: new RegExp(String.raw`\bgh\s+repo\s+(?:create\b${SEG}--public\b|edit\b${SEG}--visibility[=\s]+public\b)`), why: 'makes a repository public' },
  { id: 'gh-repo-delete', re: /\bgh\s+repo\s+(?:delete|archive)\b/, why: 'deletes or archives a repository' },
  { id: 'force-push', re: new RegExp(String.raw`\bgit\s+push\b${SEG}(?:\s--force\b|\s-f\b|\s--force-with-lease\b|\s\+\S)`), why: 'force-pushes (rewrites remote history)' },
  { id: 'remote-restart', re: /\bssh\s+\S+[\s\S]*?\b(?:pm2\s+(?:restart|reload|start|delete)|systemctl\s+(?:restart|reload|stop)|docker\s+compose\s+(?:up|down)|nginx\s+-s\s+reload)\b/, why: 'restarts services on a remote server' },
  { id: 'azure-change', re: new RegExp(String.raw`\baz\s+(?!account\b|login\b)${SEG}\b(?:create|delete|update|set|deploy|deployment|restart|start|stop|assign|purge)\b`), why: 'changes Azure resources' },
  { id: 'iac-apply', re: /\b(?:terraform|tofu|pulumi)\s+(?:apply|destroy|up)\b|\bkubectl\s+(?:apply|delete|rollout|scale|patch)\b|\bhelm\s+(?:install|upgrade|uninstall)\b/, why: 'applies infrastructure changes' },
  { id: 'cloudflare-write', re: new RegExp(String.raw`\bcurl\b${SEG}api\.cloudflare\.com${SEG}-X\s*['"]?(?:POST|PUT|PATCH|DELETE)`, 'i'), why: 'changes Cloudflare DNS/config' },
  { id: 'resend-send', re: new RegExp(String.raw`\bcurl\b${SEG}api\.resend\.com/emails`), why: 'sends a real email' },
  { id: 'neon-remote-migrate', re: new RegExp(String.raw`(?:NEON_DATABASE_URL|DATABASE_URL_PROD|PROD_DATABASE_URL)${SEG}\b(?:prisma|alembic|migrate)\b`), why: 'migrates a production database' },
  { id: 'temporal-prod', re: new RegExp(String.raw`\btemporal\s+(?:workflow\s+(?:terminate|reset|delete)|batch\b|operator\s+namespace\s+delete)\b`), why: 'terminates/resets Temporal workflows' },
];

const TOAST_INSTALL = new RegExp(String.raw`\b(?:npm|pnpm|yarn|bun)\s+(?:i|install|add)\b${SEG}\b(sonner|react-hot-toast|react-toastify|notistack|vue-toastification)\b|\bshadcn(?:-ui)?(?:@\S+)?\s+add\b${SEG}\bsonner\b`);
const PNPM = /(?:^|[\s;&|(])pnpm\s+(?:i|install|add|dlx|create|init)\b/;
const PRINT_ENV = /\b(?:cat|less|more|head|tail|bat|nl|strings|xxd|od)\b[^|;&\n]*?(?:^|[\s/'"=])\.env(?:\.(?!example\b|sample\b|template\b|dist\b)[A-Za-z0-9_.-]+)?(?=$|[\s'"|;&)])/;
const COMMIT = /\bgit\s+(?:-[^\s]+\s+)*commit\b/;
const PUSH = /\bgit\s+(?:-[^\s]+\s+)*push\b|\bgh\s+pr\s+create\b/;

export function evaluate(command, { cwd = process.cwd(), profile = {}, project = {}, scan = { working: scanWorking, push: scanPush } } = {}) {
  if (!command || typeof command !== 'string') return null;

  if ((profile.toast_library || 'sileo') === 'sileo' && TOAST_INSTALL.test(command)) {
    return { decision: 'deny', reason: 'House rule: toasts use the `sileo` package (`npm i sileo`), not sonner or other toast libraries. See workbench:using-sileo-toasts.' };
  }

  if (PNPM.test(command) && (profile.package_manager || 'npm') !== 'pnpm' && !existsSync(join(cwd, 'pnpm-lock.yaml'))) {
    return { decision: 'deny', reason: 'House rule: use npm (or the lockfile the repo already has). This repo has no pnpm-lock.yaml, so do not introduce pnpm.' };
  }

  if (PRINT_ENV.test(command)) {
    return { decision: 'deny', reason: 'House rule: never print secrets. To see which keys exist without values, run `cut -d= -f1 .env` (or grep -c for one key).' };
  }

  const commandSecrets = scanText(command, '(command)');
  if (commandSecrets.length && (COMMIT.test(command) || PUSH.test(command) || /\b(?:echo|printf)\b/.test(command))) {
    return { decision: 'deny', reason: `The command itself contains what looks like a secret:\n${formatFindings(commandSecrets)}\nRead it from the environment instead of inlining it.` };
  }

  if (COMMIT.test(command)) {
    const findings = scan.working(cwd);
    if (findings.length) {
      return { decision: 'deny', reason: `Secret scan blocked this commit. Possible secrets in changes this command could commit:\n${formatFindings(findings)}\nMove them to .env (git-ignored) or a secret store and retry. If a hit is a false positive, add the comment \`workbench:allow-secret\` on that line.` };
    }
  }

  if (PUSH.test(command)) {
    const findings = scan.push(cwd);
    if (findings.length) {
      return { decision: 'deny', reason: `Secret scan blocked this push. Possible secrets in what would be published:\n${formatFindings(findings)}\nRemove them (rewrite the commit if needed: the secret must also be rotated once pushed anywhere) and retry.` };
    }
  }

  const autoProd = project.productionDeploys === 'auto-on-main';
  for (const rule of ASK_RULES) {
    if (autoProd && rule.id === 'vercel-prod') continue;
    if (rule.re.test(command)) {
      return { decision: 'ask', reason: `Workbench gate (${rule.id}): this ${rule.why}. The owner approves these one at a time. State what changes, the cost, and how to undo it.` };
    }
  }
  return null;
}

if (isMain(import.meta.url)) {
  runSafely(async () => {
    const input = await readStdinJson();
    if (input.tool_name && input.tool_name !== 'Bash') return;
    const cwd = input.cwd || process.cwd();
    const { profile } = loadProfile();
    const { config } = loadProjectConfig(cwd);
    const verdict = evaluate(input.tool_input?.command, { cwd, profile, project: config });
    if (verdict) preToolUseDecision(verdict.decision, verdict.reason);
  });
}
