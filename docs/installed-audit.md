# Installed skills audit (2026-11-05)

Before moving to this marketplace, every skill, agent, command, hook and MCP server installed in Claude Code was read and given a verdict:

- **OURS**: rewritten in our own words as a new workbench skill.
- **MERGED**: folded into an existing workbench skill.
- **KEEP-THIRD-PARTY**: still needed as installed, because it is app-bound, a tool, or a connector.
- **DROP**: not needed, with the reason.

Nothing was copied. Ideas were rewritten, and the proprietary Office skills were not used at all.
| Verdict | Count |
|---|---|
| DROP | 134 |
| OURS | 71 |
| MERGED | 45 |
| KEEP-THIRD-PARTY | 30 |


> **Update 2026-11-05:** at the owner's request, `graphify`, the 14 `mulmoterminal-*` skills and `reverse-engineer-anything` (with the REA MCP server) are now bundled in the `toolbelt` plugin. They are MIT-licensed, vendored from upstream with their licences, and refreshed by `scripts/sync-vendored.mjs` and the daily job. The migration applied the same day: the 22 third-party plugins and 6 unused marketplaces were removed, and the old personal-skill copies were moved to `~/.claude/skills-backup/2026-11-05/`. teamclaude was deliberately not included.

## Process, review and memory (superpowers, turingmind, code-simplifier, remember, playground, imessage, woz, engineering, productivity, cowork)

