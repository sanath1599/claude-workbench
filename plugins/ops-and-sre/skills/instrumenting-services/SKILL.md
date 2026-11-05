---
name: instrumenting-services
description: Use when adding logging, tracing, metrics or LLM cost tracking, wiring Logfire or OpenTelemetry into FastAPI, Pydantic AI or Temporal, tracing a request across web, API and workflow, or asking "why is it slow" with no data. Not for choosing alert thresholds (defining-slos-and-alerts) or live debugging (handling-incidents).
---

# Instrumenting services

Instrument so an on-call person can answer "is it working, where is it slow, what did it cost" from telemetry alone. Prove it by breaking something on purpose and finding it without reading code.

## When to use

- New service, worker or agent with no telemetry.
- A bug that cannot be located from logs.
- Tracking LLM tokens and cost per feature.

## When not to use

- Defining SLOs and alerts: `ops-and-sre:defining-slos-and-alerts`.
- Running the incident: `ops-and-sre:handling-incidents`.

## Procedure

1. **List the questions first** (from `defining-slos-and-alerts` step 1) and mark which signal answers each: a trace span, a metric, or a log line. Instrument only for those. **Done when:** each question maps to a named signal.
2. **Python services: Logfire.** Install `logfire[fastapi]` with `uv add`. In the app entry point call `logfire.configure(service_name="<name>", environment=...)` first, then `logfire.instrument_fastapi(app)`, `logfire.instrument_pydantic_ai()`, and the client instruments you use (`instrument_httpx()`, `instrument_asyncpg()` or `instrument_psycopg()`). Order matters: configure before instrument, once each. Local development uses `logfire auth`; deployed environments use a write token in `LOGFIRE_TOKEN` set in the host's env, never in the repo. If Logfire is unavailable the app must still start: set `send_to_logfire="if-token-present"`. Read the integration page for your version before relying on a flag (links in Versions). **Done when:** a request to the local app shows a trace with the route, a DB span and, for agents, the model call.
3. **Temporal.** Logfire has no Temporal-specific page; use Temporal's own OpenTelemetry support, which exports through Logfire's OpenTelemetry provider. Install `temporalio[opentelemetry]`; create the tracer provider with `temporalio.contrib.opentelemetry.create_tracer_provider()`, add a span processor that exports to the same backend, set it as the global provider, then connect the client with `plugins=[OpenTelemetryPlugin(add_temporal_spans=True)]`. Register it on the client only; workers made from that client inherit it. With Pydantic AI durability, add its plugin as well. Verify the current API at https://docs.temporal.io/develop/python/observability before coding. **Done when:** one workflow run shows `StartWorkflow`, `RunWorkflow` and `RunActivity` spans in one trace, and a model-call span nested under the activity.
4. **Trace ids across web, API and workflow.** The browser or Vercel function calls the API with a `traceparent` header (OpenTelemetry fetch instrumentation, or Vercel's OpenTelemetry setup via `@vercel/otel`); FastAPI instrumentation extracts it (Logfire warns when it sees incoming context; set `distributed_tracing=True` in `logfire.configure` for trusted internal callers only). The API starts the workflow with the plugin, which carries context into the worker. Log the trace id on every structured log line and return it in an `x-trace-id` response header and in error bodies so a user report links to a trace. **Done when:** one user action shows web, API and worker spans under one trace id.
5. **Structured logs, no secrets, no PII.** One JSON object per line with fixed keys: `ts`, `level`, `service`, `env`, `event`, `trace_id`, `request_id`, plus ids (`user_id`, `workflow_id`) not names. Never log tokens, API keys, cookies, `Authorization`, passwords, full emails, phone numbers, resume or transcript text, prompts that contain user data. Keep Logfire scrubbing on and extend it for project fields; redact in `request_attributes_mapper` for endpoint arguments. Treat prompts and model outputs as sensitive: record sizes and hashes by default. **Done when:** a grep of a day of local logs for `Bearer`, `sk-`, `@` and known test PII finds nothing.
6. **LLM cost and tokens per feature.** Wrap each model call so spans carry `feature`, `model`, `input_tokens`, `output_tokens` (Pydantic AI instrumentation already records usage from the response). Compute cost from a small checked-in price table keyed by model id, and emit a metric `llm_cost_usd{feature,model}`. Set a per-feature daily spend alert with the Pydantic AI usage limits or a budget check in code. State prices come from the provider's pricing page on a dated line, not from memory. **Done when:** a query groups last day's tokens and cost by feature.
7. **Web tier on Vercel.** Enable Vercel Observability and Web Analytics or Speed Insights from the project dashboard (needs the owner's yes if it changes plan or cost; say what it costs first), use `@vercel/otel` for server spans in Next.js, and configure log drains only with the owner's yes. Check https://vercel.com/docs/observability for what the current plan includes. **Done when:** the dashboard shows the last deploy's requests and errors.
8. **Break it on purpose.** Add a deliberate failure in a branch (slow query, raised error in an activity, wrong provider key in a dev env), then locate it from telemetry alone: which span, which input class, which deploy. Write the query you used into the runbook. **Done when:** you found it without opening source code.

## Quick reference

| Concern | Rule |
|---|---|
| Init order | `logfire.configure()` then each `instrument_*` once |
| Offline safe | `send_to_logfire="if-token-present"` |
| Secrets | `LOGFIRE_TOKEN` in host env only |
| Trace link | `traceparent` in, `x-trace-id` out |
| Log keys | ts, level, service, env, event, trace_id, request_id |
| LLM | feature, model, tokens, cost on every call |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "Log the whole request for debugging" | Log ids and sizes. Bodies carry PII. |
| "Print the token once to check it" | Never. Check that it is set, not its value. |
| "Trace sampling can wait" | Set head sampling before volume or cost surprises. |
| "Cost is in the provider dashboard" | It cannot split by feature. Record it per call. |

## Verification

- [ ] One request traced end to end with a shared trace id
- [ ] No secrets or PII in logs (grep done)
- [ ] LLM tokens and cost grouped by feature
- [ ] App starts with telemetry disabled
- [ ] Deliberate failure located from telemetry

## Versions

- logfire 5.4.0 (verified 2026-11-05, https://pypi.org/project/logfire/)
- FastAPI integration: https://pydantic.dev/docs/logfire/integrations/web-frameworks/fastapi/ (verified 2026-11-05)
- Pydantic AI integration (`logfire.instrument_pydantic_ai()`): https://pydantic.dev/docs/logfire/integrations/llms/pydanticai/ (verified 2026-11-05)
- Distributed tracing: https://pydantic.dev/docs/logfire/instrument/python/distributed-tracing/ (verified 2026-11-05)
- opentelemetry-sdk 1.45.2 (verified 2026-11-05, https://pypi.org/project/opentelemetry-sdk/)
- temporalio 1.35.0 with `OpenTelemetryPlugin` (verified 2026-11-05, https://docs.temporal.io/develop/python/observability)
- pydantic-ai 2.66.0 (verified 2026-11-05, https://pypi.org/project/pydantic-ai/)
- Logfire page for Temporal: none found 2026-11-05 (404); use the Temporal plugin above.

## References

| File | Load when |
|---|---|
| references/fastapi-temporal-example.md | wiring a FastAPI API plus a Temporal worker in one project |
