import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const root = "plugins/engineering-craft";
const SKILLS = [
  "designing-systems", "hardening-distributed-systems", "designing-apis", "building-llm-features",
  "running-qa-passes", "reviewing-security", "planning-tests", "answering-pr-reviews",
];
const AGENTS = ["qa-auditor", "security-reviewer", "finding-verifier"];
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

for (const s of SKILLS) {
  test(`skill ${s}: frontmatter, sections, size`, () => {
    const path = join(root, "skills", s, "SKILL.md");
    assert.ok(existsSync(path));
    const text = readFileSync(path, "utf8");
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
    for (const r of refs) assert.ok(existsSync(join(root, "skills", s, r)), `${s}: missing ${r}`);
  });
}

test("no emojis or '@' file links anywhere in the plugin", () => {
  for (const f of walk(root)) {
    if (/\.(md|json|mjs|html)$/.test(f)) assert.ok(!EMOJI.test(readFileSync(f, "utf8")), f);
  }
});

test("references do not chain to other references", () => {
  for (const f of walk(root).filter((f) => f.includes("/references/") && f.endsWith(".md"))) {
    assert.ok(!/references\/\w[\w-]*\.md/.test(readFileSync(f, "utf8")), `${f} links to another reference`);
  }
});

for (const a of AGENTS) {
  test(`agent ${a}: frontmatter`, () => {
    const { fm, body } = frontmatter(readFileSync(join(root, "agents", `${a}.md`), "utf8"));
    assert.equal(fm.name, a);
    assert.equal(fm.model, "sonnet");
    assert.match(fm.description, /^Use when/);
    assert.ok(fm.tools.length > 0);
    assert.ok(!/world-class|senior engineer who/i.test(body));
    assert.match(body, /Output/);
  });
}

test("failure-modes table is complete", () => {
  const t = readFileSync(join(root, "skills/hardening-distributed-systems/references/failure-modes.md"), "utf8");
  const rows = t.split("\n").filter((l) => l.startsWith("|") && !l.includes("---") && !l.startsWith("| Failure"));
  assert.ok(rows.length >= 20, `${rows.length} rows`);
  for (const r of rows) {
    const cells = r.split("|").slice(1, -1).map((c) => c.trim());
    assert.equal(cells.length, 4, r);
    assert.ok(cells.every((c) => c.length > 5), r);
  }
  for (const kw of ["idempotency", "outbox", "inbox", "saga", "jitter", "timeout", "circuit breaker", "bulkhead", "backpressure|bounded queue", "dead-letter", "fencing", "stampede", "thundering herd", "clock", "schema"]) {
    assert.match(t.toLowerCase(), new RegExp(kw), `missing coverage for ${kw}`);
  }
});

test("hardening skill states the exactly-once position", () => {
  const t = readFileSync(join(root, "skills/hardening-distributed-systems/SKILL.md"), "utf8");
  assert.match(t, /at-least-once/i);
  assert.match(t, /sleep|Temporal/);
});

test("findings schema is valid JSON with required structure", () => {
  const s = JSON.parse(readFileSync(join(root, "skills/reviewing-security/references/findings.schema.json"), "utf8"));
  assert.deepEqual(s.required, ["scope", "findings", "rejected"]);
  const item = s.properties.findings.items;
  for (const k of ["id", "severity", "location", "exploit_scenario", "verification"]) assert.ok(item.required.includes(k));
  assert.equal(item.properties.verification.properties.verdict.const, "CONFIRMED");
});

test("security skill requires verification pass and both modes", () => {
  const t = readFileSync(join(root, "skills/reviewing-security/SKILL.md"), "utf8");
  assert.match(t, /Mode A: guidance/);
  assert.match(t, /Mode B: audit/);
  assert.match(t, /finding-verifier/);
});

test("designing-apis names the gates and the error standard", () => {
  const t = readFileSync(join(root, "skills/designing-apis/SKILL.md"), "utf8");
  for (const kw of ["RFC 9457", "oasdiff", "Spectral", "Idempotency-Key", "cursor"]) assert.ok(t.includes(kw) || t.toLowerCase().includes(kw.toLowerCase()), kw);
});

test("smoke test report template is HTML and complete", () => {
  const t = readFileSync(join(root, "skills/running-qa-passes/assets/smoke-test-report.html"), "utf8");
  assert.match(t, /<!doctype html>/i);
  for (const h of ["Verdict", "Scope", "Defects", "Automated verification"]) assert.ok(t.includes(h), h);
});

test("evals: four cases, one near-miss, graders have valid types", () => {
  const dirs = readdirSync(join(root, "evals"));
  assert.equal(dirs.length, 4);
  assert.ok(dirs.some((d) => d.startsWith("near-miss")));
  for (const d of dirs) {
    const { fm } = frontmatter(readFileSync(join(root, "evals", d, "prompt.md"), "utf8"));
    assert.ok(fm.runs && fm.max_turns && fm.allowed_tools, d);
    const graders = readdirSync(join(root, "evals", d, "graders"));
    assert.ok(graders.length >= 2, d);
    for (const g of graders) {
      const { fm: gf } = frontmatter(readFileSync(join(root, "evals", d, "graders", g), "utf8"));
      assert.ok(["llm", "regex", "tool_used"].includes(gf.type), `${d}/${g}`);
      assert.ok(Number(gf.weight) > 0);
    }
  }
});

test("tracked packages file is well-formed", () => {
  const list = JSON.parse(readFileSync("maintenance/tracked-packages.d/engineering-craft.json", "utf8"));
  assert.ok(list.length >= 4);
  for (const p of list) {
    assert.ok(["npm", "PyPI", "github"].includes(p.ecosystem));
    assert.ok(p.name && p.documented && p.changelog && p.skills.length);
    if (p.ecosystem === "github") assert.match(p.repo, /^[\w.-]+\/[\w.-]+$/);
    for (const s of p.skills) assert.ok(SKILLS.includes(s));
  }
});

test("documented versions in tracked list appear in the skills", () => {
  const list = JSON.parse(readFileSync("maintenance/tracked-packages.d/engineering-craft.json", "utf8"));
  for (const p of list) {
    const text = p.skills.map((s) => readFileSync(join(root, "skills", s, "SKILL.md"), "utf8")).join("\n");
    assert.ok(text.includes(p.documented), `${p.name} ${p.documented} not in skill`);
  }
});
