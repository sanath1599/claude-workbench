#!/usr/bin/env node
// Read-only detection for /workbench:setup. Prints JSON. Never prints secrets.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { locateSource } from './render-package.mjs';

function run(cmd, args, timeout = 6000) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

const profilePath = join(homedir(), '.claude', 'workbench', 'profile.json');
let existingProfile = null;
if (existsSync(profilePath)) {
  try {
    existingProfile = JSON.parse(readFileSync(profilePath, 'utf8'));
  } catch {
    existingProfile = { error: 'profile.json exists but is not valid JSON' };
  }
}

const ghLogin = run('gh', ['api', 'user', '--jq', '.login']);
const out = {
  git: {
    name: run('git', ['config', '--global', 'user.name']),
    email: run('git', ['config', '--global', 'user.email']),
  },
  github: {
    login: ghLogin,
    orgs: ghLogin ? run('gh', ['api', 'user/orgs', '--jq', '.[].login']).split('\n').filter(Boolean) : [],
  },
  vercel: { user: run('vercel', ['whoami'], 8000).split('\n').pop() || '' },
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  tools: Object.fromEntries(['node', 'npm', 'pnpm', 'uv', 'docker', 'gh', 'vercel', 'lk', 'temporal'].map((t) => [t, Boolean(run('which', [t]))])),
  existingProfile: existingProfile ? { path: profilePath, profile: existingProfile } : null,
  marketplaceSource: locateSource() || null,
};
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
