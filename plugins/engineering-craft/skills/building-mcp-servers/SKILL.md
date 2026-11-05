---
name: building-mcp-servers
description: Use when building or changing a Model Context Protocol server: designing its tools, serving it over streamable HTTP, adding OAuth 2.1 sign-in with client registration for Claude or ChatGPT connectors, testing it with an inspector, or debugging a connector that will not connect. Not for calling an existing MCP server from an agent (stack-python:building-pydantic-ai-agents) or for ordinary REST APIs (designing-apis).
---

# Building MCP servers

An MCP server is a small, well-labelled API for a model to use on a person's behalf. The model reads the tool names and descriptions, picks one, and fills in the arguments; the server does everything that must be exact, safe and authorised. Remote servers use streamable HTTP and OAuth, because Claude and ChatGPT connectors reach them over the internet.

## When to use

- A new MCP server, or new tools on one.
- Making a server remote and protecting it with OAuth 2.1 (discovery, PKCE, client registration, audience checks).
- A connector that fails to add, authorise, or list tools.

## When not to use

- Consuming MCP tools inside your own agent: `stack-python:building-pydantic-ai-agents`.
- A plain HTTP API for your own frontend: `engineering-craft:designing-apis`.
- Secrets handling in general: `workbench:handling-secrets`.

## Procedure

### 1. Decide what the server is for

Write the three to eight jobs a person will ask the model to do ("find my open invoices", "add a task"), not the list of API endpoints. One server serves one domain. Decide per job whether it only reads, writes reversibly, or does something destructive or costly; this drives annotations and confirmation.

**Done when:** each job maps to one tool and has a read, write or destructive label.

### 2. Design the tools for the model

- Names are verb-first and prefixed by domain when several servers may be connected (`invoices_find`, `invoices_create_draft`).
- The description says when to use the tool and when not to, in two sentences. Models choose from descriptions, so write them as you would brief a colleague.
- Few parameters, each with a type, a constraint and an example in its description. Prefer enums to free text. Accept names and let the server resolve ids, or provide a find tool that returns ids.
- Return only what the model needs next: short fields, no raw API dumps, a page size limit with a cursor, and a clear "no results" message. Large payloads cost the person's context.
- Errors say what went wrong and what to try ("No invoice 4411. Use invoices_find to search by customer."). Never leak stack traces or secrets.
- Set annotations honestly: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`.
- Define an output schema and return structured content when the SDK supports it.
- Make writes idempotent where you can (client-supplied key), and let destructive tools return a preview unless called with `confirm: true`.
- ChatGPT's deep research and company knowledge expect tools named `search` and `fetch` with a defined shape. If that integration matters, add them and check the current OpenAI docs for the exact schema.

**Done when:** you could hand the tool list to someone who has never seen the API and they would pick the right tool for each job.

### 3. Split responsibilities

| The server does | The model does |
|---|---|
| Authentication, authorisation, per-user data scoping | Choosing which tool and when |
| Validation, units, ids, dates, currency maths | Turning the person's words into arguments |
| Idempotency, rate limits, retries, audit log | Summarising results for the person |
| Confirming destructive actions | Asking the person when a request is ambiguous |

Never rely on the model to enforce a permission. Tool arguments are untrusted input; so are the contents of data the tools return (they can contain instructions aimed at the model).

### 4. Build it

Check the current SDK docs first; the TypeScript SDK has a v1 (`@modelcontextprotocol/sdk`) and a newer v2 (`@modelcontextprotocol/server`). Use v2 for new servers unless the project already depends on v1. Python options are the official `mcp` package and `fastmcp`. Rules:

- Transport: streamable HTTP at one path (for example `/mcp`), stateless JSON responses unless you need server-initiated messages. stdio only for local servers.
- Validate the `Origin` header and bind local servers to 127.0.0.1.
- Validate inputs with Zod or Pydantic; reject unknown fields.
- Log each tool call (name, user id, duration, outcome), never arguments that contain secrets or personal data.
- Keep configuration in environment variables; no literal secrets in code or the repo.

**Done when:** the server starts, lists its tools, and a tool call over HTTP returns a valid result.

### 5. Add OAuth 2.1 (remote servers with accounts)

The server is a resource server; the authorization server can be the same app or a separate identity provider. Read the current spec at https://modelcontextprotocol.io/specification/draft/basic/authorization before implementing. The pieces, as of the verification date below:

1. An unauthenticated MCP request gets `401` with `WWW-Authenticate: Bearer resource_metadata="https://<host>/.well-known/oauth-protected-resource"` (and a `scope` when useful).
2. `/.well-known/oauth-protected-resource` (RFC 9728) returns `resource` (the canonical server URL) and `authorization_servers`, plus `scopes_supported`.
3. The authorization server publishes metadata (RFC 8414 at `/.well-known/oauth-authorization-server`, or OpenID configuration) with `issuer`, `authorization_endpoint`, `token_endpoint`, `registration_endpoint` and `code_challenge_methods_supported: ["S256"]`.
4. Client registration: clients register themselves. Dynamic client registration (RFC 7591, `POST /register`) is what Claude and many clients have used; the newer spec prefers Client ID Metadata Documents (an HTTPS URL as `client_id`) and marks DCR as legacy. Support both if you can: `client_id_metadata_document_supported: true` plus a `registration_endpoint`.
5. Authorization code flow with PKCE (`S256` only), the `resource` parameter on authorize and token requests (RFC 8707), exact-match redirect URIs, short-lived access tokens, rotated refresh tokens.
6. On every MCP request the server validates the bearer token: signature, issuer, expiry, scopes, and that the audience equals this server's `resource`. Tokens from other audiences are rejected. Never accept a token in the query string.
7. Insufficient scope returns `403` with `error="insufficient_scope"` and the full scope set the operation needs.
8. Emit `iss` in authorization responses and set `authorization_response_iss_parameter_supported: true` (RFC 9207); ChatGPT uses a different redirect URI depending on this.

Redirect URIs to allow, to be verified in each product's current connector docs: for Claude, its connector callback on claude.ai (and claude.com); for ChatGPT, `https://chatgpt.com/connector_platform_oauth_redirect` when `iss` is returned, otherwise the per-connector callback URL shown on the connector's page. Lightweight sign-in for internal tools is fine, but the discovery, PKCE, DCR and audience checks are not optional because clients depend on them. Use a maintained OAuth library or identity provider for the heavy parts rather than hand-rolling token signing.

