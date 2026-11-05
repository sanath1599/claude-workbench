# Fixed-window rate limit in Postgres

On a stateless host with Postgres already present, no Redis is needed. Key the bucket by `name:sha256(subject)` so raw IPs and emails are never stored. One atomic upsert per check resets the window in the same statement:

```sql
INSERT INTO "RateLimitBucket" ("key","count","expiresAt") VALUES ($1, 1, now() + make_interval(secs => $2))
ON CONFLICT ("key") DO UPDATE SET
  "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
  "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= now() THEN now() + make_interval(secs => $2)
                     ELSE "RateLimitBucket"."expiresAt" END
RETURNING "count", "expiresAt";
```

Reject when `count` exceeds the limit: `429` with `Retry-After` computed from `expiresAt`. Sweep expired rows from an existing cron. Unit-test the window reset with a fake clock.
