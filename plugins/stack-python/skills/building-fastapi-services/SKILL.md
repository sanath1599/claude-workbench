---
name: building-fastapi-services
description: Use when creating or changing a FastAPI service: project layout, pydantic-settings config, dependencies, lifespan, auth dependencies, starting Temporal workflows or sending signals from endpoints, Vercel deployment, uv, or pytest with httpx. Not for HTTP API contract design, which is engineering-craft:designing-apis, or the Temporal workflow code itself, which is stack-python:orchestrating-with-temporal.
---

# Building FastAPI services

The API is thin: validate, authorise, call a service function, return a typed response. Long work is handed to Temporal. The OpenAPI document is the contract.

## When to use

- A new Python HTTP backend, or a new router, dependency or settings class in one.
- An endpoint that starts a workflow, signals it, or reads its status.
- Deploying a FastAPI app to Vercel or an always-on host.

## When not to use

- Resource and error design, pagination, versioning: `engineering-craft:designing-apis`.
- Workflow, activity and worker code: `stack-python:orchestrating-with-temporal`.
- Agent code inside handlers: `stack-python:building-pydantic-ai-agents`.

## Procedure

1. **Scaffold with uv.** `uv init --app`, `uv add fastapi "uvicorn[standard]" pydantic-settings httpx temporalio`, `uv add --dev pytest pytest-asyncio ruff`. Commit `uv.lock`. Use the project's package manager choice (`{{wb.package_manager}}`) for any frontend part, and keep whatever lockfile a repo already has.
   **Done when:** `uv run pytest` runs (even with one smoke test).
2. **Lay out the code** so it imports cleanly and each layer is testable:
   ```
   src/<pkg>/
     main.py            # app = create_app(); the Vercel/uvicorn entrypoint
     config.py          # Settings (pydantic-settings), get_settings()
     deps.py            # Depends providers: settings, db session, temporal client, current user
     api/<area>.py      # routers: thin, typed request/response models
     services/          # business logic, no FastAPI imports
     schemas.py         # Pydantic models shared with OpenAPI
     db.py models.py    # see stack-python:modeling-data-in-postgres
     workflows/ activities/ worker.py   # only if this repo hosts workers (separate process)
   tests/
   ```
   **Done when:** `services/` has no `fastapi` import.
3. **Settings with pydantic-settings.** One cached `get_settings()`, `SecretStr` for keys, `extra="ignore"`, `env_file=".env"` for local only. Production variable names are distinct from test ones (`NEON_DATABASE_URL`). Settings validation fails startup loudly.
   ```python
   from functools import lru_cache
   from pydantic import SecretStr
   from pydantic_settings import BaseSettings, SettingsConfigDict

   class Settings(BaseSettings):
       model_config = SettingsConfigDict(env_file=".env", extra="ignore")
       database_url: str
       temporal_address: str = "localhost:7233"
       temporal_namespace: str = "default"
       temporal_api_key: SecretStr | None = None
       agent_api_secret: SecretStr

   @lru_cache
   def get_settings() -> Settings:
       return Settings()
   ```
   **Done when:** a test shows the app fails to start with a missing required variable and the error does not print values.
4. **Lifespan owns long-lived clients** (DB engine, httpx client, Temporal client); dependencies hand them out. Lifespan events work on Vercel.
   ```python
   from contextlib import asynccontextmanager
   from fastapi import FastAPI, Depends, Request
   from temporalio.client import Client

   @asynccontextmanager
   async def lifespan(app: FastAPI):
       s = get_settings()
       app.state.temporal = await Client.connect(
           s.temporal_address, namespace=s.temporal_namespace,
           api_key=s.temporal_api_key.get_secret_value() if s.temporal_api_key else None,
           tls=bool(s.temporal_api_key))
       yield

   def create_app() -> FastAPI:
       app = FastAPI(lifespan=lifespan)
       app.include_router(reviews.router, prefix="/reviews")
       return app

   app = create_app()

   def temporal(request: Request) -> Client:
       return request.app.state.temporal
   ```
   On Vercel, instances are short-lived: connecting per cold start is fine; do not hold hundreds of connections.
   **Done when:** the app starts and stops cleanly under `uvicorn` and a test overrides the Temporal dependency.