| source | name | verdict | one-line reason |
|---|---|---|---|
| superpowers | using-superpowers | DROP | "Invoke at 1 percent" shouting duplicates what skill descriptions already do and fights the owner's act-first style; our descriptions carry the triggers. |
| superpowers | SessionStart hook (session-start, run-hook.cmd) | DROP | Injects the whole using-superpowers text every session for no enforcement value; nothing here must be mechanically enforced. |
| superpowers | brainstorming | OURS:workflow:shaping-the-work new | Kept: size the work, play back, written design, spike, builder check. Changed: one batch of 4 or fewer questions with cost and reversibility, "decide" ends asking; the original's single open question per turn is the style the owner rejects. |
| superpowers | writing-plans | OURS:workflow:writing-implementation-plans new | Kept: file map, global constraints block, right-sized tasks with a checkable deliverable. Added: owner-only section, parallel-file ownership, plan-critic gate. |
| superpowers | executing-plans | OURS:workflow:executing-plans new | Merged with subagent-driven into one skill: inline vs subagent choice, ledger that survives compaction, "rule, do not stall". |
| superpowers | subagent-driven-development | OURS:workflow:executing-plans new | Kept ledger, rulings and four stop reasons; replaced per-task two-stage review and fix-round machinery with batched reviews plus one critique, as the owner asked; sonnet default. |
| superpowers | systematic-debugging | OURS:workflow:debugging-systematically new | Kept root-cause-first and hypotheses; made the red loop the first step, added bisect and instrumentation, dropped the iron-law rhetoric. Defers permanent test layout to engineering-craft:planning-tests. |
| superpowers | test-driven-development | OURS:workflow:test-first-changes new | Kept red-green-refactor and "watch it fail"; added the owner's rule that "no tests" for a stated scope (visual tweaks) is respected, and the no-real-providers rule. |
| superpowers | verification-before-completion | OURS:workflow:verifying-before-done new | Evidence-before-claims, plus an evidence-per-work-type table, owner `! command` handoff for unreachable checks, and a status/verified/not-verified report shape. |
| superpowers | requesting-code-review | OURS:workflow:reviewing-code-before-merge new | Folded into the parallel reviewers + verifier + filter pipeline; code-reviewer agent replaces the template prompt. |
| superpowers | receiving-code-review | MERGED:engineering-craft:answering-pr-reviews existing | Mode B already covers it; see proposal 1 for the three pieces missing. |
| superpowers | dispatching-parallel-agents | MERGED:workbench:delegating-to-subagents existing | Already covers parallel dispatch; see proposal 2 for the independence test. |
| superpowers | using-git-worktrees | OURS:workflow:working-in-parallel-sessions new | Kept "detect existing isolation first, native tool before git"; widened to peer sessions, agent file ownership and duplicate crons. |
| superpowers | finishing-a-development-branch | OURS:workflow:finishing-a-branch new | Kept verify, confirm base, cleanup; replaced the 3-option menu with the owner's default (push, PR, merge yourself) and added stranded-work sweep. |
| superpowers | writing-skills | MERGED:workbench:creating-skills existing | Authoring rules are in docs/authoring.md and creating-skills; see proposal 3 for the baseline-run idea. |
| superpowers | diagnosing-superpowers | DROP | Debugs superpowers sessions only; useless once superpowers is removed. |
| turingmind | agents/bugs | OURS:workflow:reviewing-code-before-merge new | Checklist rewritten into references/reviewer-checklists.md (correctness); emoji and 100-point scoring format dropped. |
| turingmind | agents/security | MERGED:engineering-craft:reviewing-security existing | Full audit lives there; the review pipeline keeps a short security checklist and points to it. |
| turingmind | agents/architecture | OURS:workflow:reviewing-code-before-merge new | Kept as an optional architecture reviewer for large changes only. |
| turingmind | agents/compliance | OURS:workflow:reviewing-code-before-merge new | Kept as the convention reviewer: quote the rule and the line; ignore advice written for Claude. |
| turingmind | agents/language-typescript | OURS:workflow:reviewing-code-before-merge new | Short language checklist kept as a reference section. |
| turingmind | agents/language-python | OURS:workflow:reviewing-code-before-merge new | Same. |
| turingmind | agents/index (router) | DROP | The matrix is eight lines; it is now step 2 of the skill. |
| turingmind | commands/review | OURS:workflow:reviewing-code-before-merge new | Idea kept: parallel focused agents, filter below a confidence threshold, show filtered counts. Added the independent verifier it lacks. |
| turingmind | commands/deep-review | OURS:workflow:reviewing-code-before-merge new | Idea kept: add architecture and impact only for big diffs. Separate command dropped; size picks the depth. |
| turingmind | templates/false-positive-rules, output-format | OURS:workflow:reviewing-code-before-merge new | False-positive categories kept in the filter step; emoji output format dropped. |
| code-simplifier | agents/code-simplifier | OURS:workflow:simplifying-code new | Kept: recent changes only, preserve behaviour, clarity over brevity. Dropped its hard-coded JS style rules and the opus model; our agent is sonnet and reads the repo's own conventions. |
| remember | skills/remember (handoff note) | DROP | Replaced by Claude Code auto memory plus kickoff:keeping-context-across-sessions; see analysis below. |
| remember | commands/doctor | DROP | Diagnoses a plugin that is being removed. |
| remember | hooks SessionStart, UserPromptSubmit, PostToolUse, SessionEnd | DROP | Continuous capture with Haiku summaries into .remember/ folders; heavy, background-spawning, and the benefit is covered below. |
| playground | skills/playground | DROP | Single-file HTML explorers overlap design-studio:previewing-ui-before-building and the installed html-plan skill; see proposal 4 for the one idea worth keeping. |
| imessage | skills/access | KEEP-THIRD-PARTY | A channel integration, not a workflow; cannot be written as a skill. Reinstall only if the owner texts Claude (no sign of use in the history; its bun-based server currently fails to connect). |
| imessage | skills/configure | KEEP-THIRD-PARTY | Same, tied to the channel server. |
| woz | agents/code, code-free | DROP | Replace the main agent and disable built-in Read/Edit/Grep; invasive, paid service. |
| woz | agents/explore | DROP | Tied to woz MCP tools; the built-in Explore agent covers it. |
| woz | hooks (SessionStart, PreToolUse redirects, others) | DROP | Redirects Bash and edits through a proprietary server with telemetry. |
| woz | skills woz-login, woz-logout, woz-status, woz-update, woz-settings, woz-savings, woz-share | DROP | Account, billing and referral management for a service being removed. |
| woz | skills woz-benchmark | DROP | Compares woz to vanilla; meaningless without woz. |
| woz | skills woz-recall | DROP | Semantic search of past sessions needs the woz backend; see the remember analysis for the cheaper alternative. |
| engineering (synced) | code-review | MERGED:engineering-craft:answering-pr-reviews existing | Generic dimensions list; mode A review plus workflow:reviewing-code-before-merge cover it. |
| engineering (synced) | debug | OURS:workflow:debugging-systematically new | Four steps there; ours adds the red loop, bisect and hypothesis discipline. |
| engineering (synced) | testing-strategy | MERGED:engineering-craft:planning-tests existing | Test pyramid is generic; planning-tests holds the owner's mocks policy. |
| engineering (synced) | tech-debt | DROP | Generic triage framework; the owner parks debt in NEXT_STEPS.md and the cleanup is workflow:simplifying-code. |
| engineering (synced) | standup | DROP | Generates team standups; the owner works alone and wants terse status (workbench:writing-deliverables). |
| engineering (synced) | deploy-checklist | MERGED:ops-and-sre:releasing-safely existing | Already covered with the owner's production gates. |
| engineering (synced) | documentation | DROP | Generic doc types; READMEs are design-studio:writing-showcase-readmes, runbooks are ops-and-sre:writing-runbooks. |
| engineering (synced) | incident-response | MERGED:ops-and-sre:handling-incidents existing | Already covered. |
| engineering (synced) | architecture | MERGED:engineering-craft:designing-systems existing | ADR format is in designing-systems. |
| engineering (synced) | system-design | MERGED:engineering-craft:designing-systems existing | Same. |
| productivity~g2 | start | DROP | Sets up a TASKS.md dashboard the owner does not use. |
| productivity~g2 | update | DROP | Syncs a TASKS.md from trackers; same. |
| productivity~g2 | task-management | DROP | The owner uses NEXT_STEPS.md and the built-in task list. |
| productivity~g2 | memory-management | DROP | CLAUDE.md-plus-glossary shorthand decoder; the auto memory and workbench:update-skill cover durable preferences. |
| cowork-plugin-management | create-cowork-plugin | DROP | Needs the Cowork desktop app and .plugin packaging; marketplace authoring is docs/authoring.md. |
| cowork-plugin-management | cowork-plugin-customizer | DROP | Same; profile tokens and /workbench:setup do the customising here. |

