# Patterns in Python and Postgres

Short, working shapes for the mechanisms the decision table names. Check the current docs of the libraries you use before copying API calls.

## Idempotency key with a unique constraint

```sql
create table idempotency_keys (
  key text primary key,
  request_hash text not null,
  response jsonb,
  created_at timestamptz not null default now()
);
```

```python
async def handle(conn, key: str, payload: dict) -> dict:
    h = hash_payload(payload)
    async with conn.transaction():
        row = await conn.fetchrow(
            "insert into idempotency_keys(key, request_hash) values($1,$2) "
            "on conflict (key) do nothing returning key", key, h)
        if row is None:
            existing = await conn.fetchrow("select request_hash, response from idempotency_keys where key=$1", key)
            if existing["request_hash"] != h:
                raise Conflict("key reused with a different payload")  # 409 or 422
            return existing["response"]  # may be null while the first call is in flight: return 409 and let the client retry
        result = await do_effect(conn, payload)  # same transaction
        await conn.execute("update idempotency_keys set response=$2 where key=$1", key, result)
        return result
```

Key rules: the client generates the key; the server rejects the same key with a different payload; keep keys for longer than the longest retry window; the effect and the key commit together.

## Transactional outbox

Write the business row and an `outbox(id, topic, payload, created_at, sent_at)` row in one transaction. A relay loop selects unsent rows `for update skip locked`, publishes, then sets `sent_at`. The relay may publish twice, so consumers dedupe on `id`. In Temporal, an activity that calls the publisher with the outbox id as its idempotency key does the same job.

## Inbox / dedupe

```sql
create table inbox (message_id text primary key, processed_at timestamptz default now());
```

Insert into `inbox` and apply the effect in one transaction. A unique violation means already processed: ack and skip.

## Retry with exponential backoff and full jitter

```python
import random

def backoff(attempt: int, base: float = 0.2, cap: float = 20.0) -> float:
    return random.uniform(0, min(cap, base * 2 ** attempt))
```

Cap attempts. Retry on timeouts, connection errors, 429 and 5xx only. Honour `Retry-After`. Keep a retry budget: for each service, allow retries up to a fixed share (for example 10 percent) of recent requests, and stop retrying when it is spent. Libraries such as `tenacity` implement this; read their current docs.

## Deadline propagation

Edge computes `deadline = now + budget`. Send `X-Request-Deadline` (epoch ms) or remaining milliseconds downstream. Each hop sets its own timeout to `min(own_timeout, remaining - safety_margin)` and refuses to start if remaining time is below what the work needs.

## Lease with fencing token

```sql
update leases set holder=$1, token=token+1, expires_at=now()+interval '30 seconds'
where name=$2 and (expires_at < now() or holder=$1) returning token;
```

The worker passes `token` with every write. The resource (a table with a `last_token` column, or the storage API) rejects a write whose token is below the highest seen. Where possible skip leases entirely: use `insert ... on conflict do nothing` or `select ... for update skip locked`.

## Single-flight for cache misses

Keep a map of key to in-flight future. The first caller creates the future and computes; concurrent callers await the same future; remove it in `finally`. Add jitter to TTLs (for example plus or minus 10 percent) and serve stale data while one refresh runs.

## Circuit breaker states

Closed (count failures in a rolling window) to open when the failure or slow-call rate passes a threshold, calls fail fast; after a cool-off go half-open and let a few probes through; close on success, reopen on failure. Emit a metric on every transition.

## Saga on Temporal

One workflow per business transaction. Each step is an activity with its own retry policy; push each compensation onto a list as its step succeeds; on a non-retryable failure run the compensations in reverse. Compensations are activities and are idempotent. Details: `stack-python:orchestrating-with-temporal`.
