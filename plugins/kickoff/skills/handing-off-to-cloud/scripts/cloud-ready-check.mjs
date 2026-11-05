#!/usr/bin/env node
// Is this repo ready for a Claude Code cloud session? node cloud-ready-check.mjs [--repo <path>] [--json]
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function git(repo, args) {
  try {
    return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function anyFile(dir, pred, depth = 3) {
  if (!existsSync(dir) || depth < 0) return false;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory() && !['node_modules', '.git'].includes(e.name)) {
      if (anyFile(p, pred, depth - 1)) return true;
    } else if (e.isFile() && pred(p)) return true;
  }
  return false;
}

export function runChecks(repo) {
  const checks = [];
  const add = (status, name, detail) => checks.push({ status, name, detail });
  const remote = git(repo, ['remote', 'get-url', 'origin']);
  add(remote && /github\.com/.test(remote) ? 'PASS' : 'FAIL', 'GitHub remote', remote || 'no origin remote');
  const upstream = git(repo, ['rev-parse', '--abbrev-ref', '@{u}']);
  const ahead = upstream ? Number(git(repo, ['rev-list', '--count', '@{u}..HEAD'])) : null;
  add(upstream && ahead === 0 ? 'PASS' : 'FAIL', 'Branch pushed', upstream ? `${ahead} local commit(s) not pushed to ${upstream}` : 'no upstream branch');
  const dirty = git(repo, ['status', '--porcelain']);
  add(dirty === '' ? 'PASS' : 'WARN', 'Clean tree', dirty ? 'uncommitted changes will not reach the cloud' : 'clean');
  const claude = existsSync(join(repo, 'CLAUDE.md')) ? readFileSync(join(repo, 'CLAUDE.md'), 'utf8') : '';
  add(claude ? (/##\s*Commands/i.test(claude) ? 'PASS' : 'WARN') : 'FAIL', 'CLAUDE.md', claude ? 'present' : 'missing');
  add(existsSync(join(repo, '.env.example')) ? 'PASS' : 'FAIL', '.env.example', 'lists every variable name');
  const ignored = git(repo, ['check-ignore', '-q', '.env']) !== null;
  add(ignored ? 'PASS' : 'FAIL', '.env ignored', ignored ? 'git-ignored' : '.env is not git-ignored');
  const OWNER = /^#+\s.*(?:owner['’]?s? machine|owner-machine)/im;
  const specDirs = [join(repo, 'docs', 'specs'), join(repo, 'docs', 'superpowers', 'specs')];
  const ownerSection = specDirs.some((d) => anyFile(d, (p) => p.endsWith('.md') && OWNER.test(readFileSync(p, 'utf8')))) || ['DEPLOYMENT.md', 'CLAUDE.md'].some((f) => existsSync(join(repo, f)) && OWNER.test(readFileSync(join(repo, f), 'utf8')));
  add(ownerSection ? 'PASS' : 'WARN', 'Owner-machine list', ownerSection ? 'heading found in the spec' : 'add a "Work that must happen on the owner\'s machine" heading to the spec');
  add(existsSync(join(repo, '.claude', 'rules', 'workbench.md')) ? 'PASS' : 'FAIL', 'House rules vendored', '.claude/rules/workbench.md');
  const settings = existsSync(join(repo, '.claude', 'settings.json')) ? readFileSync(join(repo, '.claude', 'settings.json'), 'utf8') : '';
  add(settings.includes('cloud-setup.sh') ? 'PASS' : 'FAIL', 'Cloud SessionStart hook', '.claude/settings.json');
  add(existsSync(join(repo, 'docs', 'cloud', 'ENVIRONMENT.md')) ? 'PASS' : 'WARN', 'Environment doc', 'docs/cloud/ENVIRONMENT.md');
  const brief = existsSync(join(repo, 'docs', 'handoff')) && readdirSync(join(repo, 'docs', 'handoff')).some((f) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f) && !f.endsWith('-report.md'));
  add(brief ? 'PASS' : 'WARN', 'Handoff brief', brief ? 'docs/handoff/<date>-*.md' : 'write one before launching');
  const example = existsSync(join(repo, '.env.example')) ? readFileSync(join(repo, '.env.example'), 'utf8') : '';
  add(/mock/i.test(example) ? 'PASS' : 'WARN', 'Mock switches', /mock/i.test(example) ? 'mock flags documented' : 'no MOCK/mock flags in .env.example');
  const scanner = join(repo, '.claude', 'hooks', 'workbench', 'scripts', 'secret-scan.mjs');
  if (existsSync(scanner)) {
    try {
      execFileSync('node', [scanner, '--tree'], { cwd: repo, stdio: 'ignore' });
      add('PASS', 'Secret scan of tracked files', 'no findings');
    } catch {
      add('FAIL', 'Secret scan of tracked files', `run: node ${scanner} --tree`);
    }
  } else add('WARN', 'Secret scan of tracked files', 'scanner not vendored yet');
  return checks;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const repo = resolve(args.includes('--repo') ? args[args.indexOf('--repo') + 1] : process.cwd());
  const checks = runChecks(repo);
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(checks, null, 2)}\n`);
  else for (const c of checks) process.stdout.write(`${c.status.padEnd(4)}  ${c.name}: ${c.detail}\n`);
  process.exit(checks.some((c) => c.status === 'FAIL') ? 1 : 0);
}
