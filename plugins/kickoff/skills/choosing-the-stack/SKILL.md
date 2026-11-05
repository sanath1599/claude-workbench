---
name: choosing-the-stack
description: Use when starting a new project, adding a major capability (a database, vector search, background jobs, an AI agent, voice, auth, email, file storage), or when a brief names a technology and you must decide whether to follow it or the owner's defaults. Not for upgrading an existing dependency, which is workbench:reviewing-dependency-updates.
---

# Choosing the stack

The owner has defaults for every layer. Use them unless a requirement, a client mandate or an existing codebase says otherwise. When you deviate, write down why in the design spec, in one line.

## When to use
- A new project or service, or a new capability the current stack doesn't have.
- A brief proposes something different from the defaults.

## When not to use
- Version bumps: workbench:reviewing-dependency-updates.
- An existing client codebase with its own stack (for example Azure Functions): follow that codebase.

## Defaults by requirement

| Requirement | Choose | Then read |
|---|---|---|
| Auth-gated web app or dashboard | TypeScript + Vite + TanStack Router/Query/Form/Table as an SPA | stack-web:building-tanstack-frontends |
| Public pages that need SSR or SEO, or a TS backend-for-frontend | TanStack Start on Vercel | stack-web:building-tanstack-frontends |
| An existing Next.js app | stay on Next.js 16 | stack-web:working-in-nextjs-16 |
| An HTTP API | Python FastAPI with Pydantic models, on Vercel | stack-python:building-fastapi-services |
| An LLM agent or tool-using assistant | Pydantic AI | stack-python:building-pydantic-ai-agents |
| Work longer than one request, multi-step with retries, human approval waits, schedules | Temporal (Temporal Cloud), workers on an always-on host | stack-python:orchestrating-with-temporal |
| A short task under a few minutes with no waits | a plain function or background task, not Temporal | |
| Relational data, the system of record | Postgres: Neon in production, Docker locally on a unique port | stack-python:modeling-data-in-postgres |
| Semantic or vector search | pgvector for small corpora with simple filters; Qdrant for hybrid, heavily filtered, large or multi-tenant search | stack-python:searching-with-qdrant |
| File uploads | private Vercel Blob with signed access | stack-web:deploying-on-vercel |
| Email | Resend from `{{wb.email_from}}` | stack-web:sending-email-with-resend |
| Sign-in | the lightest option that fits | stack-web:adding-auth |
| Voice agent | LiveKit Agents (Python) with LiveKit Inference | stack-python:building-voice-agents |
| LLM provider | {{wb.llm_default}} | stack-python:calling-llms-reliably |
| Hosting | {{wb.hosting}} first; a VPS for always-on processes (workers, long sockets) | stack-web:deploying-on-vercel, ops-and-sre:deploying-to-a-vps |
| A public URL | `<name>.{{wb.domain}}` on {{wb.dns_provider}} | stack-web:adding-subdomains |
| UI details | sileo toasts, Lucide icons, a design tokens file | workbench:using-sileo-toasts, design-studio:designing-without-ai-slop |
| Tooling | {{wb.package_manager}} for JS, `uv` for Python; Vitest, pytest, Playwright | engineering-craft:planning-tests |

## Procedure

1. **Extract the requirements** from the brief: users and scale, data, real-time or long-running work, AI, compliance, hosting constraints, budget.
2. **Map each one** with the table. Note every place the brief or a constraint overrides a default.
3. **Check costs.** Name the free tier or monthly cost of anything new (Neon, Temporal Cloud, Qdrant Cloud, LiveKit, Vercel plan). Prefer free tiers. Say so before provisioning.
4. **Read current docs** for each chosen library before writing code. Versions move fast; the Versions blocks in the linked skills say when they were last checked.
5. **Record** the choices in the design spec's "Stack" section as a table: layer, choice, reason. Deviations go in one line each.
   **Done when:** every layer the project needs has a choice and a reason.

## Common mistakes
- Reaching for Next.js on a new app because it's familiar. The default is Vite + TanStack unless SSR or SEO is needed.
- Using Temporal for a 5-second job, or a cron plus a status column for a 3-day approval flow. Match the tool to the duration and the failure modes.
- Adding Qdrant for a few thousand rows that pgvector would handle.
- Introducing pnpm or a second package manager into an npm repo.