## Platform and connectors (Vercel, Cloudflare, Resend, Prisma, Pinecone, Postman, Chrome DevTools, Expo)

| source | name | verdict | reason |
|---|---|---|---|
| V | access-protected-vercel-deployment | OURS:stack-web:protecting-and-promoting-on-vercel new | `vercel curl` and OIDC-header access to protected previews is a real agent gotcha |
| V | ai-gateway | MERGED:engineering-craft:building-llm-features existing (proposal 1) | Optional for the owner (Ollama/Claude default); keep only the "base URL swap + /v1/models" facts |
| V | ai-sdk | DROP | TS AI SDK; owner's agents are Pydantic AI; skill defers to node_modules docs anyway |
| V | auth | DROP | Clerk/Descope marketplace flow; owner prefers lightest auth (adding-auth exists) |
| V | bootstrap | MERGED:stack-web:deploying-on-vercel existing (proposal 2) | Env key diff (names only) and no-print AUTH_SECRET are good; rest is Neon/shadcn defaults |
| V | build-agents | DROP | Generic agent scaffolding steering to eve/Vercel; owner uses Pydantic AI + Temporal |
| V | cdn-caching | OURS:stack-web:sizing-vercel-functions new | Condensed: x-vercel-cache values, invalidate vs delete |
| V | chat-sdk | DROP | Multi-platform bots; not used |
| V | create-a-backend | MERGED:stack-web:choosing-background-work-on-vercel new | Function/Service/Workflow/Queue chooser folded into the tables |
| V | custom-metrics | DROP | Niche; ops-and-sre:instrumenting-services owns observability |
| V | deployments-cicd | MERGED:stack-web:protecting-and-promoting-on-vercel new | promote, rollback, --skip-domain, --prebuilt; CI tokens already in deploying-on-vercel |
| V | env-vars | MERGED:stack-web:deploying-on-vercel existing | Already covered (stdin values, sensitive flag, pull). Only addition in proposal 2 |
| V | eve | DROP | Vercel's agent framework; conflicts with Pydantic AI + Temporal default |
| V | flags-sdk | DROP | Flags SDK; owner uses env flags per decisions |
| V | knowledge-update | OURS:stack-web:sizing-vercel-functions new (+ storing, choosing) | Stale-knowledge corrections (Edge deprecated, 300 s, Global Config, no KV/Postgres) distributed into the skills; hook idea below |
| V | marketplace | OURS:stack-web:storing-data-on-vercel new | `vercel integration add` provisioning path |
| V | microfrontends | DROP | Not needed |
| V | next-cache-components | DROP | Cache Components disabled on purpose in owner apps; working-in-nextjs-16 owns it |
| V | next-forge | DROP | Turborepo SaaS starter; pnpm, Clerk, Stripe; not the owner's stack |
| V | next-upgrade | DROP | Use `npx @next/codemod` docs live; Next 16 skill exists |
| V | nextjs | MERGED:stack-web:working-in-nextjs-16 existing | Overlaps; no new owner-relevant rules beyond existing skill |
| V | react-best-practices | DROP | Generic checklist Claude already knows |
| V | routing-middleware | MERGED:stack-web:working-in-nextjs-16 existing (proposal 3) | Three-way middleware disambiguation and proxy.ts is not for auth |
| V | runtime-cache | OURS:stack-web:sizing-vercel-functions new | getCache, tags, invalidateByTag |
| V | shadcn | DROP | Generic component CLI knowledge; design-studio skills cover look |
| V | turbopack | DROP | Next 16 default bundler; no owner rules |
| V | vercel-agent | DROP | Vercel's own assistant product |
| V | vercel-cli | MERGED:stack-web:deploying-on-vercel existing + protecting new | Linking check (`vercel project inspect`) and rr commands taken |
| V | vercel-connect | DROP | Slack/GitHub token broker; not used |
| V | vercel-firewall | OURS:stack-web:protecting-and-promoting-on-vercel new | Staged rules, publish step, rate limit tuning |
| V | vercel-functions | OURS:stack-web:sizing-vercel-functions new | Limits, Edge deprecation, waitUntil, large functions |
| V | vercel-sandbox | OURS:stack-web:choosing-background-work-on-vercel new | One row; owner prefers Docker on VPS |
| V | vercel-services | MERGED:stack-web:deploying-on-vercel existing | Already notes beta; keep rewrite example in existing references |
| V | vercel-storage | OURS:stack-web:storing-data-on-vercel new | Blob private, Global Config rename, sunset packages |
| V | verification | MERGED:design-studio:verifying-ui-in-browser existing (proposal 4) | "Infer the user story, stop at first broken boundary" idea |
| V | workflow | OURS:stack-web:choosing-background-work-on-vercel new | Workflow vs Queues vs Temporal decision; docs live in node_modules |
| V | agents/ai-architect | DROP | Persona agent; authoring forbids personas |
| V | agents/deployment-expert | DROP | Same; content is covered by skills |
| V | agents/performance-optimizer | DROP | 935 lines duplicating skills |
| V | .mcp.json (vercel) | KEEP-THIRD-PARTY | Official remote MCP, OAuth; bundle the URL |
| V | hooks: session-start-seen-skills, profiler, inject-claude-md | DROP | Heavy bundled JS; injects repo-sniffed context and "greenfield execution" text |
| V | hooks: posttooluse-skill-telemetry, telemetry.mjs | DROP | Posts events to telemetry.vercel.com; owner is removing third-party plugins |
| V | hooks: pretooluse/user-prompt-submit skill-inject (present, not wired) | DROP | Lexical skill router; our skills use descriptions and workbench:find-skill |
| CF | cloudflare | OURS:stack-web:using-cloudflare-beyond-dns new | Product chooser shrunk to what the owner would use |
| CF | workers-best-practices | OURS:stack-web:using-cloudflare-beyond-dns new | Anti-pattern list condensed |
| CF | wrangler | OURS:stack-web:using-cloudflare-beyond-dns new | Local-vs-remote, secret put deploys, dry run |
| CF | turnstile-spin | OURS:stack-web:using-cloudflare-beyond-dns new | Server-side Siteverify rule; the wizard scripts are not copied |
| CF | durable-objects | MERGED:stack-web:using-cloudflare-beyond-dns new | One table row; owner has no DO workload |
| CF | web-perf | OURS:stack-web:debugging-web-performance-in-chrome new | Merged with chrome LCP |
| CF | agents-sdk | DROP | Cloudflare agent framework; not used |
| CF | cloudflare-email-service | DROP | Resend is the email provider |
| CF | cloudflare-one | DROP | Zero Trust deployment; out of scope |
| CF | cloudflare-one-migrations | DROP | Out of scope |
| CF | nextjs-on-cloudflare | DROP | Next.js goes to Vercel |
| CF | sandbox-migrate-to-next | DROP | Cloudflare Sandbox SDK |
| CF | sandbox-next | DROP | Same |
| CF | sandbox-stable | DROP | Same |
| CF | .mcp.json / mcp.json | KEEP-THIRD-PARTY | API MCP (OAuth) bundled; plus docs MCP |
| RS | resend | MERGED:stack-web:sending-email-with-resend existing | Already covers sending, idempotency, webhooks |
| RS | agent-email-inbox | OURS:stack-web:handling-inbound-email-safely new | Trust levels for untrusted inbound email |
| RS | email-best-practices | MERGED:stack-web:sending-email-with-resend existing (proposal 5) | Deliverability checklist, suppression handling |
| RS | react-email | MERGED:stack-web:sending-email-with-resend existing (proposal 6) | Template workflow |
| RS | resend-cli | MERGED:stack-web:sending-email-with-resend existing (proposal 7) | Non-interactive CLI use for domain ops |
| RS | mcp.json | KEEP-THIRD-PARTY | Remote OAuth MCP bundled |
| PR | .mcp.json Prisma-Local | KEEP-THIRD-PARTY | `prisma mcp` migrate status/dev; pinned to stable 7.10.1 |
| PR | .mcp.json Prisma-Remote | DROP | OAuth account tooling; owner provisions Neon via Vercel instead |
| PC | assistant | DROP | Pinecone; owner uses Qdrant |
| PC | cli | DROP | Same |
| PC | docs | DROP | Same |
| PC | full-text-search | DROP | Pinecone-only API (idea in proposal 8) |
| PC | help | DROP | Plugin index |
| PC | mcp | DROP | Pinecone |
| PC | n8n | DROP | n8n not used |
| PC | query | DROP | Pinecone |
| PC | quickstart | DROP | Pinecone |
| PC | .mcp.json | DROP | Pinecone, Qdrant is the vector store |
| PC | hooks: pinecone-api-key-check.sh | DROP | Key check for a store we do not use |
| PM | api-testing | OURS:stack-web:testing-apis-from-the-command-line new | Idea: lightest tool first; implemented with curl, httpx, Schemathesis |
| PM | ci-integration | MERGED:stack-web:testing-apis-from-the-command-line new | Smoke gate step |
| PM | performance-testing | MERGED:stack-web:testing-apis-from-the-command-line new | Light-load guidance only |
| PM | ai-readiness | MERGED:engineering-craft:designing-apis existing (proposal 9) | Examples and error docs make an API agent-usable |
| PM | api-mocking | DROP | Postman cloud mocks; owner mocks in tests |
| PM | api-monitoring | DROP | Postman monitors; ops-and-sre has SLO skills |
| PM | api-documentation | DROP | Postman publishing |
| PM | api-discovery | DROP | Postman workspace search |
| PM | api-engineer | DROP | Routing skill that mandates itself |
| PM | bootstrap | DROP | Links repo to a Postman workspace |
| PM | collection-schema-v3 | DROP | Postman file format |
| PM | flows | DROP | Postman Flows |
| PM | postman-mcp-server | DROP | Postman concepts |
| PM | hooks: session-start-context.md | DROP | Injects an EXTREMELY_IMPORTANT mandate to invoke its skill on every API task |
| PM | mcp.claude-code.json | DROP | Requires Postman account; owner occasionally tests APIs only |
| CD | a11y-debugging | OURS:stack-web:debugging-web-performance-in-chrome new | Lighthouse + accessibility tree workflow |
| CD | debug-optimize-lcp | OURS:stack-web:debugging-web-performance-in-chrome new | LCP four-subpart method |
| CD | memory-leak-debugging | OURS:stack-web:debugging-web-performance-in-chrome new | Three-snapshot method |
| CD | cookie-debugging | OURS:stack-web:debugging-web-performance-in-chrome new | HttpOnly reading via network headers |
| CD | troubleshooting | OURS:stack-web:debugging-web-performance-in-chrome new | DevToolsActivePort triage |
| CD | chrome-devtools | DROP | Tool tutorial; MCP tool descriptions and verifying-ui-in-browser cover it |
| CD | chrome-devtools-cli | DROP | Shell scripting of the CLI; niche |
| CD | mcp.json | KEEP-THIRD-PARTY | Bundle with pinned 1.12.0 |
| EX | building-native-ui | DROP | Plugin disabled; no mobile work in history |
| EX | expo-api-routes | DROP | Same |
| EX | expo-cicd-workflows | DROP | Same |
| EX | expo-deployment | DROP | Same |
| EX | expo-dev-client | DROP | Same |
| EX | expo-tailwind-setup | DROP | Same |
| EX | expo-ui-jetpack-compose | DROP | Same |
| EX | expo-ui-swift-ui | DROP | Same |
| EX | native-data-fetching | DROP | Same |
| EX | upgrading-expo | DROP | Same |
| EX | use-dom | DROP | Same |

