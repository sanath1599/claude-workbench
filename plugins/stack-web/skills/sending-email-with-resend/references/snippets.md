# Resend snippets

Check https://resend.com/docs/send-with-nodejs and https://resend.com/docs/send-with-python for the installed SDK version before pasting.

## Node transport with injection

```ts
import { Resend } from "resend";

export interface Outgoing { to: string; subject: string; html: string; text: string; idempotencyKey?: string }
export type Transport = (m: Outgoing) => Promise<{ id: string | null; error: string | null }>;

let override: Transport | null = null;
export const setEmailTransport = (t: Transport | null) => { override = t; };

const live: Transport = async (m) => {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send(
    { from: process.env.EMAIL_FROM!, replyTo: process.env.EMAIL_REPLY_TO, to: [m.to], subject: m.subject, html: m.html, text: m.text },
    m.idempotencyKey ? { idempotencyKey: m.idempotencyKey } : undefined,
  );
  return { id: data?.id ?? null, error: error ? `${error.name}: ${error.message}` : null };
};

export async function sendEmail(m: Outgoing) {
  if (process.env.EMAIL_ENABLED !== "true" && !override) return { id: null, error: null, skipped: true as const };
  return (override ?? live)(m);
}
```

## Welcome email on signup with a mocked test

```ts
await sendEmail({ to: user.email, subject: "Welcome", html, text, idempotencyKey: `welcome/${user.id}` });

// test
const calls: Outgoing[] = [];
setEmailTransport(async (m) => (calls.push(m), { id: "test", error: null }));
await signUp({ email: "delivered@resend.dev" });
expect(calls).toHaveLength(1);
expect(calls[0].idempotencyKey).toBe(`welcome/${userId}`);
```

## Python (FastAPI)

```python
import os, resend

resend.api_key = os.environ["RESEND_API_KEY"]

async def send_welcome(user_id: str, to: str, html: str) -> str | None:
    params: resend.Emails.SendParams = {"from": os.environ["EMAIL_FROM"], "to": [to], "subject": "Welcome", "html": html}
    options: resend.Emails.SendOptions = {"idempotency_key": f"welcome/{user_id}"}
    try:
        r = await resend.Emails.send_async(params, options)  # needs the async extra (httpx)
        return r["id"]
    except resend.exceptions.ResendError:
        return None  # record the failure; do not break signup
```

Tests patch `send_welcome` or inject a fake sender; never call the SDK.

## Webhook (raw body)

```ts
// Hono/Express/Next route: read the raw text first.
const payload = await req.text();
const event = resend.webhooks.verify({
  payload,
  headers: { id: req.headers.get("svix-id")!, timestamp: req.headers.get("svix-timestamp")!, signature: req.headers.get("svix-signature")! },
  webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
}); // throws on a bad signature: return 400
```

Confirm the exact `verify` signature in the SDK docs; the `svix` package's `new Webhook(secret).verify(payload, headers)` is the stable fallback. Python: `from svix.webhooks import Webhook; Webhook(secret).verify(raw_body, headers)`.
