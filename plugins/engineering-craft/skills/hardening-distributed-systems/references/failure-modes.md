# Failure modes

Columns: failure, what you see, mitigation, how to test it. Find the row, apply the mitigation, write the test.

| Failure | Symptom | Mitigation | How to test |
|---|---|---|---|
| Duplicate delivery (webhook retry, queue redelivery, user double-click) | Two emails, two charges, two rows | Idempotency key stored with a unique constraint; effect and key written in one transaction; return the stored result on replay | Send the same request twice concurrently and sequentially; assert one effect and identical responses |
| Timeout with unknown outcome | Caller retries; effect may have happened | Retry only with the same idempotency key; for third parties without keys, look up by your own reference before retrying | Fake dependency that commits then drops the response; assert one effect after the retry |
| Dual write (DB then queue) | Row exists, event never sent, or the reverse | Transactional outbox: write row and outbox row in one transaction; a relay publishes and marks sent | Kill the process between steps; restart; assert exactly one event published eventually |
| Duplicate consumption | Handler runs twice for one message | Inbox table keyed by message id; insert and process in the same transaction | Redeliver the same message id; assert one effect |
| Partial multi-step failure | Money taken, access not granted | Saga with a compensation per step, run as a Temporal workflow; compensations are idempotent | Fail each step in turn in a workflow test; assert the compensations ran and state is consistent |
| Retry storm | Dependency recovers, then collapses again | Exponential backoff with full jitter, capped attempts, retry budget as a share of traffic, retry at one layer only | Simulate an outage with N clients; assert retry volume stays under the budget and spreads over time |
| Retry amplification across layers | 3 layers x 3 retries = 27 calls | Retry only at the layer closest to the failure; pass a no-retry header or flag downward | Count calls to the leaf under failure; assert the product matches the design |
| Missing timeout | Threads or workers pile up behind one hung call | Timeout on every outbound call (connect and read); total deadline from the edge, passed down and checked before starting work | Dependency that never responds; assert the caller returns within the deadline |
| Deadline not propagated | Callee keeps working after the caller gave up | Pass remaining time as a header; callee aborts when exceeded; cancel in-flight work on client disconnect | Cancel the request mid-flight; assert the downstream work stops |
| Dependency down for minutes | Latency and errors cascade to unrelated routes | Circuit breaker (open on error rate or slow-call rate, half-open probes), fallback or fast failure | Force failures; assert the breaker opens, calls fail fast, then closes after recovery |
| One tenant or feature starves the rest | Shared pool exhausted by one workload | Bulkheads: separate pools, concurrency limits or queues per dependency and per tenant class | Saturate one pool; assert the others still serve within target |
| Producer outpaces consumer | Queue grows, memory or disk fills, latency climbs | Bounded queue; at the limit reject (429/503 with Retry-After) or shed low-priority work; autoscale on depth and age | Push beyond the limit; assert bounded memory and explicit rejection |
| Poison message | Same message fails forever, blocks the partition | Max attempts then dead-letter queue; alert on DLQ depth; store the error; tool to replay after a fix | Enqueue an unparseable message; assert it lands in the DLQ and the queue keeps flowing |
| Out-of-order delivery | Older update overwrites newer | Version or sequence number per entity; apply only if newer; or partition by entity key for ordering | Deliver two updates reversed; assert final state is the newer |
| Clock skew | "Latest" is wrong; token or lease expires early | Never order by wall clock across machines; use versions or database sequences; allow leeway on expiry checks | Inject skewed clocks into the fake; assert behaviour is unchanged |
| Lock holder pauses (GC, network, deploy) | Two workers believe they own the resource | Lease with expiry plus a monotonically increasing fencing token; the resource rejects stale tokens. Prefer a unique constraint or `SELECT ... FOR UPDATE SKIP LOCKED` | Pause holder 1 past the lease; holder 2 acquires; resume 1; assert its write is rejected |
| Cache stampede | Hot key expires, database spikes | Single-flight per key, jittered TTLs, stale-while-revalidate, early refresh | N concurrent misses; assert one backend call |
| Thundering herd on restart or recovery | All clients reconnect or cron fires at once | Jitter on reconnect and schedules; staggered startup; admission control | Restart with many clients; assert load ramps rather than spikes |
| Stale read after write | User saves and sees old data | Read your writes: route to primary, or return the written object, or pass a version and wait for it | Write then read through the replica path; assert the new value |
| Cache and database disagree | Wrong value served for a long time | Invalidate on write inside the transaction boundary (or via outbox), short TTL as the backstop | Update the row; assert the next read reflects it within the TTL |
| Schema change breaks the other side | Deploy order causes errors | Expand then migrate then contract; readers ignore unknown fields; writers keep sending the old field until all readers are updated; version events | Run old consumer against new producer output and new consumer against old output |
| Non-idempotent compensation | Rollback runs twice and over-refunds | Make each compensation keyed and idempotent | Run the compensation twice; assert one effect |
| Lost message on consumer crash | Message acked before processing | Ack after the effect is committed; combine with the inbox for dedupe | Crash after receive, before commit; assert redelivery and a single effect |
| Webhook sender replays or forges | Attacker or provider retries trigger actions | Verify the signature over the raw body, check timestamp tolerance, dedupe on event id | Wrong signature, old timestamp, replayed id; assert all rejected or no-ops |
| Unbounded fan-out | One event creates millions of tasks | Batch, cap fan-out, page through recipients with a cursor in a workflow | Large recipient set; assert bounded concurrency |
| Long transaction or lock wait | Deploys and queries block each other | Short transactions, lock timeouts, migrations that avoid table rewrites | Run migration against a busy table in staging; check lock waits |
| Retry after non-retryable error | Retries on 400 or validation failure | Classify errors: retry only on timeouts, 429, 5xx and connection errors; honour Retry-After | Return 400; assert no retry |
| Silent backlog | Nothing alerts while work piles up | Alert on queue age and DLQ depth, not only on errors | Stop the consumer; assert the alert fires |

## Retry policy on a non-idempotent call

Platform retry policies (workflow actions, HTTP clients, queue redelivery) apply to every call unless turned off. Set the policy to none on create, send, forward and respond actions, or add a dedupe key the receiver honours. A lost response after a successful send otherwise delivers twice.

## Work started in a request and not awaited

Work started in a request handler without being awaited is dropped when the serverless function freezes. Enqueue it to a worker. Cache negative results (a geocode miss) so a missing value does not re-call a rate-limited provider on every request, and ship static data (city centroids) for the instant path.
