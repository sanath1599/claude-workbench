#!/usr/bin/env node
// Rank workbench skills against keywords: node scripts/find-skill.mjs "temporal approval timeout" [--top 5] [--json]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'for', 'on', 'with', 'use', 'when', 'is', 'it', 'this', 'that']);

export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ''))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function parseSkill(text) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(text);
  const front = fm ? fm[1] : '';
  const name = (/^name:\s*(.+)$/m.exec(front) || [])[1]?.trim() || '';
  const description = (/^description:\s*(.+)$/m.exec(front) || [])[1]?.trim() || '';
  return { name, description, body: fm ? text.slice(fm[0].length) : text };
}

export function listSkills(root = ROOT) {
  const out = [];
  const pluginsDir = join(root, 'plugins');
  if (!existsSync(pluginsDir)) return out;
  for (const plugin of readdirSync(pluginsDir)) {
    const skillsDir = join(pluginsDir, plugin, 'skills');
    if (!existsSync(skillsDir)) continue;
    for (const skill of readdirSync(skillsDir)) {
      const file = join(skillsDir, skill, 'SKILL.md');
      if (existsSync(file)) out.push({ plugin, dir: skill, file, ...parseSkill(readFileSync(file, 'utf8')) });
    }
  }
  return out;
}

export function rank(query, skills) {
  const q = [...new Set(tokenize(query))];
  return skills
    .map((s) => {
      const name = new Set(tokenize(s.name.replace(/-/g, ' ')));
      const desc = tokenize(s.description);
      const body = tokenize(s.body);
      let score = 0;
      for (const t of q) {
        if (name.has(t)) score += 5;
        score += 2 * desc.filter((d) => d === t || d.startsWith(t)).length;
        score += Math.min(6, body.filter((b) => b === t).length) * 0.5;
      }
      return { id: `${s.plugin}:${s.name || s.dir}`, score: Math.round(score * 10) / 10, description: s.description, file: s.file };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const top = Number(args[args.indexOf('--top') + 1]) || 5;
  const query = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--top').join(' ');
  const results = rank(query, listSkills()).slice(0, top);
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  else if (!results.length) process.stdout.write('No matching skill. Consider a new one (see docs/authoring.md).\n');
  else for (const r of results) process.stdout.write(`${r.score.toString().padStart(5)}  ${r.id}\n       ${r.description.slice(0, 160)}\n`);
}
