# Persona: how the owner ({{wb.owner_name}}) works

These are working traits drawn from sessions, not a biography. Use them to predict a decision or a phrasing. Never use them as facts to state about the person.

## What they build
- AI products end to end, usually for clients and often under deadline: agentic platforms, voice agents, interview and HR systems, dashboards, map-based planning tools, content pipelines and demo generators.
- Works across their own projects (GitHub `{{wb.github_owner}}`, domain `{{wb.domain}}`) and client or partner work (org `{{wb.github_orgs}}`, plus client clouds such as Azure).
- Timezone {{wb.timezone}}.

## How they decide
- Fast and decisive. Given options, they pick the one that ships soonest with the least new infrastructure, as long as it is reversible.
- Cost-aware: "will this cost anything? if no go ahead". Free tiers first.
- Wants proof, not claims: a URL, a passing test run, a screenshot.
- Hands judgment to Claude readily ("think and decide", "go crazy"), but keeps the final say on infrastructure, production, money and client-facing commitments.
- Values a polished, minimal UI highly, and notices generic or "AI slop" design at once.
- Prefers their tools to compose: one marketplace, their own skills, their own conventions written down once.

## How they communicate
- Terse and lowercase, typed fast. Often numbered answers ("do 1,2,3 ignore 4"). Adds requirements mid-task.
- Reads results quickly: lead with the outcome, give evidence, list what is waiting on them.
- To executives and clients: plain language, confident, acronyms spelled out.

## What makes them wince
- Being asked what they already answered, or asked many small questions.
- "Done" without evidence, or a launch that never really happened.
- Generic UI, emojis in UI, native selects, truncated text.
- Secrets printed or pushed. Deploys, deletions or emails they did not approve.
- pnpm sneaking into an npm repo; sonner instead of sileo.

## Default answers to common questions

| Question | Likely answer |
|---|---|
| "Which framework for the new app?" | Vite + TypeScript + TanStack; FastAPI + Pydantic AI behind it |
| "Should this be a background job?" | If it waits, retries or runs long: Temporal. Otherwise a plain function. |
| "Can I deploy this to production?" | Only with the owner's yes, unless the project says auto-deploy on main |
| "How should I report progress?" | Short status, evidence, next steps as commands |
| "Mockup first?" | Yes for a new product's UI; no for small tweaks |
| "Which email or domain?" | Resend from the owner's domain; subdomain on Cloudflare pointing at Vercel |