5. **Endpoints that start durable work return fast.** Start the workflow with a business-key id and `id_conflict_policy` so retries are safe, return `202` with the id and a status URL; send signals and updates for human actions; read status with a query or describe.
   ```python
   @router.post("/", status_code=202, response_model=ReviewStarted)
   async def start_review(body: ReviewIn, user: User = Depends(require_user),
                          tc: Client = Depends(temporal)):
       wid = f"review-{body.doc_id}"
       await tc.start_workflow(DocReview.run, body.doc_id, id=wid, task_queue="main",
                               id_conflict_policy=WorkflowIDConflictPolicy.USE_EXISTING)
       return ReviewStarted(workflow_id=wid)

   @router.post("/{doc_id}/decision", status_code=204)
   async def decide(doc_id: str, body: DecisionIn, user: User = Depends(require_manager),
                    tc: Client = Depends(temporal)):
       await tc.get_workflow_handle(f"review-{doc_id}").signal(DocReview.decide, args=[body.outcome, user.id])
   ```
   Do not run agents or long loops inside the request; an agent called here is not durable. Workers run elsewhere (see `stack-python:orchestrating-with-temporal`, Hosting).
   **Done when:** a test with a fake Temporal client asserts the id, conflict policy and signal arguments.
6. **Auth as dependencies.** `require_user`, `require_manager` read a verified token or session, never a client-supplied role. Service-to-service endpoints (an agent calling the backend) use a bearer secret compared in constant time (`secrets.compare_digest`). Check authorisation again in the service layer for sensitive actions. Webhooks verify signatures before parsing. Callbacks behind platform auth (for example Azure Easy Auth) are blocked until the exact path is added to the excluded paths (save the previous auth config first), so protect that path yourself: answer the validation handshake by echoing the token as `text/plain`, compare the shared secret (`clientState`) in constant time, return 202 fast and enqueue, de-dupe by event key, and log a content-free audit line for lifecycle notifications. Remote subscriptions expire (about 3 days for calendar events): renew on a timer, and delete the remote subscription when you delete the user.
   **Done when:** tests cover 401, 403 and the happy path per protected route.
7. **OpenAPI is the contract.** Set `response_model`, `status_code`, `responses`, tags and operation ids on every route; export `openapi.json` in CI and diff it for breaking changes. Design questions go to `engineering-craft:designing-apis`.
   **Done when:** the exported spec is committed or checked in CI.
8. **Vercel entrypoint.** Vercel finds a `FastAPI` instance named `app` in `app.py`, `index.py`, `server.py`, `main.py`, `wsgi.py` or `asgi.py`, or the same filenames inside `src/` or `app/` (docs page last updated 2026-08-27). Keep `app = create_app()` there. Python version is configured per Vercel's runtime page. Functions are request-scoped with duration limits, so no background threads and no Temporal workers. Local run: `uv run uvicorn <pkg>.main:app --reload --port 8000` (check the port is free).
   **Done when:** `vercel dev` or a preview deployment answers `/openapi.json`. Production deploys need the owner's yes.
9. **Tests with pytest and httpx.** `httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")`; override dependencies (`app.dependency_overrides`) for the user, database session and Temporal client; use `pytest-asyncio` with `asyncio_mode = "auto"`. Temporal-touching logic is tested with the workflow test environment in the worker repo, not through HTTP. No real LLM, email, voice or Temporal Cloud calls.
   **Done when:** the suite passes offline with `uv run pytest`.

## Rationalizations

| Excuse | Do instead |
|---|---|
| "Run the agent in the endpoint, it is quick" | It will not be durable or bounded. Start a workflow. |
| "Read the role from the request body" | Roles come from the verified identity. |
| "Create the Temporal client per request" | One in lifespan, handed out by a dependency. |
| "Settings can default the secret" | Required secrets have no default; startup fails. |

## Verification

- [ ] `services/` free of FastAPI imports; routers thin.
- [ ] Settings fail closed; no secret in logs or errors.
- [ ] Workflow starts use business-key ids and a conflict policy.
- [ ] Auth tests: 401, 403, success.
- [ ] `openapi.json` exported and reviewed.
- [ ] `uv run pytest` passes offline; no production deploy without a yes.

## Versions

- fastapi 0.162.0 (verified 2026-11-05, https://pypi.org/project/fastapi/)
- uvicorn 0.54.0 (verified 2026-11-05, https://pypi.org/project/uvicorn/)
- pydantic-settings 2.16.2 (verified 2026-11-05, https://pypi.org/project/pydantic-settings/)
- httpx 0.28.1 (verified 2026-11-05, https://pypi.org/project/httpx/)
- pytest-asyncio 1.4.1.post1 (verified 2026-11-05, https://pypi.org/project/pytest-asyncio/)
- uv 0.13.7 (verified 2026-11-05, https://github.com/astral-sh/uv/releases)
- Vercel FastAPI entrypoints (verified 2026-11-05, https://vercel.com/docs/frameworks/backend/fastapi)
