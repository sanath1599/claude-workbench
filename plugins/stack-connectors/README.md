# stack-connectors

MCP servers for the workbench stack, so the owner doesn't need the third-party plugins that used to bring them. Remote servers use OAuth: run `/mcp` and authenticate each one on first use. No secret is stored in `.mcp.json`. Local servers are pinned to exact versions; the daily maintenance job bumps them.

| Server | Kind | Used by | Notes |
|---|---|---|---|
| `vercel` | remote, OAuth | stack-web:deploying-on-vercel and other Vercel skills | projects, deployments, logs |
| `cloudflare-api` | remote, OAuth | stack-web:adding-subdomains, using-cloudflare-beyond-dns | full Cloudflare API; scope the token to the zones you need. `cf-dns.mjs` stays the default for DNS writes. |
| `cloudflare-docs` | remote, no auth | Cloudflare skills | current Cloudflare docs |
| `resend` | remote, OAuth | stack-web:sending-email-with-resend | domains, emails, webhooks. For headless use, swap in a `Authorization: Bearer ${RESEND_API_KEY}` header. |
| `logfire` | remote, OAuth (US region) | ops-and-sre:instrumenting-services | traces from Pydantic AI, FastAPI and Temporal. For the EU region use `logfire-eu.pydantic.dev`. |
| `temporal-docs` | remote, OAuth (Google or GitHub) | stack-python:orchestrating-with-temporal | Temporal documentation search |
| `context7` | remote, key optional | any skill that says "read the current docs" | library docs on demand |
| `prisma-local` | local, `npx prisma@7.10.1 mcp` | stack-python:modeling-data-in-postgres (TS projects) | migrate status and dev, Studio |
| `chrome-devtools` | local, `npx chrome-devtools-mcp@1.12.0` | design-studio:verifying-ui-in-browser, stack-web:debugging-web-performance-in-chrome | browser automation, traces, Lighthouse |

Not bundled:
- Qdrant's `mcp-server-qdrant`. It only works with collections built with its own fastembed embeddings. Add it per project with `claude mcp add qdrant --scope project -e QDRANT_URL=... -- uvx mcp-server-qdrant==0.8.1`.
- Pinecone, Postman, and the remote Prisma account server. These are not part of the stack.

Disable a server you don't use with `/mcp`, or uninstall the plugin and add single servers per project.
