---
name: creating-skills
description: Use when the owner asks for a brand-new skill or plugin, wants a workflow turned into a skill, or asks to test whether a skill triggers and helps. Covers writing it to docs/authoring.md and building and running its eval cases. Not for folding a preference or finding into an existing skill (workbench:update-skill).
---

# Creating skills

A new skill is a claim: "Claude behaves better with this than without it." Write the smallest skill that carries the claim, then prove it with eval cases that include a baseline run and a near-miss that must not fire it.

## When to use

- "Make a skill for X", "turn this into a skill", "add a plugin for Y".
- A repeated workflow, decision procedure or gotcha has no home in any existing skill.
- A skill exists but you need to measure whether it triggers and helps.

## When not to use

- A durable preference or small finding: add it to the closest skill with `workbench:update-skill`.
- Project facts: that project's CLAUDE.md.
- A mechanical rule: a hook or script, not a skill.

## Procedure

### 1. Check that it earns a skill

Read `docs/authoring.md` ("What earns a skill"). Run `node scripts/find-skill.mjs "<keywords>"` and read the top three hits; if one covers the situation, stop and use `workbench:update-skill` instead. Capture intent in four lines: the situations that should trigger it, what Claude does today without it, what it should do instead, and how you would see the difference. When the idea comes from a conversation, extract the steps, the corrections the owner made and the output format from that conversation first.

**Done when:** the four lines are written and no existing skill covers them.

### 2. Pick the home and the name

Choose the plugin whose theme fits; create a plugin only for a new theme (`.claude-plugin/plugin.json` as in the sibling plugins, and an entry in `.claude-plugin/marketplace.json`). Name the skill gerund or verb-first, lowercase with hyphens, naming the activity.

### 3. Write the SKILL.md to the house format

Follow `docs/authoring.md` exactly:

- Description: "Use when ..." with the situations and the owner's words, under 500 characters, third person, ending with a "Not for X, which is Y" clause. Never put the steps in the description; a summarised workflow gets followed instead of the body.
- Body order: title and principle, when to use, when not to use, numbered procedure with a "Done when" per phase, quick reference, rationalizations (discipline skills only), verification, references, versions.
- 400 to 1,500 words; heavy detail goes in `references/`, one level deep. Scripts are Python 3 standard library or Node 18+, called through their interpreter.
- Owner-specific values are `{{wb.*}}` tokens. Package versions go in a Versions block and in `maintenance/tracked-packages.d/<plugin>.json`.
- Write rules as standing instructions with their reason. Prefer a reason to a capitalised MUST.
- Own words, always. Take ideas from other marketplaces, never their text or code.

**Done when:** the file reads in under five minutes and every procedure phase ends with an observable condition.

### 4. Write the eval cases

Create `plugins/<plugin>/evals/<case-name>/prompt.md` and `graders/*.md`. The schema is enforced by `tests/evals.test.mjs`; read it before writing.

Three to five cases per skill:

1. **Positive:** a realistic prompt in the owner's voice that should trigger the skill. Graders: an `llm` grader describing the behaviour you expect in plain terms, and a `tool_used` grader on `Skill` with `input_match` for the skill name.
2. **Positive, indirect:** the same need without the skill's keywords.
3. **Near-miss:** a prompt in the same domain that must not trigger it. Grader: `tool_used`, `tool: Skill`, `input_match` on the skill name, `min: 0`, `max: 0`, `arm: both`.
4. **Pressure case** (discipline skills): a prompt that tempts the excuse in the Rationalizations table. Before trusting a new discipline skill, run that prompt with the skill absent and note the exact shortcut Claude takes and the excuse it gives. Write the Rationalizations table from those real excuses, then run the same prompt with the skill present and confirm the behaviour changed. A skill whose absence changes nothing should not be added.

Prompt frontmatter keys: `runs`, `max_turns`, `allowed_tools`, `tags` (and the other documented keys in the test). Keep `max_turns` low (4 to 8) and `allowed_tools` read-only plus `Skill` unless the case needs more. Graders: `type: llm | regex | tool_used`, `weight`, optional `arm` (`with-only` or `both`). Make `llm` criteria observable ("the reply proposes X before building Y"), never taste.

**Done when:** `npm test` passes the eval schema tests and each skill has at least one near-miss.

### 5. Run the evals with a baseline

```bash
claude plugin eval plugins/<plugin> --runs 2 --model sonnet --no-publish
```

By default the run includes a baseline arm without the plugin (`--ablation with-without`), and graders marked `with-only`, including `tool_used: Skill`, only show whether the skill fired. Read the score difference between the arms, not just the pass rate: a skill that scores the same with and without has not earned its place. Open any failing run's transcript before changing anything. Running evals spends model tokens, so state that to the owner and run them only when asked or agreed.

**Done when:** you have the with and without scores per case and the list of failures with a cause for each.

### 6. Iterate on evidence

| Observation | Change |
|---|---|
| Skill did not fire on a positive case | add the owner's words and the symptom to the description |
| Fired on the near-miss | tighten the description; add the sibling to the not-for clause |
| Fired, behaviour did not change | the body is too vague; add the decision rule or example that matters |
| Baseline already passes | the skill is generic knowledge; cut it or narrow it to the owner's preference |
| Passes with and without but graders look trivial | rewrite the grader so it can fail |

Change one thing, re-run the failing cases, then the full set once at the end.

### 7. Ship

`npm test`, `claude plugin validate plugins/<plugin> --strict`, `node scripts/bump-version.mjs <plugin> minor`, a line in `docs/learnings.md`, then commit and push as `workbench:update-skill` does. Tell the owner the skill name, the eval scores and the commit hash.

## Rationalizations

| Excuse | Instead |
|---|---|
| "It is obviously useful, skip the evals." | Without a baseline you cannot tell it from generic advice. |
| "I will list the steps in the description so it triggers." | The agent then skips the body. Describe when, not how. |
| "One positive case is enough." | The near-miss is what stops it firing on everything. |
| "I'll paste the good parts of the other marketplace's skill." | Ideas only; write it yourself. |

## Verification

- [ ] No existing skill covered it; the home plugin fits.
- [ ] Description under 500 characters with a not-for clause; body follows the section order.
- [ ] Positive, near-miss and baseline-aware evals exist and pass the schema test.
- [ ] Scores with and without the skill were read, or the owner was told they were not run.
- [ ] Tests, validation, version bump and learnings line are done.

## Related

- `workbench:update-skill` for changes to existing skills.
- `docs/authoring.md` for the format and `tests/evals.test.mjs` for the eval schema.
