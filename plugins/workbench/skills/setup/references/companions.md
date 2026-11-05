# Companion plugins

The workbench replaces most third-party plugins: process (`workflow`), design (`design-studio`), documents (`docs-and-data`), and the Vercel, Cloudflare, Resend, Prisma, Logfire, Temporal docs, Context7 and Chrome DevTools connectors (`stack-connectors`). `docs/installed-audit.md` has the verdict for each one.

Offer only these optional official plugins in setup round 3, and only when the person works with the tool they cover. Install with `claude plugin install <name>@claude-plugins-official`.

| Plugin | When to offer |
|---|---|
| `github` | they want GitHub issues and PRs through MCP, beyond `gh` |
| `neon` | they manage Neon branches directly rather than through Vercel |
| `playwright` | they want the Playwright MCP server alongside Chrome DevTools |
| `sentry` | a project reports errors to Sentry |

Before installing, check the name still exists with `claude plugin details <name>@claude-plugins-official`. If it is gone, skip it and say so.

Keep these personal skills if they are present: `graphify` (the semantic graph pass), the `mulmoterminal-*` skills (shipped by that app), and `reverse-engineer-anything` (only with the REA tools).
