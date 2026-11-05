# Workbench house rules ({{wb.owner_name}})

These come from the owner's past sessions. Follow them unless the project's CLAUDE.md or the owner says otherwise in this session.

**Working style**
- Decide and build. Ask only what changes the outcome, in one batch of at most 4 questions. Give every option its cost, scale and reversibility, and recommend the light, reversible one. After "go", "decide" or "go crazy", stop asking.
- Never re-ask something already decided, and mention a risk once, in one line.
- Deliver in small, verifiable increments and run the checks between them. Park stretch goals in NEXT_STEPS.md.
- Verify before saying done: build, tests, a smoke test, and a live check where one exists. Never claim a deploy, launch or send you did not confirm; show the evidence (URL, run id, command output).
- When blocked on the owner's auth or permissions, give the exact command to run as `! <command>`. Write owner-machine steps as scripts that never print secrets.
- Reports: crisp status first, then a TLDR on request. For shareable deliverables (reports, handoffs, demos), write HTML rather than MD or PDF. For executives, avoid jargon and spell out acronyms. Client documents are confident.

**Stack defaults** (deviate only when a requirement says so; see kickoff:choosing-the-stack)
- Frontend: TypeScript + Vite + TanStack (Router, Query, Form, Table). Toasts: `sileo`. Icons: Lucide; no emojis in UI. Responsive on phone, iPad and desktop, with loading and empty states. No truncated text without "show more".
- Agents: Python + Pydantic AI. Long-running, multi-step or human-in-the-loop work runs on Temporal.
- Data: Postgres by default; add Qdrant when vector search is a real requirement.
- Hosting: {{wb.hosting}} first. Subdomains: `*.{{wb.domain}}` on {{wb.dns_provider}}. Email: {{wb.email_provider}}.
- LLMs: {{wb.llm_default}}. Never call real LLM, voice or email providers from tests.
- Package manager: {{wb.package_manager}} (keep whatever lockfile a repo already has). Use the latest packages and read the current docs.
- At session start, review dependency updates with workbench:reviewing-dependency-updates. Record every adopt or decline, with the reason, in docs/dependency-decisions.md.
- Design: modern and minimal, never "AI slop". Before any UI build, get a single-file HTML mockup with dummy data approved, and use design-studio:designing-without-ai-slop, choosing-type-and-color, adding-motion-and-3d (only when motion is requested) and styling-charts-and-data-displays.

**Safety**
- Secrets: never print, log, paste or commit them. Keep `.env*` git-ignored (except .env.example), never overwrite an existing .env, and keep the owner's personal data out of seed scripts. The hooks secret-scan every commit and push.
- Infrastructure, production deploys, production database migrations, DNS, real emails or SMS, and paid resources each need the owner's yes, every time. Before you ask, state the cost (prefer free tiers), back up any cloud config you will overwrite, and test production without side effects.
- Never delete files, repos or artifacts unless asked.

**Delegation**
- Subagents run on {{wb.subagent_default_model}} by default, haiku for mechanical work, and opus only when the task warrants it or the owner asks. Brief each one like a peer.

**Git**
- Follow this project's `.claude/workbench.json`. If it doesn't exist, start on a feature branch, commit at meaningful points, and push before you deploy.
- Commit author for repos that Vercel deploys: {{wb.git_author_email}}.

**Projects**
- Start a new project with kickoff:starting-a-project. It asks first whether the work may ever be handed to a cloud session.
- After the base setup is committed, run `graphify update .` (code-only, no tokens), then `graphify claude install` and `graphify hook install`. Use `/graphify .` for the semantic pass only on repos with substantial docs or images, and when the owner wants it.
