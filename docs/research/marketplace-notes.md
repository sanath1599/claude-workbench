# Claude Code marketplace survey (2026-11-05)

Sources: local installs under `~/.claude/plugins/{marketplaces,cache,synced}` plus the GitHub API (trees and sampled SKILL.md files). Star counts were taken today. Everything below is paraphrased.

## 1. Repo table

| Repo | Stars | License | Contents | Verdict |
|---|---|---|---|---|
| mattpocock/skills | 313.8k | MIT | ~27 shipped skills, 1 hook script | Best-curated personal set: written scope bar, out-of-scope ledger, model- vs user-invoked split. |
| obra/superpowers | 312.6k | MIT | 15 skills, SessionStart hook, tests | Deepest discipline skills (TDD, debugging, plans), pressure-tested. Forces skill use too hard. |
| anthropics/skills | 187.5k | none at repo level; most skills Apache-2.0, docx/pdf/pptx/xlsx proprietary | skills | Reference skills. skill-creator's eval loop is the gem; claude-api is 14.6k words. |
| anthropics/claude-code `plugins/` | 154.6k | proprietary | README pointing to claude-plugins-official | Nothing left to learn. |
| nextlevelbuilder/ui-ux-pro-max-skill | 145.4k | MIT | 7 skills, CSV data, Python search | Data plus a search script is a good idea; the 7 overlapping skills collide. |
| addyosmani/agent-skills | 113.3k | MIT | 25 skills, 4 agents, commands, hooks | Most consistent structure: process, rationalizations, red flags, verification checklist. |
| Leonxlnx/taste-skill | 110.2k | MIT | 1 skill, browser checker | Hyper-opinionated house rules, enforced in a real browser. |
| ComposioHQ/awesome-claude-skills | 78.8k | no license file | 832 generated wrappers, copies of Anthropic skills | Vendor funnel into one MCP server. Avoid. |
| cloudflare/security-audit-skill | 59.8k | MIT | 1 skill, 14 references, JSON schema, tested validators | Most rigorous single skill surveyed. |
| hesreallyhim/awesome-claude-code | 57.3k | CC BY-NC-ND 4.0 | link list | Discovery only; no derivatives allowed. |
| anthropics/claude-plugins-official | 46.2k | Apache-2.0 (catalog) | 315 plugins (53 local, 262 SHA-pinned) | Canonical marketplace.json. First-party plugins strong; third-party quality varies. |
| wshobson/agents | 42.2k | MIT | ~90 plugins, 202 agent files, 185 skills, plugin-eval | Granular plugins and a real eval tool; persona agents duplicated across plugins. |
| anthropics/knowledge-work-plugins | 34.8k | Apache-2.0 | short skills, `.mcp.json`, CONNECTORS.md | The connector abstraction is the value; skills are thin. |
| vercel-labs/agent-skills | 33.6k | no LICENSE file (frontmatter says MIT) | 7 skills, rule files compiled to AGENTS.md, tests | Atomic impact-ranked rules are a good format; zips committed to the repo. |
| davila7/claude-code-templates | 33.1k | MIT | npx catalog: 923 skills, 433 agents, hooks, MCPs | Aggregator; many agents use Copilot tool syntax. Low signal. |
| alirezarezvani/claude-skills | 29.3k | MIT | 478 skills, 97 agents | Some skills ship scripts with expected outputs; padded with "C-level advisor" filler. |
| OthmanAdi/planning-with-files | 27.9k | MIT | 1 skill copied into ~18 harness folders, hooks | Plan files that survive compaction are a good idea; the copies will drift. |
| VoltAgent/awesome-claude-code-subagents | 26.3k | MIT | ~165 agents | Generic personas with invented metrics. |
| Jeffallan/claude-skills | 12.2k | MIT | 66 skills, 365 references | Decent "load this reference when" tables; otherwise persona MUST lists. |
| trailofbits/skills | 8.0k | CC-BY-SA-4.0 (share-alike) | ~45 plugins: skills, agents, hooks, eval cases, CI | Best engineering practice of any marketplace. Copy no text. |
| expo/skills | 4.1k | MIT | Expo skills | Clean vendor example (not sampled deeply). |
| freshtechbro/claudedesignskills | 1.3k | LICENSE MIT, manifest says Apache-2.0 | 22 plugins plus 5 duplicate bundles | Templated agents with no frontmatter, empty command stubs. Last push 2025-11. |
| turingmindai/turingmind-code-review | 50 | MIT | 2 commands, 7 agents, git hooks | Small, sensible router plus a false-positive list. |
| WithWoz/wozcode-plugin | 208 | proprietary | MCP server, PreToolUse redirects, `agent` override, telemetry | Takes over the main loop. Don't emulate. |

