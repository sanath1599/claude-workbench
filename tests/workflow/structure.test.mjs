import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const root = "plugins/workflow";
const SKILLS = [
  "shaping-the-work", "writing-implementation-plans", "executing-plans", "debugging-systematically",
  "test-first-changes", "verifying-before-done", "reviewing-code-before-merge", "simplifying-code",
  "finishing-a-branch", "working-in-parallel-sessions",
];
const AGENTS = ["code-reviewer", "code-simplifier", "plan-critic"];
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, "missing frontmatter");
  const fm = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { fm, body: text.slice(m[0].length) };
}
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

test("plugin.json is complete", () => {
  const p = JSON.parse(readFileSync(join(root, ".claude-plugin/plugin.json"), "utf8"));
  assert.equal(p.name, "workflow");
  assert.equal(p.version, "0.1.0");
  assert.equal(p.license, "PolyForm-Noncommercial-1.0.0");
  assert.equal(p.repository, "https://github.com/sanath1599/claude-workbench");
  assert.equal(p.author.name, "Claude Code / Codex Starter Pack contributors");
});

test("the skill directory lists exactly the expected skills", () => {
  assert.deepEqual(readdirSync(join(root, "skills")).sort(), [...SKILLS].sort());
});

for (const s of SKILLS) {
  test(`skill ${s}: frontmatter, sections, size`, () => {
    const text = readFileSync(join(root, "skills", s, "SKILL.md"), "utf8");
    const { fm, body } = frontmatter(text);
    assert.equal(fm.name, s);
    assert.match(fm.description, /^Use when/);
    assert.ok(fm.description.length < 500, `description is ${fm.description.length} chars`);
    assert.match(fm.description, /Not for/);
    for (const h of ["## When to use", "## When not to use", "## Procedure", "## Verification", "## References"]) {
      assert.ok(body.includes(h), `missing ${h}`);
    }
    const words = body.split(/\s+/).length;
    assert.ok(words >= 400 && words <= 1900, `${words} words`);
    assert.ok(text.split("\n").length < 500);
    assert.ok(body.includes("Done when:"));
    assert.ok(!EMOJI.test(text));
  });

  test(`skill ${s}: every referenced file exists`, () => {
    const text = readFileSync(join(root, "skills", s, "SKILL.md"), "utf8");
    const refs = [...text.matchAll(/\|\s*((?:references|assets|scripts)\/[\w.\-/]+)\s*\|/g)].map((m) => m[1]);
    assert.ok(refs.length > 0, "no references listed");
    for (const r of refs) assert.ok(existsSync(join(root, "skills", s, r)), `${s}: missing ${r}`);
  });
}

for (const a of AGENTS) {
  test(`agent ${a}: frontmatter`, () => {
    const { fm, body } = frontmatter(readFileSync(join(root, "agents", `${a}.md`), "utf8"));
    assert.equal(fm.name, a);
    assert.match(fm.description, /^Use when/);
    assert.equal(fm.model, "sonnet");
    assert.ok(fm.tools);
    assert.ok(body.includes("Output format"));
  });
}

test("no emojis anywhere in the plugin", () => {
  for (const f of walk(root)) {
    if (/\.(md|json|mjs|html)$/.test(f)) assert.ok(!EMOJI.test(readFileSync(f, "utf8")), f);
  }
});

test("references do not chain to other references", () => {
  for (const f of walk(root).filter((f) => f.includes("/references/") && f.endsWith(".md"))) {
    assert.ok(!/\]\((?:\.\/)?references\//.test(readFileSync(f, "utf8")), f);
  }
});

test("no profile secrets or personal emails", () => {
  for (const f of walk(root)) {
    if (/\.(md|json)$/.test(f)) assert.ok(!/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(readFileSync(f, "utf8")), f);
  }
});