**Done when:** a client with no prior registration can discover, register, authorise and call a tool, and a token for another audience gets 401.

### 6. Test

- Unit tests for each tool handler and for token validation, with the identity provider mocked.
- Run the inspector against the local server: `npx @modelcontextprotocol/inspector` and connect over streamable HTTP; test the OAuth flow in its auth tab, list tools, call each one, and try bad arguments.
- Exercise discovery by hand: `curl -i https://<host>/mcp` (expect 401 and the header), then the two well-known URLs.
- Evaluate tool selection: write ten realistic requests and check that a model with only the tool list picks the right tool and arguments (see `engineering-craft:building-llm-features` for eval design).
- Never point tests at production data or real provider accounts without the owner's yes.

**Done when:** inspector listing and a full OAuth round trip pass, and the ten-request check picks the right tools.

### 7. Connect it

Both products need a public HTTPS URL (a tunnel for local testing).

- Claude: Settings, Connectors, add a custom connector with the server URL. On team plans an owner adds it for the organisation first. Test in a new chat and watch the server logs for the discovery requests.
- ChatGPT: enable developer mode in Settings, Connectors (advanced), create a connector with the server URL and OAuth. Business and Enterprise plans may need an admin to allow it.
- If authorisation fails: check the 401 header first, then the well-known documents (public, HTTPS, no redirects to HTML), then the registration response, then redirect URI exact match, then the audience claim.

**Done when:** a real conversation in each client calls a tool and shows the result.

## Verification

- [ ] Each tool is verb-first, has a two-sentence description, honest annotations and a bounded output.
- [ ] Permissions are enforced by the server.
- [ ] Discovery, PKCE, registration and audience validation were exercised end to end.
- [ ] Inspector run and the ten-request tool-selection check passed.
- [ ] No secrets in code, logs or the repo.

## Versions

- @modelcontextprotocol/server 2.4.0 (verified 2026-11-05, https://www.npmjs.com/package/@modelcontextprotocol/server)
- @modelcontextprotocol/sdk 1.32.2 (v1 line, verified 2026-11-05, https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- @modelcontextprotocol/inspector 2.14.0 (verified 2026-11-05, https://www.npmjs.com/package/@modelcontextprotocol/inspector)
- mcp (Python) 2.3.0 (verified 2026-11-05, https://pypi.org/project/mcp/)
- fastmcp 4.1.6 (verified 2026-11-05, https://pypi.org/project/fastmcp/)
- MCP authorization spec, draft (verified 2026-11-05, https://modelcontextprotocol.io/specification/draft/basic/authorization)
- ChatGPT connector auth requirements (verified 2026-11-05, https://developers.openai.com/apps-sdk/build/auth)