## 2. Domains

### Skill/plugin authoring
**Who covers it:** skill-creator (anthropics), writing-skills (superpowers), plugin-dev and hookify (official), the AGENTS.md and CI setup in trailofbits, `invocation.md`/SCOPE.md (mattpocock), plugin-eval (wshobson).

**Strongest:** skill-creator runs each test prompt with and without the skill, grades both against stated expectations and shows them side by side. It also tunes the description against ~20 trigger queries, half of them near-misses that should not trigger. Superpowers treats skill writing as TDD: write a pressure scenario that makes the agent break the rule (time pressure, sunk cost, authority), then write the skill and add counter-arguments until it holds.

**Weak:**
- The two guides contradict each other. Superpowers found that a description summarising the workflow gets followed instead of the body, so it states triggers only. skill-creator says to be "a little bit pushy", which causes collisions in a 100-skill install.
- plugin-dev is ~14k words across 7 skills.

**Adopt:**
1. An `evals/` folder per skill with trigger cases (including near-miss negatives) and behaviour cases, each run 3 or more times.
2. CI that checks metadata and actually loads every plugin (trailofbits does both).
3. An explicit user-invoked vs model-invoked flag on every skill.
4. An out-of-scope ledger that records rejected ideas.

### System design and architecture
**Who covers it:** knowledge-work engineering; mattpocock (codebase-design, improve-codebase-architecture); feature-dev's code-architect; code-modernization's architecture-critic; wshobson c4-architecture; addyosmani documentation-and-adrs.

**Strongest:** mattpocock's codebase-design hunts for "deep module" opportunities, designs the interface twice before choosing, and writes domain vocabulary and ADRs into the repo.

**Weak:** Mostly noun lists (caching, queues, failover) with no decision procedure, estimation or output artifact. knowledge-work's system-design is ~190 words.

**Adopt:** two or more alternatives with a tradeoff table; an ADR plus glossary as required output; a back-of-envelope script (QPS, storage, cost); an interview step before designing.

### Frontend design and UI
**Who covers it:** frontend-design (Anthropic), taste-skill, ui-ux-pro-max, react-best-practices and composition-patterns (vercel-labs), claudedesignskills.

**Strongest:**
- Anthropic's frontend-design grounds visual choices in the product's subject and names the tells of a generated page.
- taste-skill ships a real-browser checker that enforces its rules, including that every visual renders at four breakpoints.
- ui-ux-pro-max queries CSV palettes, fonts and styles with a dependency-free search script instead of loading them into context, and can save the chosen design system to the project.

**Weak:** taste-skill makes one person's taste law; ui-ux-pro-max has 7 overlapping skills; claudedesignskills is ~50k words of stale-prone library docs plus identical "choreographer" agents.

**Adopt:**
1. Screenshot and accessibility verification as a hard gate.
2. Data as files plus a search script.
3. Atomic rule files tagged by impact, each with incorrect and correct examples, compiled into one reference.
4. Save the chosen design tokens to a project file so later sessions stay consistent.

### Backend and API design
**Who covers it:** addyosmani api-and-interface-design; Jeffallan api-designer and framework "experts"; wshobson backend-development; postman and 42crunch (vendors).

**Strongest:** addyosmani's skill: Hyrum's law, contract-first design, REST and type patterns, a closing verification checklist.

**Weak:** Framework-persona skills with code samples that go stale; almost none run a contract linter or breaking-change diff.

**Adopt:** write the OpenAPI/JSON Schema first, then gate on a lint (Spectral/Redocly) and a breaking-change diff (oasdiff); reference files for error model, pagination and idempotency keys.

### Agentic AI and LLM apps (agents, tool use, evals, RAG, voice)
**Who covers it:** claude-api, mcp-builder, mcp-server-dev, agent-sdk-dev (Anthropic); llm-application-dev (wshobson); rag-architect (Jeffallan); deepeval, langfuse, context7 (vendors).

**Strongest:**
- claude-api's description has TRIGGER and SKIP clauses; SKIP includes a grep that detects another provider. It routes to per-language docs and forbids answering from memory.
- mcp-builder ships an evaluation harness for the server you build; mcp-server-dev has focused references on tool design, auth and elicitation.

**Weak:** wshobson's LangChain skill hard-codes a model id and builds on LangGraph's prebuilt ReAct helper, an API that has since moved; its agents say "Use PROACTIVELY". Evals appear as prose, not procedure. Nothing covers voice agents.

