# Server (FastAPI)

Docs: https://docs.expo.dev/push-notifications/sending-notifications/ . Official SDKs exist for Node (`expo-server-sdk`) and community ones for Python (`exponent-server-sdk`); calling the HTTP API with `httpx` is small enough to own.

## Sender

```python
import asyncio, os, random
import httpx
from pydantic import BaseModel

EXPO_SEND = "https://exp.host/--/api/v2/push/send"
EXPO_RECEIPTS = "https://exp.host/--/api/v2/push/getReceipts"
HEADERS = {"Accept": "application/json", "Content-Type": "application/json",
           "Authorization": f"Bearer {os.environ['EXPO_ACCESS_TOKEN']}"}

class Push(BaseModel):
    to: str
    title: str
    body: str
    data: dict = {}
    channelId: str = "default"
    ttl: int = 3600
    priority: str = "default"

async def post_with_retry(client: httpx.AsyncClient, url: str, payload, tries: int = 5):
    for i in range(tries):
        r = await client.post(url, json=payload, headers=HEADERS)
        if r.status_code == 429 or r.status_code >= 500:
            await asyncio.sleep(min(30, 2 ** i) + random.random())
            continue
        r.raise_for_status()        # malformed 4xx is a bug, do not retry
        return r.json()
    raise RuntimeError("expo push unavailable")

async def send_batch(client, messages: list[Push]) -> list[dict]:
    tickets = []
    for i in range(0, len(messages), 100):
        chunk = [m.model_dump() for m in messages[i:i + 100]]
        tickets += (await post_with_retry(client, EXPO_SEND, chunk))["data"]
    return tickets          # same order as messages; store ticket id with the message id
```

## Receipts job

Run every 15 to 30 minutes (a scheduled job or a Temporal schedule). Select tickets older than 15 minutes and younger than 24 hours that have no receipt yet, call `getReceipts` with up to 1000 ids, and for each receipt:

- `status == "ok"`: mark delivered-to-provider.
- `details.error == "DeviceNotRegistered"`: delete the device token.
- `MessageRateExceeded`: lower the send rate; requeue.
- `InvalidCredentials` or `MismatchSenderId`: alert the owner; credentials need fixing.

Ids missing from the response are not an error; ask again until 24 hours pass.

## Tables

`push_devices(id, user_id, token unique, platform, tz, created_at, last_seen_at, disabled_at)`, `push_prefs(user_id, type, enabled, quiet_start, quiet_end)`, `push_tickets(id, device_id, message_id, ticket_id, status, receipt_status, sent_at)`.

## Quiet hours

Convert "now" to the user's timezone; if the type is not urgent and now falls inside the quiet window, store the message with `send_after` at the window end. A worker sends due messages. Urgent types (security, safety) ignore quiet hours and are listed explicitly.

## Direct FCM and APNs

- Android: FCM HTTP v1 with a service account and OAuth2 access tokens; device tokens come from `getDevicePushTokenAsync` instead of the Expo token.
- iOS: APNs token-based auth (`.p8` key) with HTTP/2; topic is the bundle id.
- You then own batching, retries, token invalidation (FCM `UNREGISTERED`, APNs 410) and per-platform payloads. Read the providers' current docs before writing this.

## Tests

Use `httpx.MockTransport` to fake Expo: assert batching at 100, retry on 429, no retry on 400, token deletion on `DeviceNotRegistered`. Never hit the real endpoint from tests.
