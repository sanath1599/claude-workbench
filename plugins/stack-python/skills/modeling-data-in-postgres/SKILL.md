---
name: modeling-data-in-postgres
description: Use when designing tables, writing migrations, setting up SQLAlchemy 2 and Alembic or Prisma 7, choosing local and production database URLs, seeding data, adding pgvector, or fixing serverless connection pooling. Not for vector search at scale, which is stack-python:searching-with-qdrant, or REST design, which is engineering-craft:designing-apis.
---

# Modeling data in Postgres

Postgres is the system of record. Local runs in a per-project container on a unique port; production is Neon with distinctly named variables; every schema change is a migration.

## When to use

- New schema, new column, new table, new index, new seed.
- Wiring a Python service (SQLAlchemy 2 + Alembic) or a TypeScript one (Prisma 7) to a database.
- Choosing connection URLs for dev, test and production; pooling problems on Vercel.

## When not to use

- Dense retrieval at scale or hybrid search: `stack-python:searching-with-qdrant`.
- HTTP resource design: `engineering-craft:designing-apis`.
- Running anything against production: that needs the owner's yes, every time.

## Procedure

1. **Find a free local port.** Run `docker ps --format '{{.Names}} {{.Ports}}'` and `lsof -nP -iTCP -sTCP:LISTEN | grep -E ':54[0-9]{2}'`. On the owner's machine 5432, 5433 and 5434 were taken as of 2026-11-05; pick the next free one (for example 5435) and leave other projects' containers alone.
   **Done when:** the port is confirmed free by both commands.
2. **Start a per-project container bound to localhost.**
   ```bash
   docker run -d --name <project>_db -p 127.0.0.1:5435:5432 \
     -e POSTGRES_USER=app -e POSTGRES_PASSWORD="$(openssl rand -hex 16)" -e POSTGRES_DB=app \
     -v <project>_pgdata:/var/lib/postgresql/data postgres:17
   ```
   Put the generated password in the git-ignored `.env`, never in the command log you paste back. Use a separate `<project>_test` database for tests. Where Docker is unavailable, install Postgres locally on the same unique port.
   **Done when:** `pg_isready -h 127.0.0.1 -p 5435` succeeds and `.env.example` lists the variable names without values.
3. **Name the connection variables so tests cannot reach production.** Local: `DATABASE_URL`, tests: `TEST_DATABASE_URL`. Production only: `NEON_DATABASE_URL` (pooled) and `NEON_DATABASE_URL_UNPOOLED` (direct, for migrations and long transactions). The app config refuses to start tests if the test URL does not contain the test database name or points at a non-local host.
   **Done when:** a unit test proves the settings loader rejects a non-local test URL.
4. **Model the schema** with the habits below, then generate a migration, read it, and apply it locally.
   **Done when:** `alembic upgrade head` (or `prisma migrate dev`) runs on an empty database and the model tests pass.
5. **Seed idempotently,** without the owner's personal data: upserts keyed on natural keys, fictional fixtures.
   **Done when:** running the seed twice produces identical row counts.
6. **Production changes** (migrate against Neon, create a branch, provision a resource): state the cost (the free tier first) and the rollback, take a backup or Neon branch, then ask the owner. Never `db push` or autogenerate-and-apply against a shared or production database.
   **Done when:** the owner said yes in this session and the migration ran from a migration command.

## Schema habits

- Primary keys: `uuid` (v7 where available) or `bigint identity`; one style per project.
- Every table: `created_at timestamptz not null default now()`, `updated_at` maintained by the app or a trigger.
- Money as `numeric(12,2)` or integer minor units; never float. Times as `timestamptz`, stored in UTC.
- Enums as `text` plus a `CHECK` constraint (or a lookup table) rather than native enums, which are painful to alter.
- Foreign keys always; index every foreign key you join or delete by. Use partial unique indexes for soft-delete uniqueness.
- Constraints in the database, not only in code: `NOT NULL`, `UNIQUE`, `CHECK`.
- JSONB for genuinely schemaless blobs (model messages, provider payloads); promote fields you filter on to columns. Validate JSONB with Pydantic at the edge.
- Multi-tenant: `tenant_id` on every row, composite indexes starting with it; consider row-level security if several services share the database.
- Audit trail for people-affecting decisions (who changed what, when).
- Store LLM and agent artifacts (prompts, outputs, usage) with a model name and a version column so results can be explained later.

## Expand and contract