## Documents, data and Anthropic example skills (example-skills, synced account skills, product-management, data, desktop-commander)

| source | name | verdict | reason |
|---|---|---|---|
| example-skills (cache) | docx | OURS:docs-and-data:producing-word-documents new | Proprietary text not used; rewritten from python-docx docs, adds Word-export page-number rule and inspector |
| example-skills (cache) | pdf | OURS:docs-and-data:working-with-pdfs new | Proprietary; rewritten with probe-first approach (text/scanned/mixed) and redaction check |
| example-skills (cache) | pptx | OURS:docs-and-data:producing-slide-decks new | Proprietary; rewritten storyline-first with native charts, alt text, inspector |
| example-skills (cache) | xlsx | OURS:docs-and-data:producing-spreadsheets new | Proprietary; rewritten around live formulas, input sheet, LibreOffice recalculation and checker |
| example-skills (cache) | skill-creator | OURS:workbench:creating-skills new | Idea of draft, test, baseline, iterate kept; rebuilt around docs/authoring.md and claude plugin eval |
| example-skills (cache) | mcp-builder | OURS:engineering-craft:building-mcp-servers new | Rewritten with remote streamable HTTP, OAuth 2.1, DCR/CIMD, connector setup (owner built this) |
| example-skills (cache) | doc-coauthoring | MERGED:workbench:writing-deliverables existing | Reader-test idea proposed as an addition; rest is a generic interview flow |
| example-skills (cache) | internal-comms | MERGED:workbench:writing-deliverables existing | Thin pointer to company-specific templates; status-update forms already covered |
| example-skills (cache) | webapp-testing | MERGED:design-studio:verifying-ui-in-browser existing | Playwright testing already covered by verifying-ui-in-browser and shoot script |
| example-skills (cache) | frontend-design | MERGED:design-studio:designing-without-ai-slop existing | Also installed as official plugin frontend-design; owner's slop rules cover the intent |
| example-skills (cache) | web-artifacts-builder | MERGED:design-studio:previewing-ui-before-building existing | Owner wants single-file HTML previews; React/shadcn bundler is not their stack |
| example-skills (cache) | theme-factory | DROP | Ten preset themes; owner uses client brand colours and own tokens |
| example-skills (cache) | brand-guidelines | DROP | Anthropic's own brand; not applicable |
| example-skills (cache) | canvas-design | DROP | Poster/art generation; no owner use |
| example-skills (cache) | algorithmic-art | DROP | p5.js generative art; no owner use |
| example-skills (cache) | slack-gif-creator | DROP | Slack GIFs; no owner use |
| example-skills (cache) | academy-guide | DROP | Recommends Claude Academy courses; marketing nudge, no behaviour worth keeping |
| example-skills (cache) | discernment-nudge | DROP | Appends follow-up questions after answers; conflicts with owner's 'decide, do not ask' rule |
| example-skills (cache) | claude-api | KEEP-THIRD-PARTY | Official, auto-updated API reference (also built into Claude Code); not worth cloning, it ages fast |
| example-skills (cache) agent | skill-creator/agents/grader | MERGED:workbench:creating-skills existing | Grading idea (critique weak assertions) folded in as 'make graders able to fail'; eval runner has own graders |
| example-skills (cache) agent | skill-creator/agents/comparator | DROP | Blind A/B comparator; claude plugin eval baseline arm does this |
| example-skills (cache) agent | skill-creator/agents/analyzer | DROP | Post-hoc analysis; the iterate table in creating-skills is enough |
| synced skill (claude.ai account) | docx | OURS:docs-and-data:producing-word-documents new | Same as example-skills docx (proprietary, not copied) |
| synced skill (claude.ai account) | pdf | OURS:docs-and-data:working-with-pdfs new | Same as above |
| synced skill (claude.ai account) | pptx | OURS:docs-and-data:producing-slide-decks new | Same as above |
| synced skill (claude.ai account) | xlsx | OURS:docs-and-data:producing-spreadsheets new | Same as above |
| synced skill (claude.ai account) | skill-creator | OURS:workbench:creating-skills new | Same as example-skills skill-creator |
| synced skill (claude.ai account) | deep-research | OURS:docs-and-data:researching-in-depth new | Coordinator/researcher/writer split kept as idea; ours adds source log, contrary-evidence thread, claim tracing, owner's model rule |
| synced skill (claude.ai account) | web-artifacts-builder | MERGED:design-studio:previewing-ui-before-building existing | Duplicate of example-skills copy |
| synced skill (claude.ai account) | docs | DROP | Stub that defers to the Claude Docs connector; account feature, nothing to clone |
| synced skill (claude.ai account) | google-workspace | KEEP-THIRD-PARTY | Connector gotchas (UTF-16 offsets, EMU, parse-like-UI) are valuable only if Google files are used; owner is Word/Excel/Microsoft 365 based; revisit if Google Docs work appears |
| synced skill (claude.ai account) | morning | DROP | Morning brief page needing calendar/email connectors; owner has not asked for it |
| synced skill (claude.ai account) | chrome-browser | KEEP-THIRD-PARTY | Tool-loading and safety guidance bound to the Claude in Chrome extension, which is account-provided |
| synced skill (claude.ai account) | built-in-browser | KEEP-THIRD-PARTY | Desktop-app browser pane; product-specific, account-provided |
| synced skill (claude.ai account) | computer-use | KEEP-THIRD-PARTY | Desktop control safety rules tied to the product; account-provided |
| synced skill (claude.ai account) | artifact-emulator | KEEP-THIRD-PARTY | Cloud-session viewer for artifacts; cloud only, product-specific |
| synced skill (claude.ai account) | import-memory | DROP | One-time ChatGPT/Gemini memory import; no further use |
| synced plugin data | analyze | OURS:docs-and-data:analysing-tabular-data new | Question-first flow kept as idea; ours is pandas/spreadsheet based, not warehouse |
| synced plugin data | explore-data | OURS:docs-and-data:analysing-tabular-data new | Profiling step becomes scripts/profile_table.py |
| synced plugin data | validate-data | OURS:docs-and-data:analysing-tabular-data new | Pre-share checks became step 5 (second computation, sum checks, what would wrong look like) |
| synced plugin data | statistical-analysis | OURS:docs-and-data:analysing-tabular-data new | Kept only group sizes, medians, outlier rule, trend like-for-like in recipes |
| synced plugin data | create-viz | MERGED:docs-and-data:analysing-tabular-data new | Chart choice and matplotlib recipe in references; dataviz skill covers style |
| synced plugin data | data-visualization | KEEP-THIRD-PARTY | Overlaps the account-provided dataviz skill, which is better maintained; our skill points to it |
| synced plugin data | build-dashboard | MERGED:workbench:writing-deliverables existing | Owner already wants self-contained HTML reports; no separate dashboard builder needed |
| synced plugin data | sql-queries | DROP | Multi-dialect warehouse SQL; owner uses Postgres and ORMs, model knows SQL |
| synced plugin data | write-query | DROP | Same as sql-queries |
| synced plugin data | data-context-extractor | DROP | Builds company warehouse skills; no warehouse |
| synced plugin product-management | write-spec | MERGED:kickoff:writing-the-design-spec existing | Spec writing is owned by kickoff; proposal below |
| synced plugin product-management | stakeholder-update | MERGED:workbench:writing-deliverables existing | Audience tailoring already in the form table; proposal below |
| synced plugin product-management | synthesize-research | MERGED:docs-and-data:researching-in-depth new | Theme-and-frequency synthesis is reflected in the report template |
| synced plugin product-management | competitive-brief | MERGED:docs-and-data:researching-in-depth new | Covered by comparison thread plus report template |
| synced plugin product-management | metrics-review | MERGED:docs-and-data:analysing-tabular-data new | Trend and like-for-like rules cover it |
| synced plugin product-management | roadmap-update | DROP | Owner is not running a product roadmap process |
| synced plugin product-management | sprint-planning | DROP | Owner plans with small increments in the repo, not sprints |
| synced plugin product-management | product-brainstorming | DROP | Superpowers brainstorming and kickoff interview cover it |
| synced plugin product-management | commands/brainstorm | DROP | Same |
| synced plugin desktop-commander | terminal | DROP | Persistent shell via Desktop Commander MCP; Claude Code Bash covers it |
| synced plugin desktop-commander | desktop-commander-overview | DROP | Tool tour for an MCP the owner is removing |
| synced plugin desktop-commander | ai-tools-setup | DROP | Repairs Claude Desktop MCP configs; one-off |
| synced plugin desktop-commander | computer-health-check | DROP | Disk and speed audit; unrelated to the workbench |
| synced plugin desktop-commander | knowledge-base | DROP | Markdown KB scheme; owner uses docs/ and memory |
| synced plugin desktop-commander | obsidian-vault | DROP | Owner does not use Obsidian |

