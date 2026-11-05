#!/usr/bin/env node
// SessionStart: show docs/handoff/NOW.md (where the last session left off), if the project keeps one.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function projectRoot(start) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, '.git'))) return dir;
    const up = dirname(dir);
    if (up === dir) return resolve(start);
    dir = up;
  }
}

export function nowContext(root, maxLines = 60) {
  const file = join(root, 'docs', 'handoff', 'NOW.md');
  if (!existsSync(file)) return null;
  const lines = readFileSync(file, 'utf8').split('\n');
  const body = lines.slice(0, maxLines).join('\n').trim();
  const more = lines.length > maxLines ? `\n(${lines.length - maxLines} more lines in docs/handoff/NOW.md)` : '';
  return `**Where the last session left off** (docs/handoff/NOW.md; keep it current with kickoff:keeping-context-across-sessions):\n\n${body}${more}`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let raw = '';
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    try {
      const input = raw.trim() ? JSON.parse(raw) : {};
      const text = nowContext(projectRoot(input.cwd || process.cwd()));
      if (text) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }));
    } catch {
      /* never break session start */
    }
  });
}