Changes that touch running code ship in steps, each its own migration and deploy:
1. **Expand:** add the nullable column or new table; write to both.
2. **Backfill** in batches, idempotent and resumable (a Temporal workflow for big ones).
3. **Switch reads,** then **stop writing** the old shape.
4. **Contract:** drop the old column in a later release.
Never rename or drop in the same release that stops using it. Create indexes with `CREATE INDEX CONCURRENTLY` (in Alembic, `postgresql_concurrently=True` inside an autocommit block).

## SQLAlchemy 2 + Alembic

```python
# db.py
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

engine = create_async_engine(settings.database_url, pool_pre_ping=True)   # postgresql+psycopg://...
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

# models.py
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase): ...

class Review(Base):
    __tablename__ = "review"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    doc_id: Mapped[str] = mapped_column(String, index=True)
    decision: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

- `uv add sqlalchemy alembic "psycopg[binary]"`; `uv run alembic init -t async migrations`.
- In `migrations/env.py` set `target_metadata = Base.metadata` and read the URL from settings, not from `alembic.ini`. Migrations use the unpooled URL in production.
- `uv run alembic revision --autogenerate -m "add review"`, then read the diff; autogenerate misses renames, server defaults and check constraints.
- SQLAlchemy 2.1 is current; read https://docs.sqlalchemy.org/en/21/changelog/migration_21.html when upgrading from 2.0. SQLModel users follow the same Alembic flow.
- Tests: transaction-per-test fixture against `TEST_DATABASE_URL`, or a fresh schema created by `alembic upgrade head` once per session.

## Prisma 7 (TypeScript projects)

Client generated into the source tree (for example `src/generated/prisma`, git-ignored); import from the generated path; always use the `PrismaPg` driver adapter; run `npx prisma generate` after schema changes; `npx prisma migrate dev` locally, `npx prisma migrate deploy` in production, never `db push` on shared databases. Read the project CLAUDE.md and https://www.prisma.io/docs before changing config, since v7 changed config file and client generation.

## Neon and serverless pooling

- Vercel Marketplace Neon gives a pooled URL (PgBouncer, transaction mode) and an unpooled one. Serverless functions use the pooled URL; migrations, `LISTEN/NOTIFY`, advisory locks and long transactions use the unpooled one.
- Transaction pooling breaks session state: no session-level prepared statements (psycopg: `prepare_threshold=None`; asyncpg: `statement_cache_size=0`), no `SET` outside a transaction.
- Keep engine pools small (`pool_size=1..2`, `max_overflow=0`) per serverless instance, or use `NullPool` with the pooled URL. Long-lived workers on the VPS use a normal pool against the unpooled URL.
- Cold Neon compute can add latency to the first query; set connect timeouts and retry the first connection once.
- Branches are cheap: use a Neon branch for risky migrations, with the owner's yes.

## pgvector (when it is the right call)

For small corpora with relational joins: `CREATE EXTENSION vector;` in a migration, a `vector(1024)` column, an HNSW index (`USING hnsw (embedding vector_cosine_ops)`), and `pgvector` for SQLAlchemy types. Apply the decision rule in `stack-python:searching-with-qdrant` before adding a second datastore. Confirm the extension is available on the chosen Neon plan.

## Rationalizations

| Excuse | Do instead |
|---|---|
| "`db push` is faster" | Local scratch only. Shared and production databases get migrations. |
| "Same `DATABASE_URL` everywhere is simpler" | Distinct production names are the guard against a test wiping prod. |
| "Seed with my own account" | Fictional data only; the owner's personal data stays out of git. |
| "Drop the old column now" | Expand, switch, contract over separate releases. |

## Verification

- [ ] Port checked against `docker ps` and `lsof`; container bound to 127.0.0.1.
- [ ] `.env` untouched if it existed; `.env.example` has names only.
- [ ] Migration reviewed by eye, applied on an empty database, and reversible or documented.
- [ ] Seed is idempotent and free of personal data.
- [ ] Production variable names differ from local and test ones.
- [ ] Nothing ran against production without a yes.

## Versions

- sqlalchemy 2.1.8 (verified 2026-11-05, https://pypi.org/project/SQLAlchemy/)
- alembic 1.20.1 (verified 2026-11-05, https://pypi.org/project/alembic/)
- psycopg 3.3.8 (verified 2026-11-05, https://pypi.org/project/psycopg/)
- asyncpg 0.32.0 (verified 2026-11-05, https://pypi.org/project/asyncpg/)
- pgvector (extension) v0.8.7 (verified 2026-11-05, https://github.com/pgvector/pgvector)
- Prisma 7 is used in TypeScript projects; version is tracked in those repos, not here.