## Design and personal skills (claude-design-skillstack, ui-ux-pro-max, frontend-design, graphify, mulmoterminal, reverse-engineer-anything)

| source | name | verdict | reason |
| --- | --- | --- | --- |
| skillstack/animation-components | animated-component-libraries | DROP | Magic UI and React Bits copy-paste kits; pasting them produces the generated look. One cautionary row in the library table. |
| skillstack/animation-components | animejs | DROP | Tutorial for a library that overlaps GSAP and Motion; one row in the table says so. |
| skillstack/animation-components | lottie-animations | OURS:design-studio:adding-motion-and-3d new | Keeps the lazy-load, destroy-on-unmount, size-budget and poster rules; dotLottie package version verified. |
| skillstack/animation-components | react-spring-physics | DROP | Motion already has springs; table row says do not run both. |
| skillstack/animation-components | scroll-reveal-libraries | DROP | AOS-style reveals replaced by CSS scroll-driven animation or Motion `whileInView`; recipe included. |
| skillstack/authoring-motion | blender-web-pipeline | OURS:design-studio:adding-motion-and-3d new | Export checklist condensed into `references/3d-asset-pipeline.md`. |
| skillstack/authoring-motion | rive-interactive | OURS:design-studio:adding-motion-and-3d new | Rive chosen for stateful illustration; input-name gotcha kept. |
| skillstack/authoring-motion | spline-interactive | OURS:design-studio:adding-motion-and-3d new | Reduced to a decision: export video or glTF where interaction is not needed; runtime weight noted. |
| skillstack/authoring-motion | substance-3d-texturing | OURS:design-studio:adding-motion-and-3d new | Only the web-relevant rules survive: sizes, colour space, channel packing, compression. |
| skillstack/core-3d-animation | babylonjs-engine | DROP | Full game engine; one table row for when three.js is not enough. |
| skillstack/core-3d-animation | gsap-scrolltrigger | OURS:design-studio:adding-motion-and-3d new | Scroll storytelling row, `useGSAP` plus `matchMedia` recipe, cleanup and same-property-conflict gotchas. |
| skillstack/core-3d-animation | motion-framer | OURS:design-studio:adding-motion-and-3d new | Motion for UI transitions; `MotionConfig`, `LazyMotion`, `AnimatePresence` recipe. |
| skillstack/core-3d-animation | react-three-fiber | OURS:design-studio:adding-motion-and-3d new | Lazy canvas, `frameloop="demand"`, no setState in `useFrame`, SSR client-only. |
| skillstack/core-3d-animation | threejs-webgl | OURS:design-studio:adding-motion-and-3d new | Dispose resources, geometry reuse and instancing folded into the budget and lifecycle steps. |
| skillstack/extended-3d-scroll | aframe-webxr | DROP | XR only; one table row. |
| skillstack/extended-3d-scroll | barba-js | DROP | Multi-page transitions; View Transitions API plus TanStack Router replaces it. |
| skillstack/extended-3d-scroll | lightweight-3d-effects | DROP | Zdog, Vanta and Vanilla-Tilt decorations read as templated; table row says skip. |
| skillstack/extended-3d-scroll | locomotive-scroll | DROP | Scroll hijack; Lenis plus ScrollTrigger on request. |
| skillstack/extended-3d-scroll | pixijs-2d | DROP | Heavy 2D scenes only; one table row. |
| skillstack/extended-3d-scroll | playcanvas-engine | DROP | Hosted-editor engine, rarely right for this work; one table row. |
| skillstack/meta-skills | modern-web-design | OURS:design-studio:adding-motion-and-3d new | Only the motion, performance and accessibility sections kept. Its trend list (glassmorphism, cursor effects, scrollytelling everywhere) conflicts with the owner's taste and was dropped. |
| skillstack/meta-skills | web3d-integration-patterns | OURS:design-studio:adding-motion-and-3d new | Reduced to "one owner per property" and the library-combination decision table. |
| skillstack agents | animation-components-integration, animated-component-libraries-specialist, animejs-choreographer, lottie-animations-choreographer, react-spring-physics-choreographer, scroll-reveal-libraries-specialist (6) | DROP | Role stubs: expertise list and "approach" of five generic steps. No procedure, no output format. |
| skillstack agents | authoring-motion-integration, blender-web-pipeline-pipeline, rive-interactive-choreographer, spline-interactive-pipeline, substance-3d-texturing-pipeline (5) | DROP | Same stub shape. |
| skillstack agents | core-3d-animation-integration, babylonjs-engine-architect, gsap-scrolltrigger-choreographer, motion-framer-choreographer, react-three-fiber-architect, threejs-webgl-architect (6) | DROP | Same stub shape. |
| skillstack agents | extended-3d-scroll-integration, aframe-webxr-architect, barba-js-specialist, lightweight-3d-effects-architect, locomotive-scroll-specialist, pixijs-2d-architect, playcanvas-engine-architect (7) | DROP | Same stub shape. |
| skillstack agents | meta-skills-integration, modern-web-design-specialist, web3d-integration-patterns-specialist (3) | DROP | Same stub shape. |
| ui-ux-pro-max | ui-ux-pro-max | OURS:design-studio:choosing-type-and-color new | Idea only: searchable style/palette/font data. Rebuilt as a 25 palette and 26 font-pairing dataset with a search and token-export script. Its chart and UX-priority tables informed `styling-charts-and-data-displays`. 79 styles, 192 palettes and 119 guidelines not copied. |
| ui-ux-pro-max | design | DROP | Logo/CIP/icon/social-photo generation through Gemini or other image APIs; not a workflow the owner uses. |
| ui-ux-pro-max | banner-design | DROP | Banner sizes and art-direction styles; occasional need, see proposal 4 for a small addition to presenting-guided-demos instead. |
| ui-ux-pro-max | brand | DROP | Brand voice and asset-management templates; no recurring use. Revisit if client brand kits become a pattern. |
| ui-ux-pro-max | design-system | OURS:design-studio:choosing-type-and-color new | Three-layer token idea (primitive, semantic, component) is in the exported tokens file. Its slide generation part is not kept. |
| ui-ux-pro-max | slides | MERGED:design-studio:presenting-guided-demos existing | Copy structure ideas only; see proposal 4. |
| ui-ux-pro-max | ui-styling | DROP | shadcn/Tailwind how-to Claude already knows; the owner's stack is Vite + TanStack, and `vercel:shadcn` exists for shadcn. |
| ui-ux-pro-max agent | design-review | MERGED:design-studio:design-critic existing | Browser-first phases and ranked report format worth adding; see proposal 2. |
| claude-plugins-official | frontend-design | MERGED:design-studio:designing-without-ai-slop existing | Best parts: a list of defaults that now read as generated, a plan-then-review pass, and UI copy rules. Proposals 1 and 3. |
| ~/.claude/skills | graphify | KEEP-THIRD-PARTY | CLI builds the code graph alone but the doc, paper and image extraction runs through the skill's subagents; see the graphify section. |
| ~/.claude/skills | mulmoterminal-bug-report | KEEP-THIRD-PARTY | App-bound: files issues for MulmoTerminal. |
| ~/.claude/skills | mulmoterminal-config | KEEP-THIRD-PARTY | App-bound: edits `~/.mulmoterminal/config.json`. |
| ~/.claude/skills | mulmoterminal-data-analysis | KEEP-THIRD-PARTY | Depends on the app's Canvas tools (presentSpreadsheet, presentChart). |
| ~/.claude/skills | mulmoterminal-decisions | KEEP-THIRD-PARTY | Reads the app's decision digest. |
| ~/.claude/skills | mulmoterminal-dirs | KEEP-THIRD-PARTY | Writes per-project `.mulmoterminal.json`. |
| ~/.claude/skills | mulmoterminal-header | KEEP-THIRD-PARTY | App header buttons and chips. |
| ~/.claude/skills | mulmoterminal-help | KEEP-THIRD-PARTY | Answers from the app's shipped guide and server. |
| ~/.claude/skills | mulmoterminal-html-plan | KEEP-THIRD-PARTY | Uses the app's `presentHtml` pane; the owner's own preview-first flow is separate. |
| ~/.claude/skills | mulmoterminal-keys | KEEP-THIRD-PARTY | App keymap. |
| ~/.claude/skills | mulmoterminal-model | KEEP-THIRD-PARTY | App provider registry. |
| ~/.claude/skills | mulmoterminal-notify | KEEP-THIRD-PARTY | App sounds and push settings. |
| ~/.claude/skills | mulmoterminal-shared-app | KEEP-THIRD-PARTY | App publish and unpublish flow. |
| ~/.claude/skills | mulmoterminal-theme | KEEP-THIRD-PARTY | App theme picker. |
| ~/.claude/skills | mulmoterminal-video-edit | KEEP-THIRD-PARTY | Needs the app and ffmpeg/whisper.cpp wiring it configures. |
| ~/.claude/skills | reverse-engineer-anything | KEEP-THIRD-PARTY | Instructions for the REA MCP server (`mcp__rea__*`, installed with `npx rea-agents setup`); useless without it and updated with the package. |

