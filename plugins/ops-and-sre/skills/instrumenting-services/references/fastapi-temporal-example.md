# FastAPI + Temporal worker with shared tracing

Untested sketch. Check names against the installed versions (Versions block in SKILL.md) and run the "break it on purpose" step before trusting it.

Open question to settle first: `logfire.configure()` installs its own global tracer provider, while Temporal's `OpenTelemetryPlugin` wants the replay-safe provider from `create_tracer_provider()` set as the global before the client connects. OpenTelemetry ignores a second `set_tracer_provider`. Two workable orders: (a) in the worker process, set Temporal's provider with an OTLP exporter pointed at Logfire's OTLP endpoint and skip `logfire.configure()` there; (b) in the API process, which only starts workflows, use `logfire.configure()` and the plugin with `add_temporal_spans=False` (context propagation only). Pick (a) or (b), then confirm one trace spans both processes.

```python
# telemetry.py - imported first by the API and by the worker entry point
import logfire
from temporalio.contrib.opentelemetry import OpenTelemetryPlugin


def setup_api(service_name: str):
    # Safe without a token: nothing is sent, the app still starts.
    logfire.configure(service_name=service_name, send_to_logfire="if-token-present")
    logfire.instrument_pydantic_ai()
    logfire.instrument_httpx()


def api_temporal_plugins():
    return [OpenTelemetryPlugin()]  # propagates context only
```

```python
# api.py
from fastapi import FastAPI, Request
from opentelemetry import trace
import logfire
from telemetry import setup_api

setup_api("interview-api")
app = FastAPI()
logfire.instrument_fastapi(app)


@app.middleware("http")
async def trace_header(request: Request, call_next):
    response = await call_next(request)
    ctx = trace.get_current_span().get_span_context()
    if ctx.is_valid:
        response.headers["x-trace-id"] = format(ctx.trace_id, "032x")
    return response
```

Worker (order a): follow the Temporal observability page: `create_tracer_provider()`, add a `BatchSpanProcessor(OTLPSpanExporter(...))` aimed at the backend's OTLP endpoint with the auth header from the environment, `trace.set_tracer_provider(provider)`, then `Client.connect(addr, plugins=[OpenTelemetryPlugin(add_temporal_spans=True)])` and `Worker(client, ...)`.

Cost table sketch:

```python
PRICE_PER_MTOK: dict[str, tuple[float, float]] = {
    # "model-id": (input_usd, output_usd)   # fill from the provider pricing page; note the date
}


def cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    pin, pout = PRICE_PER_MTOK[model]
    return (input_tokens * pin + output_tokens * pout) / 1_000_000
```
