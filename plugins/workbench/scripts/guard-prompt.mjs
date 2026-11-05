#!/usr/bin/env node
// UserPromptSubmit. Never blocks the prompt. Adds context in two cases:
// 1. The owner pasted something that looks like a live credential: don't echo it, suggest rotation.
// 2. The owner stated a durable preference or shared a useful finding: fold it into the workbench.
import { additionalContext, isMain, readStdinJson, runSafely } from './lib.mjs';
import { scanText } from './secret-scan.mjs';

const LEARNING = /\b(?:from now on|going forward|in future|always (?:use|do|make|keep|run|add|ask)|never (?:use|do|add|ask|again)|don'?t ever|do not ever|stop (?:using|adding|doing)|remember (?:this|that|to)|make (?:this|that|it) a rule|my preference|i prefer|note (?:this|that) down|add (?:this|that|it) to (?:your|the) (?:memory|skills?|rules)|update (?:the|your|my) skills?|this is (?:very |really )?(?:useful|important|good to know)|til\b|today i learned|found (?:a|this|an) (?:great|useful|new|better))/i;

export function evaluate(prompt) {
  const notes = [];
  const findings = scanText(prompt || '', 'prompt');
  if (findings.length) {
    const kinds = [...new Set(findings.map((f) => f.rule))].join(', ');
    notes.push(`The user's message appears to contain a live credential (${kinds}). Do not repeat, log or commit it. Put it only in the git-ignored .env (or the cloud environment's settings), and suggest rotating it in one short line since it now sits in chat history.`);
  }
  if (LEARNING.test(prompt || '')) {
    notes.push('This message may state a durable preference or a useful finding. After handling the request, use workbench:update-skill to fold it into the workbench. Update the closest existing skill, or create a new one if none fits. Tell the owner in one line what changed.');
  }
  return notes.length ? notes.join('\n\n') : null;
}

if (isMain(import.meta.url)) {
  runSafely(async () => {
    const input = await readStdinJson();
    const note = evaluate(input.prompt);
    if (note) additionalContext('UserPromptSubmit', note);
  });
}