**Adopt:**
1. "Fetch current docs before any SDK-specific decision": addyosmani's source-driven-development skill, backed by a hook that caches fetched pages and revalidates them with ETags.
2. Evals in the order wshobson's evals README describes: read real traces, write checks for the failures found, and trust an LLM judge only after checking it against human labels.
3. Treat retrieved and user content as untrusted (Cloudflare's AI/LLM reference).

### Distributed systems
**Who covers it:** distributed-debugging (wshobson, agents only); microservices-architect, websocket-engineer and chaos-engineer (Jeffallan).

**Assessment:** Nothing has a procedure. There are no decision guides for idempotency, outbox, saga or retries-with-backoff, no consistency-model reasoning, and no failure-mode tables. This is a real gap.

### DevOps, CI/CD and IaC
**Who covers it:** wshobson cicd-automation (Actions templates, pipeline design, secrets); Jeffallan terraform/kubernetes; HashiCorp's terraform MCP (image tag pinned); knowledge-work deploy-checklist; addyosmani ci-cd and shipping skills; the vercel plugin.

**Weak:** Mostly YAML dumps: no plan-before-apply gate, no actionlint/tflint/checkov, no SHA-pinning of actions.

**Adopt:** a PreToolUse guardrail on `terraform apply`, `kubectl delete` and prod deploys (built like mattpocock's git guardrails); scripts that run the linters and summarise the plan diff; the deploy checklist as a hard gate.

### SRE (incidents, observability, SLOs, postmortems, runbooks)
**Who covers it:** incident-response (knowledge-work); incident-response and observability-monitoring (wshobson); sre-engineer (Jeffallan); incident-commander (alirezarezvani); observability-and-instrumentation (addyosmani); incident-io, rootly, pagerduty, honeycomb, datadog, grafana (vendors); VoltAgent's SRE agents.

**Strongest:**
- addyosmani's observability skill writes "working" down as on-call questions, maps each to a signal, requires every alert to be symptom-based, runbook-linked and test-fired once, and ends by locating an induced failure from telemetry alone.
- alirezarezvani's incident-commander has scripts for severity, timeline and the post-incident review, tested against expected outputs, and points security incidents to a sibling skill.
- knowledge-work's skill has three modes (new, update, postmortem) and `~~monitoring`-style tool placeholders.

**Weak:** VoltAgent's SRE agent "queries a context manager" that does not exist and invents targets (MTTR under 30 minutes, automation above 90%). Postmortems are "5 whys" templates with no evidence-gathering step.

**Adopt:**
1. An incident mode that appends to a timeline file as the incident runs.
2. A burn-rate and error-budget calculator script.
3. An alert lint: runbook link, owner, test-fired.
4. A runbook "cold-execution" check.

### Security review
**Who covers it:** trailofbits (fp-check, differential-review, insecure-defaults, sharp-edges, supply-chain, semgrep-rule-creator); cloudflare security-audit; security-guidance and claude-security (official); turingmind; the built-in `/security-review`.

**Strongest:**
- trailofbits fp-check: a "rationalizations to reject" table, six gate reviews, and prompt-type Stop/SubagentStop hooks that block finishing until every phase has evidence.
- cloudflare: a guidance mode (loading the skill authorizes nothing) and a full-audit mode, with sandbox rules, write isolation and schema-validated findings.
- security-guidance: regex warnings after edits, an LLM diff review on Stop, and an agentic review on `git commit` via an `if` matcher.

**Weak:** OWASP checklists written as personas (VoltAgent, wshobson).

**Adopt:**
- An independent verifier for every finding.
- A false-positive filter list: pre-existing issues, linter territory, findings silenced in the code.
- Findings as schema-validated JSON.
- Split guidance mode from full-audit mode.

### Testing and QA
**Who covers it:** test-driven-development (superpowers); tdd and diagnosing-bugs (mattpocock); webapp-testing (Anthropic); property-based-testing and mutation-testing (trailofbits); pr-test-analyzer; testing-strategy (knowledge-work, thin).

**Strongest:** mattpocock's diagnosing-bugs spends Phase 1 entirely on a tight, deterministic loop that goes red on this bug (ten ranked ways to build one), done only when one command has been run and shown failing. webapp-testing's `with_server.py` manages the dev server around a test.

**Adopt:** "red loop first" as a hard gate; server-lifecycle helper scripts; condition-based waiting instead of sleeps; mutation testing to check test quality.

### Git and PR workflow
**Who covers it:** official code-review, commit-commands, pr-review-toolkit; superpowers branch-finishing, worktrees, receiving-code-review; mattpocock git-guardrails and pr; trailofbits gh-cli hooks; wshobson block-no-verify; turingmind git hooks.

**Strongest:** the official code-review pipeline. Cheap pre-checks skip closed, draft or already-reviewed PRs; parallel agents check CLAUDE.md compliance and bugs; a separate subagent validates each issue; an explicit false-positive list filters the rest; comments post only with `--comment`. trailofbits' gh-cli hooks redirect curl and WebFetch calls aimed at GitHub to `gh`.

**Weak:** The same `code-reviewer.md` agent is copy-pasted across many wshobson plugins.

**Adopt:** validate before posting; verify review suggestions before accepting them; guardrail hooks for destructive git and `--no-verify`; worktree isolation.

### Project bootstrap
**Who covers it:** claude-code-setup (recommends hooks, MCPs, agents from a codebase scan); setup-matt-pocock-skills (writes a per-repo config other skills read); Jeffallan intake/project commands; `/init`; claude-md-management.

**Weak:** All generate CLAUDE.md. None bootstraps CI, lint, tests, pre-commit, `.env.example` and secret scanning, then proves it by running them.

**Adopt:** a per-repo config file every skill reads; verify the bootstrap by executing it.

### Cloud and remote sessions
**Who covers it:** superpowers worktrees; mattpocock handoff; planning-with-files; remember; session-report; mcp-tunnels; ralph-loop.

**Gap:** Nobody encodes cloud-session constraints (no Docker, ephemeral storage, missing secrets, no deploys, PR-based handoff, detecting the environment). Your CLAUDE.md already needs this.

### Gaps nobody covers well
1. Distributed-systems decision procedures.
2. Voice agents: STT/LLM/TTS latency budgets, turn detection, barge-in, telephony, voice evals. There is no LiveKit plugin in the official catalog.
3. Cloud-session discipline.
4. LLM cost and latency budgets.
5. Detecting skill collisions across installed marketplaces.
6. Safe schema migrations (expand/contract) with verification.
7. Repo bootstrap that verifies itself.

## 3. Authoring patterns that distinguish good skills

**Description and trigger wording**
- Third person; starts from the user's situation or symptoms ("Use when tests are flaky…") rather than the tool.
- Includes an explicit not-for clause or a pointer to a sibling skill: trailofbits' When-NOT-to-use sections, claude-api's SKIP clause, incident-commander naming the security skill.
- Do not summarise the workflow in the description (superpowers' finding).
- For user-invoked skills, the description is a one-liner for humans and `disable-model-invocation: true` is set (mattpocock).

**Length**
- Good bodies run 400–2,500 words. trailofbits and skill-creator both cap SKILL.md at about 500 lines.
- Outliers that hurt: claude-api's 14.6k words, vercel's compiled AGENTS.md at 13k words, superpowers' subagent-driven-development at 4.9k words.

**Progressive disclosure**
- SKILL.md routes to the detail with a "load X when Y" table (Jeffallan, cloudflare).
- References sit one level deep, with no chains (a trailofbits rule).
- `scripts/` hold anything deterministic: search, validators, classifiers. `assets/` hold templates.
- Machine-readable data (JSON or CSV) sits next to the human-readable markdown (trailofbits insecure-defaults, ui-ux-pro-max).

**Procedure over persona**
- Numbered phases with completion criteria, e.g. "Phase 1 is done when one command has been run and shown red".
- Verification checklists at the end.
- A "Common Rationalizations / Red Flags" table that names the excuse and the required action instead (superpowers, addyosmani, trailofbits).

**Hard gates**
- Marked blocks that forbid moving on (superpowers' brainstorming).
- Strictness matched to risk: rigid for audits, crypto and destructive operations; flexible for exploration (trailofbits).
- A mode split, so loading a skill does not authorize the heavy workflow (cloudflare).

**Evals and tests**
- skill-creator: `evals/evals.json` with expectations, runs with and without the skill, a trigger-set optimiser.
- trailofbits: `case.yaml` with fixtures, regex and LLM graders, `runs: 3`, plus CI loadability checks.
- superpowers: pressure-scenario files and multi-turn tests of explicit skill requests.
- wshobson: a static score snapshot keyed by content hash.
- Scripts that ship with expected outputs (alirezarezvani).

**Hooks**
- SessionStart: inject a short bootstrap (superpowers injects ~500 words on startup, clear and compact) or check dependencies (security-guidance).
- PreToolUse: block or redirect (hookify's markdown rules, git guardrails, gh-cli redirects, block-no-verify). trailofbits' rules for these: use shell plus jq, fail fast with exit 0 on non-matches, prefer regex to AST parsing.
- PostToolUse: pattern warnings after edits.
- Stop and SubagentStop: prompt-type completeness gates (fp-check), diff review (security-guidance), loops (ralph-loop).
- An `if` matcher scopes a hook to `Bash(git*commit*)`.

**MCP connectors**
- `.mcp.json` at the plugin root, not inside plugin.json (a trailofbits rule). Remote HTTP with OAuth (knowledge-work) or a `${ENV}` bearer token (github).
- Pin versions: terraform pins its image tag; playwright's `@latest` is bad. File shape varies (with and without the `mcpServers` wrapper).
- Copy the knowledge-work trick: skills name `~~monitoring` or `~~source control`, CONNECTORS.md maps each category to bundled servers and alternatives, and each skill has an "if connector available" section with a standalone fallback. Skip its empty-URL placeholder entries.

**marketplace.json and plugin.json**
- marketplace.json: `$schema`, `name`, `owner`, `plugins[]` (`name/description/category/source`). Sources: local `./plugins/x`, `url`, or `git-subdir`, pinned by `ref`/`sha`. The official catalog keeps a `renames` map so renamed plugins stay installed.
- `strict: false` plus a `skills` array slices one repo into several plugins (anthropics/skills). An explicit plugin.json `skills` list ships only stable skills (mattpocock omits `in-progress/` and `misc/`).

**Versioning**
- Semver bumped by tooling: changesets plus a sync script (mattpocock), `.version-bump.json` (superpowers).
- A plugin without `version` is versioned by commit SHA; the local cache holds 8 SHA-named copies of `playground`. A permanent `1.0.0` (claudedesignskills) means updates go untracked.

**Keeping skills from firing all at once**
- Few, distinct skills tested with near-miss trigger evals; not-for clauses; user-invoked flags for workflows.
- Routers: turingmind's matrix loads only relevant agents; mattpocock's ask-matt routes for humans.
- Granular plugins, so users install only what they need.
- Skills call each other by name through the Skill tool, not prose cross-links (mattpocock).
- Counter-example: superpowers' "even a 1% chance" rule maximizes firing.

## 4. Anti-patterns to avoid

1. **Persona prompts with no procedure.** "You are a senior X who masters Y", followed by keyword lists and invented KPIs (VoltAgent, wshobson agents, claudedesignskills).
2. **Phantom dependencies.** Agents told to query a "context manager" that does not exist; tool lists in another harness's syntax (davila7's Copilot-style `github/search_code`).
3. **Duplication.** Bundles that re-ship individual plugins, the same agent in several plugins, the same SKILL.md copied for 18 harnesses. Generate per-harness files from one source.
4. **Volume as a feature.** Hundreds or thousands of skills (alirezarezvani 478, davila7 923, sickn33/agentic-awesome-skills ~2,900), thin generated vendor wrappers (Composio), stub commands with empty Notes sections.
5. **Stale API dumps.** Library references and hard-coded model ids inside SKILL.md. Fetch docs at runtime, or pin and date them.
6. **Trigger inflation.** "Use PROACTIVELY", "pushy" descriptions, mandatory-invocation bootstraps. These cause collisions and token burn.
7. **Invasive plugins.** Taking over the main agent, redirecting every Bash call to a proprietary server, telemetry hooks (wozcode). Every hook should be opt-in and explain itself.
8. **Unpinned connectors** (`@latest`), and secrets placed in `.mcp.json` instead of `${ENV}`.
9. **Licence sloppiness.** No LICENSE file (Composio, vercel-labs); manifest and LICENSE disagreeing (claudedesignskills); re-hosting Anthropic's all-rights-reserved docx/pdf/pptx/xlsx skills (Composio does). For your build: trailofbits is share-alike and hesreallyhim is no-derivatives, so take ideas only, never text.
10. **Fire-and-forget.** No evals, no CI, no CHANGELOG, no version bumps.

## Recommendation (short)

Build roughly 15–20 skills, not 200.

**Per skill**
- Trigger-only descriptions, each with a not-for clause.
- A procedure with completion criteria, a rationalizations table and a verification checklist.
- References loaded through "load when" tables; scripts for anything deterministic.
- An `evals/` folder with near-miss negatives.

**Per plugin**
- Hooks only where a rule must be enforced: guardrails, Stop completeness gates.
- `~~category` connectors with pinned `.mcp.json`.
- Semver bumped by a script.

**Marketplace-wide**
- CI that validates and actually loads every plugin.

**Where to differentiate**
- Distributed systems.
- Voice agents.
- Cloud-session discipline.
- A bootstrap that verifies itself.
