# Numbers worth knowing

Use these to sanity-check an estimate. They are orders of magnitude, not benchmarks. Measure your own system before relying on them.

## Latency, rough

| Operation | Order of magnitude |
|---|---|
| Read from memory | 100 ns |
| Postgres primary-key lookup on a warm cache, same region | 0.5 to 2 ms |
| Round trip inside one region | 0.5 to 2 ms |
| Round trip across continents | 100 to 200 ms |
| TLS handshake from cold | 1 to 3 round trips |
| Hosted LLM call, first token | 300 ms to several seconds |
| Hosted LLM call, full structured answer | 2 to 30 s |
| Speech-to-text or text-to-speech chunk | 100 to 500 ms |

## Capacity, rough

| Component | Order of magnitude |
|---|---|
| One small app instance, simple JSON API | 100 to 500 QPS |
| One Postgres instance, indexed reads | thousands of QPS |
| One Postgres instance, durable single-row writes | hundreds to low thousands per second |
| Postgres table that is comfortable without partitioning | up to tens of millions of rows; plan partitioning at hundreds of millions |
| Qdrant on one node | millions of vectors; check memory per vector dimension |

## Conversions

- 1 million requests per day is about 12 QPS average.
- 1 request per second is about 86,400 per day and 2.6 million per month.
- Peak factor: 3 for consumer apps, 5 to 10 for event-driven spikes (campaign emails, webhooks fanning out, cron at the top of the hour).
- Storage multipliers: indexes add 20 to 100 percent, replicas multiply, backups multiply again.

## Prices

The estimator ships placeholder prices. Replace them with the current plan prices for the actual host (read the provider pricing page; do not rely on memory). Free tiers matter for this owner: state when the design stays inside one and which limit would end it.
