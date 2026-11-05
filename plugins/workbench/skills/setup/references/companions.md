# Companion plugins (official catalog)

The workbench does not repackage what the official catalog (`claude-plugins-official`) already ships. Offer these in setup round 3 as a multiSelect, grouped. Install with `claude plugin install <name>@claude-plugins-official`.

| Group | Plugin | Why it pairs with the workbench |
|---|---|---|
| Process | `superpowers` | brainstorming, plans, TDD and debugging discipline the owner already uses |
| Design | `frontend-design` | aesthetic direction used by design-studio |
| Web | `vercel` | Vercel docs, CLI and MCP; stack-web assumes it |
| Email | `resend` | Resend account operations and MCP |
| DNS/edge | `cloudflare` | Cloudflare API MCP (stack-web:adding-subdomains uses plain curl by default) |
| Agents | `pydantic-ai` | Pydantic AI docs and helpers |
| Observability | `logfire` | Logfire MCP for traces from Pydantic AI, FastAPI and Temporal |
| Docs | `context7` | current library docs on demand |
| Database | `neon`, `prisma` | Neon branches and Prisma tooling for TS projects |
| Vectors | `qdrant-skills` | Qdrant guidance (stack-connectors adds the Qdrant MCP) |
| Source control | `github` | GitHub MCP |
| Browser | `playwright`, `chrome-devtools-mcp` | browser verification for design-studio:verifying-ui-in-browser |
| Review | `code-review`, `security-guidance` | review passes before merge and deploy |

Check a name exists before installing: `claude plugin details <name>@claude-plugins-official`. The catalog changes; skip any that no longer exist and say so.
