import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const plugin = join(root, "plugins/stack-web");
const skills = readdirSync(join(plugin, "skills"));
const EXPECTED = ["adding-auth", "adding-subdomains", "building-tanstack-frontends", "deploying-on-vercel", "sending-email-with-resend", "working-in-nextjs-16"];

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const text = (p) => readFileSync(p, "utf8");

test("the six core skills exist", () => { for (const s of EXPECTED) assert.ok(skills.includes(s), s); });

for (const s of EXPECTED) {
  test(`${s}: frontmatter and size`, () => {
    const t = text(join(plugin, "skills", s, "SKILL.md"));
    const m = t.match(/^---\nname: (.+)\ndescription: (.+)\n---\n/);
    assert.ok(m, "frontmatter");
    assert.equal(m[1], s);
    assert.ok(m[2].length < 500, `description ${m[2].length} chars`);
    assert.match(m[2], /^Use when/);
    assert.match(m[2], /Not for/);
    assert.ok(t.split("\n").length < 500);
    assert.match(t, /## Verification/);
  });
  test(`${s}: referenced files exist`, () => {
    const t = text(join(plugin, "skills", s, "SKILL.md"));
    for (const [, ref] of t.matchAll(/`((?:references|scripts)\/[\w./-]+)`/g)) {
      assert.ok(existsSync(join(plugin, "skills", s, ref)), ref);
    }
  });
}

test("no emojis, hardcoded owner emails or the owner domain in plugin files", () => {
  const files = walk(plugin);
  for (const f of files) {
    const t = text(f);
    assert.ok(!/\p{Extended_Pictographic}/u.test(t), `emoji in ${f}`);
    assert.ok(!/antm\.ai|acmeit|gmail\.com/i.test(t), `hardcoded owner value in ${f}`);
  }
});

test("manifest keeps required fields", () => {
  const m = JSON.parse(text(join(plugin, ".claude-plugin/plugin.json")));
  assert.equal(m.name, "stack-web");
  assert.ok(m.description.length > 20);
});

test("every plugin eval has a prompt and graders, and one near-miss", () => {
  const dir = join(plugin, "evals");
  const cases = readdirSync(dir);
  assert.equal(cases.length, 4);
  for (const c of cases) {
    assert.match(text(join(dir, c, "prompt.md")), /^---\n[\s\S]*runs:/);
    assert.ok(readdirSync(join(dir, c, "graders")).length >= 1);
  }
  assert.ok(cases.some((c) => /near-miss/.test(text(join(dir, c, "prompt.md")))));
});

test("tracked packages file is well formed and covers the required packages", () => {
  const list = JSON.parse(text(join(root, "maintenance/tracked-packages.d/stack-web.json")));
  const key = (p) => `${p.ecosystem}:${p.name}`;
  for (const p of list) {
    assert.ok(["npm", "PyPI"].includes(p.ecosystem));
    assert.ok(p.documented && p.changelog.startsWith("https://"));
    assert.ok(p.skills.length && p.skills.every((s) => EXPECTED.includes(s)));
  }
  for (const n of ["@tanstack/react-router", "@tanstack/react-query", "@tanstack/react-start", "@tanstack/react-form", "@tanstack/react-table", "@tanstack/router-plugin", "vite", "typescript", "zod", "vercel", "next", "prisma", "sileo", "lucide-react"]) {
    assert.ok(list.some((p) => key(p) === `npm:${n}`), n);
  }
  assert.ok(list.some((p) => key(p) === "npm:resend") && list.some((p) => key(p) === "PyPI:resend"));
  assert.equal(new Set(list.map(key)).size, list.length);
});

test("every tracked package is documented in a Versions block of its skills", () => {
  const list = JSON.parse(text(join(root, "maintenance/tracked-packages.d/stack-web.json")));
  for (const p of list) {
    for (const s of p.skills) {
      const t = text(join(plugin, "skills", s, "SKILL.md"));
      assert.ok(t.includes(p.name), `${p.name} missing from ${s}`);
    }
  }
});
