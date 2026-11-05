# Learnings

Entries from real projects that were folded into skills, newest first. Format: `date · skill · what was added · source project`.

## 2026-11-05

### Stack skills
- stack-python:modeling-data-in-postgres · Cloud sandbox reaches HTTPS only: local Postgres, production migrate as owner step, separate deploy env file; name constraints · AI interview platform
- stack-python:calling-llms-reliably · Mock switches refused in production behind a second flag; visible strong-model fallback; tiered prompt cache; result caching with single-flight · AI interview platform
- stack-python:building-voice-agents · Planned conversation path, idempotent finish contract, privacy and SDK gotchas · AI interview platform
- stack-python:building-pydantic-ai-agents · Bounded hand-rolled tool loop on serverless · assistant tooling project
- stack-python:building-fastapi-services · Callbacks behind platform auth need exclusion plus own handshake and secret · calendar bot project
- stack-web:working-in-nextjs-16 · Empty-string-as-unset config, server-only outside Next, TLS proxy and dev-server notes · AI interview platform
- stack-web:adding-auth · Accountless tokens, DB sessions, org sign-in cookie, GitHub App tokens · AI interview platform
- stack-web:adding-subdomains · Canonical-host redirect in proxy.ts · AI interview platform
- stack-web:sending-email-with-resend · Email ledger statuses, deliverability checklist, React Email, test redirect · AI interview platform
- stack-web:deploying-on-vercel · Release steps in the build, password-gated app, shared code copy, preview database, CLI caveats, package manager · content site project
- stack-web:choosing-background-work-on-vercel · Daily cron backstop plus throttled after() sweeper · AI interview platform
- stack-web:building-map-apps · New skill: tile proxy, session handling, MapLibre filter patterns · mapping tool project
- stack-web:running-content-pipelines · New skill: slug files, hash-skip releases, publish gate, honesty rules, retirement, images · content site project

### Craft skills
- engineering-craft:building-llm-features · document fencing, injectionSuspected flag, verified evidence quotes, proof-scaled caps, weight normalisation, three-outcome review routing · interview platform
- engineering-craft:building-llm-features · effort selection, latency follows output tokens, honest progress, NDJSON streaming and cheap-to-strong hand-off, AI Gateway option · design-tool assistant
- engineering-craft:designing-apis · Postgres rate limiter, machine endpoints and route wrapper, approval-by-link, docs for agents · interview platform
- engineering-craft:designing-systems · status transition table, AST boundary test, shared rules engine, committed lookup cache · interview platform
- engineering-craft:hardening-distributed-systems · versioned object-store state, claim/lease/lock for interactive messages, retry policy on non-idempotent calls, unawaited work · workflow bot
- engineering-craft:planning-tests · real-Postgres and E2E harness guards, in-memory fakes, stale generated artifacts, OAuth/MCP route tests · interview platform
- engineering-craft:reviewing-security · sandboxed generated HTML, untrusted repo scrub, container flags, query-string/upstream-error rows, checked-and-fine list · design-tool assistant
- engineering-craft:running-qa-passes · recurring QA misses checklist row · interview platform
- engineering-craft:answering-pr-reviews · audit table for large review rounds, post-merge smoke boot · workflow bot
- engineering-craft:building-mcp-servers · no model calls in server, guard wrapper, playbook-first tool, public-client OAuth details · design-tool assistant
- ops-and-sre:deploying-to-azure · new skill: subscription pinning, PIM stop-and-ask, prebuilt zip, ARM proxy and temporary IP rules, identity · workflow bot
- ops-and-sre:releasing-safely · migration gate, scratch-db rehearsal, workflow backups, per-capability flags, read-back, clean build · workflow bot
- ops-and-sre:deploying-to-a-vps · SSE buffering, 413 body limit, upload timeouts, build-time URLs, SPA 200 HTML · client web apps
- ops-and-sre:writing-runbooks · deployment log, skipped-features, pending-items, safe owner scripts · workflow bot
- ops-and-sre:instrumenting-services · content-free business events, observability as code · workflow bot
- ops-and-sre:defining-slos-and-alerts · heartbeat and gap monitor for pollers · workflow bot
- ops-and-sre:handling-incidents · read-only production investigation · client web apps
- design-studio:building-single-file-html · new skill: placeholders, size budget, scoped generated markup · design-tool assistant
- design-studio:previewing-ui-before-building · clickable prototype reference (dataset, store, fixed today, roles, mock services) · HR prototype
- design-studio:verifying-ui-in-browser · infer the user story first; offline artifact checks · design-tool assistant
- design-studio:writing-showcase-readmes · real vs simplified and data provenance sections · client web apps
- design-studio:presenting-guided-demos · chart skill pointer · docs audit
- workbench:delegating-to-subagents · parallel UI work: freeze foundation, file scope, screenshots · HR prototype
- workbench:using-sileo-toasts · convention docs must be grepped for wrong toast libraries · HR prototype
- workbench:writing-deliverables · reader test, document skills pointer · docs audit
- workbench:handling-secrets · seed passwords never in instruction files · client web apps
- kickoff:choosing-the-stack · long-lived workers get their own deployable · interview platform
- kickoff:writing-the-design-spec · open-question owners, success measures · docs audit
