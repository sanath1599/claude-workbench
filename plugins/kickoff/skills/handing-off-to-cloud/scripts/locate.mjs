// Find sibling workbench plugins whether we run from a marketplace clone
// (<root>/plugins/<plugin>/...) or from the plugin cache (<cache>/<marketplace>/<plugin>/<version>/...).
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

function newestVersionDir(pluginDir) {
  if (!existsSync(pluginDir)) return null;
  if (existsSync(join(pluginDir, '.claude-plugin', 'plugin.json'))) return pluginDir;
  const versions = readdirSync(pluginDir)
    .map((v) => join(pluginDir, v))
    .filter((p) => existsSync(join(p, '.claude-plugin', 'plugin.json')))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return versions[0] || null;
}

/** Directory of a plugin (e.g. "workbench") next to this one. */
export function locatePlugin(name, start = HERE) {
  let dir = start;
  for (let i = 0; i < 8; i += 1) {
    const inClone = join(dir, 'plugins', name);
    if (existsSync(join(inClone, '.claude-plugin', 'plugin.json'))) return inClone;
    const inCache = newestVersionDir(join(dir, name));
    if (inCache && dir !== start) return inCache;
    dir = dirname(dir);
  }
  const marketplaces = join(homedir(), '.claude', 'plugins', 'marketplaces');
  if (existsSync(marketplaces)) {
    for (const m of readdirSync(marketplaces)) {
      const p = join(marketplaces, m, 'plugins', name);
      if (existsSync(join(p, '.claude-plugin', 'plugin.json'))) return p;
    }
  }
  return null;
}

export function locateSkill(plugin, skill, start = HERE) {
  const root = locatePlugin(plugin, start);
  const dir = root && join(root, 'skills', skill);
  return dir && existsSync(join(dir, 'SKILL.md')) ? dir : null;
}
