#!/usr/bin/env node
// PreToolUse guard for Write/Edit/MultiEdit: sileo toasts, no emojis in UI files,
// no secrets written into tracked files, and never silently overwrite the owner's .env.
import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { isMain, loadProfile, preToolUseDecision, readStdinJson, runSafely } from './lib.mjs';
import { formatFindings, isEnvFile, scanText } from './secret-scan.mjs';

const TOAST_IMPORT = /(?:from\s+|require\(\s*|import\s+)['"](sonner|react-hot-toast|react-toastify|notistack|vue-toastification|@\/components\/ui\/sonner|~\/components\/ui\/sonner)['"]/;
const UI_FILE = /\.(?:tsx|jsx|vue|svelte|astro|html?|mdx)$/i;
const EMOJI = /\p{Extended_Pictographic}/u;
const NOT_EMOJI = /[©®™←-⇿•…‼⁉]/gu; // ©, ®, ™, arrows, bullets, ellipsis
const GENERATED = /(?:^|\/)(?:node_modules|dist|build|\.next|coverage|generated|graphify-out)\//;

export function newText(toolName, input = {}) {
  if (toolName === 'Write') return input.content || '';
  if (toolName === 'Edit') return input.new_string || '';
  if (toolName === 'MultiEdit') return (input.edits || []).map((e) => e.new_string || '').join('\n');
  return '';
}

export function evaluate(toolName, input = {}, { profile = {}, fileExists = existsSync } = {}) {
  const path = input.file_path || input.path || '';
  if (!path || GENERATED.test(path)) return null;
  const text = newText(toolName, input);

  if (isEnvFile(path)) {
    if (fileExists(path)) {
      return { decision: 'ask', reason: `Workbench gate: ${basename(path)} already exists and belongs to the owner. Overwriting or editing it can lose keys. Confirm with the owner, or add new keys to .env.example and let them fill the value.` };
    }
    return null; // creating a fresh env file (placeholders) is fine; it is git-ignored
  }

  if ((profile.toast_library || 'sileo') === 'sileo' && TOAST_IMPORT.test(text)) {
    return { decision: 'deny', reason: "House rule: toasts use `sileo` — `import { sileo, Toaster } from 'sileo'` plus `import 'sileo/styles.css'`. Don't import sonner or other toast libraries. See workbench:using-sileo-toasts." };
  }

  if (profile.no_emoji_in_ui !== false && UI_FILE.test(path)) {
    const stripped = text.replace(NOT_EMOJI, '');
    if (EMOJI.test(stripped)) {
      const sample = [...stripped].filter((ch) => EMOJI.test(ch)).slice(0, 5).join(' ');
      return { decision: 'deny', reason: `House rule: no emojis in UI (found: ${sample}). Use Lucide icons (lucide-react) instead.` };
    }
  }

  if (!/\.(?:example|sample|template)$/.test(path) && !/(?:^|\/)(?:tests?|__tests__|fixtures?)\//.test(path)) {
    const findings = scanText(text, basename(path));
    if (findings.length) {
      return { decision: 'deny', reason: `This write would put what looks like a secret into ${basename(path)}:\n${formatFindings(findings)}\nRead it from an environment variable instead, and keep the value in the git-ignored .env.` };
    }
  }
  return null;
}

if (isMain(import.meta.url)) {
  runSafely(async () => {
    const input = await readStdinJson();
    const { profile } = loadProfile();
    const verdict = evaluate(input.tool_name, input.tool_input || {}, { profile });
    if (verdict) preToolUseDecision(verdict.decision, verdict.reason);
  });
}
