# Webhooks: signing and verification

## Sender

- Body is JSON with `id` (unique event id), `type`, `created_at`, `data`.
- Header `X-Signature: t=<unix seconds>,v1=<hex hmac>` where `hmac = HMAC_SHA256(secret, f"{t}.{raw_body}")`.
- One secret per endpoint; allow two active secrets during rotation.
- Retry on non-2xx and timeouts with exponential backoff and jitter over hours; stop after a cap; surface failed deliveries in a dashboard and allow manual replay.
- Time out the receiver call at a few seconds; never wait on the receiver's processing.

## Receiver (FastAPI)

```python
import hashlib, hmac, time
from fastapi import APIRouter, Header, HTTPException, Request

router = APIRouter()
TOLERANCE_S = 300

@router.post("/webhooks/provider")
async def receive(request: Request, x_signature: str = Header(...)):
    raw = await request.body()                       # raw bytes, before any JSON parsing
    parts = dict(p.split("=", 1) for p in x_signature.split(","))
    ts, sig = int(parts["t"]), parts["v1"]
    if abs(time.time() - ts) > TOLERANCE_S:
        raise HTTPException(400, "timestamp outside tolerance")
    expected = hmac.new(SECRET.encode(), f"{ts}.".encode() + raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):       # constant-time compare
        raise HTTPException(400, "bad signature")
    event = parse(raw)
    if not await first_time(event["id"]):            # unique insert into an inbox table
        return {"status": "duplicate"}
    await enqueue(event)                             # process asynchronously
    return {"status": "accepted"}
```

Providers differ in header format and scheme. Follow the provider's own documentation and its official verification helper where one exists (Resend, payment providers and LiveKit each document theirs); the shape above is the generic pattern.

## Checks

- Signature verified over the exact bytes received. A re-serialised body will not match.
- Constant-time comparison.
- Timestamp tolerance to stop replays of captured requests.
- Event id deduped, because delivery is at-least-once.
- Handler returns 2xx fast; slow work goes to a queue or workflow.
- Secrets come from the environment and are never logged.

## Route wrapper and machine endpoints

One wrapper does the common work: catches errors into the JSON error shape (never leaking internals) and runs an Origin or Referer check on every non-GET request that carries a cookie. Machine callers (worker, webhook, cron) authenticate with a bearer secret or a provider signature and opt out of the Origin check explicitly. Read the raw body with `req.text()` before verifying a signature. Record processed event ids in a table, and keep a cron sweeper as the backstop for events that never arrive.
