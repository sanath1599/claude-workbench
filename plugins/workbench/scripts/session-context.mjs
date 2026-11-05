#!/usr/bin/env node
// SessionStart: inject the house rules, the owner's profile, this project's workbench
// settings, and a few situational notes (cloud session, missing graph, missing setup).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN_ROOT, additionalContext, isMain, loadProfile, loadProjectConfig, readStdinJson, renderTokens, runSafely } from './lib.mjs';

const PROFILE_KEYS = [
  ['owner_name', 'Owner'],
  ['owner_email', 'Email'],
  ['git_author_email', 'Git author email (Vercel-deployed repos)'],
  ['github_owner', 'GitHub account'],
  ['github_orgs', 'GitHub orgs'],
  ['default_repo_visibility', 'New repos'],
  ['domain', 'Domain'],
  ['dns_provider', 'DNS'],
  ['email_provider', 'Email provider'],
  ['email_from', 'Default sender'],
  ['hosting', 'Hosting'],
  ['vercel_scope', 'Vercel scope'],
  ['vps_hosts', 'VPS ssh aliases'],
  ['timezone', 'Timezone'],
];

export function buildContext({ cwd, profileInfo, projectInfo, env = process.env, rulesText }) {
  const { profile, personalised, source } = profileInfo;
  const parts = [renderTokens(rulesText, profile).trim()];

  const facts = PROFILE_KEYS.filter(([k]) => profile[k] && (!Array.isArray(profile[k]) || profile[k].length))
    .map(([k, label]) => `${label}: ${Array.isArray(profile[k]) ? profile[k].join(', ') : profile[k]}`);
  parts.push(`**Owner profile** (${personalised ? source : 'bundled defaults, not personalised yet'}). In workbench skills, a token like {{wb.domain}} means the matching value here.\n${facts.map((f) => `- ${f}`).join('\n')}`);
  if (!personalised) parts.push('The profile has not been personalised on this machine. When it fits, suggest `/workbench:setup` once. It takes about 3 minutes.');

  if (projectInfo.path) {
    const c = projectInfo.config;
    parts.push(`**This project** (${projectInfo.path}): commits=${c.commits}, co-author trailer=${c.coAuthorTrailer}, branches=${c.branchPolicy}, cloud handoff=${c.cloudHandoff}, production deploys=${c.productionDeploys}.`);
    if (c.graphify !== false && !existsSync(join(projectInfo.root, 'graphify-out'))) {
      parts.push('This project has no graphify graph yet. Once the base setup is done, run `/graphify`.');
    }
  } else if (existsSync(join(projectInfo.root, '.git'))) {
    parts.push('This repo has no `.claude/workbench.json` yet. If the owner is starting or reshaping the project, use kickoff:starting-a-project, which records the commit, cloud and deploy policy. Otherwise apply the defaults above.');
  }

  if (env.CLAUDE_CODE_REMOTE === 'true') {
    parts.push('**Cloud session.** Only the repo is here; there is no ~/.claude and no local services. Read docs/handoff/ first. Do not deploy to production, migrate remote databases, change DNS, provision paid resources or send real email from here. Those are owner-machine steps: list them in the handoff report. Push small commits often to the working branch, and never merge to main.');
  }
  return parts.join('\n\n');
}

if (isMain(import.meta.url)) {
  runSafely(async () => {
    const input = await readStdinJson();
    const cwd = input.cwd || process.cwd();
    const rulesText = readFileSync(join(PLUGIN_ROOT, 'rules.md'), 'utf8');
    const text = buildContext({ cwd, profileInfo: loadProfile(), projectInfo: loadProjectConfig(cwd), rulesText });
    additionalContext('SessionStart', text);
  });
}
