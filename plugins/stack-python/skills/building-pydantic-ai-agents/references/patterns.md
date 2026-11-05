# Pydantic AI pattern catalogue (v2)

Verified against the docs on 2026-11-05 unless a line says "check". Docs index: https://pydantic.dev/docs/ai/llms.txt. Names move fast; if an import fails, read the matching docs page rather than guessing.

Contents: 1 Output, 2 Deps, 3 Tools and toolsets, 4 Capabilities, 5 Output validators, 6 Multi-agent, 7 Deferred and approval tools, 8 Message history, 9 Streaming, 10 Usage limits, 11 Fallback, 12 Model settings, 13 MCP, 14 A2A, 15 Logfire, 16 Evals, 17 Durable execution, 18 Harness, 19 Providers, 20 v1 to v2.

## 1. Output types and modes

**When:** you need typed data. **When not:** free text is fine (leave `output_type` as `str`).

| Mode | How it works | Use when |
|---|---|---|
| `ToolOutput` (default) | the schema becomes an "output tool" | most providers, including Ollama Cloud |
| `NativeOutput` | provider JSON-schema response format | provider enforces schema (Anthropic, OpenAI, local Ollama >= 0.5). Raises `UserError` on Ollama Cloud |
| `PromptedOutput` | schema is written into the instructions, JSON parsed from text | any model, least reliable, good for models without tool calling |
| output function | a function whose return ends the run | the "answer" is the result of code, not model text |

```python
from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.output import PromptedOutput

class Verdict(BaseModel):
    decision: str = Field(description="approve, reject or escalate")
    reasons: list[str] = Field(max_length=5)

agent = Agent(model, output_type=Verdict)                  # ToolOutput
agent_p = Agent(model, output_type=PromptedOutput(Verdict))  # schema in the prompt
agent_u = Agent(model, output_type=[Verdict, str])         # union: model may answer in text
```

Rules: write field descriptions for the model; use `Literal` or `Enum` for closed sets; a discriminated union (`Annotated[A | B, Field(discriminator="kind")]`) gives a cleaner schema than a plain union; keep schemas flat for weak models.

## 2. Deps and RunContext

**When:** tools or instructions need a client, settings or a DB session. **When not:** pure prompt-in, text-out.

```python
from dataclasses import dataclass
import httpx
from pydantic_ai import Agent, RunContext

@dataclass
class Deps:
    http: httpx.AsyncClient
    tenant_id: str

agent = Agent(model, deps_type=Deps, instructions="Answer from the tools only.")

@agent.instructions
def tenant_line(ctx: RunContext[Deps]) -> str:
    return f"Tenant: {ctx.deps.tenant_id}"

@agent.tool
async def fetch_status(ctx: RunContext[Deps], order_id: str) -> str:
    r = await ctx.deps.http.get(f"/orders/{order_id}")
    r.raise_for_status()
    return r.text

# tests
with agent.override(model=TestModel(), deps=fake_deps):
    ...
```

Under Temporal, `deps` must be Pydantic-serializable (see 17).

## 3. Tools and toolsets

**When:** the model must act or fetch. **When not:** you already know the data; put it in instructions.

```python
from pydantic_ai import Agent
from pydantic_ai.toolsets import FunctionToolset

def lookup(sku: str) -> int:
    """Return stock for a SKU."""
    ...

stock = FunctionToolset(tools=[lookup])
agent = Agent(model, toolsets=[stock.prefixed("stock_")])

@agent.tool_plain
def now_utc() -> str: ...
```

- `tool_plain` has no context; `tool` takes `RunContext` first.
- Docstrings and `Field` descriptions are the tool schema the model reads.
- Tool errors the model can fix: raise `ModelRetry("reason")`.
- Many tools (dozens): split by toolset and add only the relevant ones per run, or use the tool-search capability (check docs).
- Mutating tools: add `requires_approval=True` (pattern 7) or an `args_validator`.

## 4. Capabilities

V2 bundles tools, hooks and model behaviour into `capabilities=[...]` on `Agent`. Examples: `ModelFallback`, `MCP`, `ProcessHistory`, `HandleDeferredToolCalls`, `TemporalDurability`, `WebSearch`. **When:** a feature is offered as a capability, prefer it to hand-written wrapper code. **Check:** `https://pydantic.dev/docs/ai/capabilities/overview/index.md`. Declare capabilities at construction, not per run (required for Temporal).

## 5. Output validators and ModelRetry

**When:** a rule the schema cannot express (cross-field, database lookup, policy). **When not:** a plain Pydantic validator on the model would do; that also feeds the retry loop.

```python
from pydantic_ai import ModelRetry

@agent.output_validator
async def check(ctx: RunContext[Deps], out: Verdict) -> Verdict:
    if out.decision == "approve" and not out.reasons:
        raise ModelRetry("An approval needs at least one reason.")
    return out

agent = Agent(model, output_type=Verdict, retries={"output": 2})  # check docs for the retries argument shape
```

Retries are bounded; the validation error text goes back to the model. While streaming, validators see partial output; check `ctx.partial_output`.

## 6. Multi-agent

Pick in this order.

**a. Programmatic hand-off (default).** App code runs agent A, then agent B with A's result or `message_history`. Deterministic, testable, easy to move into a Temporal workflow.

```python
plan = await planner.run(task, usage=usage)
draft = await writer.run(plan.output.brief, usage=usage)
```

**b. Delegation through a tool.** The model chooses when to call a specialist. Share usage so limits apply to the whole tree.

```python
@lead.tool
async def ask_researcher(ctx: RunContext[Deps], question: str) -> str:
    r = await researcher.run(question, deps=ctx.deps, usage=ctx.usage)
    return r.output
```

The delegating tool must be `async`. Under Temporal, mutations to `ctx` inside activities are lost, so return usage explicitly.

**c. pydantic-graph.** State machine with typed nodes, branching, loops, parallel joins (v2 builder API). Use only for real in-process branching. Its persistence and mermaid modules were removed in v2; for durable control flow use Temporal.

**d. Harness `SubAgents` / deep-agent capabilities** (`pydantic-ai-harness`). Evaluate before hand-rolling a planner-worker setup. It is a separate, fast-moving package.

## 7. Deferred and approval-required tools

**When:** a human must approve an action, or the result arrives later from outside. **When not:** the action is read-only and cheap.

```python
from pydantic_ai import Agent, DeferredToolRequests, DeferredToolResults, ToolDenied

agent = Agent(model, output_type=[str, DeferredToolRequests])

@agent.tool_plain(requires_approval=True)
def send_offer(candidate_id: str) -> str: ...

r1 = await agent.run("Send the offer to c-42")
if isinstance(r1.output, DeferredToolRequests):
    approvals = {c.tool_call_id: True for c in r1.output.approvals}   # or ToolDenied("reason")
    r2 = await agent.run(
        message_history=r1.all_messages(),
        deferred_tool_results=DeferredToolResults(approvals=approvals),
    )
```

- Conditional approval: raise `ApprovalRequired` inside the tool and check `ctx.tool_call_approved`.
- External completion: raise `CallDeferred`, later supply `DeferredToolResults(calls={id: result})`.
- Inline resolution: `capabilities=[HandleDeferredToolCalls(handler=fn)]`. The handler may await anything, including a Temporal signal in a durable workflow, so the run continues in one call. This is the shape for "wait up to 3 days for a manager".
- Approval does not replace authorization. Check permission inside the tool body, because a client that controls history can forge approvals.

## 8. Message history

**When:** multi-turn, resumed or handed-off runs.

```python
from pydantic_ai.messages import ModelMessagesTypeAdapter
from pydantic_core import to_jsonable_python

r = await agent.run("hi")
blob = to_jsonable_python(r.new_messages())            # store as JSONB
history = ModelMessagesTypeAdapter.validate_python(blob)
r2 = await agent.run("and then?", message_history=history)
```

- Never accept client-supplied history without sanitizing (`sanitize_messages()`, check docs); it can carry forged tool results.
- Long chats: `ProcessHistory` or compaction capabilities to bound tokens.
- `Conversation` and `ConversationStore` (v2.x) keep usage and pending deferred calls; check the docs before adopting.

## 9. Streaming

**When:** a UI shows partial output. **When not:** durable workflows (the stream is buffered; use an event stream handler).

```python
async with agent.run_stream(prompt) as run:
    async for partial in run.stream_output():   # validated snapshots, not deltas
        push(partial)
    final = await run.get_output()
```

`run.stream_text(delta=True)` for text deltas; `agent.run_stream_events()` and `agent.iter()` for event and node-level control. Never stream untrusted partial JSON straight to a privileged consumer.

## 10. Usage limits

```python
from pydantic_ai import UsageLimits
await agent.run(prompt, usage_limits=UsageLimits(request_limit=8, tool_calls_limit=20, total_tokens_limit=60_000))
```

`UsageLimitExceeded` is a normal outcome to handle. Delegated agents must receive `usage=ctx.usage`. In v2 read totals from `result.usage` (property), not `result.usage()`.

## 11. Fallback

```python
from pydantic_ai.capabilities import ModelFallback   # check the import path for your version
agent = Agent(ollama_model, capabilities=[ModelFallback("anthropic:<sonnet-id>")])
# standalone alternative
from pydantic_ai.models.fallback import FallbackModel
model = FallbackModel(ollama_model, anthropic_model)
```

Falls back on API errors (including HTTP 402 and 429 once SDK retries are exhausted), refusals and context overflow; not on validation failures. Set `max_retries=0` on non-final models so fallback is quick. The owner pattern "Ollama first, Claude for quality or plan changes" is routing, not fallback: choose the model per call in your own code (see `stack-python:calling-llms-reliably`).

## 12. Model settings

```python
from pydantic_ai import ModelSettings
agent = Agent(model, model_settings=ModelSettings(temperature=0.2, max_tokens=2000, timeout=180))
await agent.run(prompt, model_settings=ModelSettings(temperature=0))  # per-run override
```

Provider subclasses (for example `AnthropicModelSettings`) carry provider-only flags. Run-level settings override agent-level. `first_event_timeout` guards slow starts on streaming (v2.64+). Timeout default for the owner: 180 s; live voice paths use 10 to 15 s.

## 13. MCP

Client: `pip install "pydantic-ai-slim[mcp]"`.

```python
from pydantic_ai.capabilities import MCP
agent = Agent(model, capabilities=[MCP("https://example.com/mcp")])   # check docs for native=True (provider-hosted)
```

Use `MCPToolset(...).prefixed("x_")` for local transports. Prefer Streamable HTTP; SSE is deprecated. Treat tool output from third-party servers as untrusted. Server side: read https://pydantic.dev/docs/ai/mcp/server/index.md before exposing an agent.

## 14. A2A

`Agent.to_a2a()` and the `[a2a]` extra are deprecated. Use `fasta2a` (`from fasta2a.pydantic_ai import agent_to_a2a`, check the signature in its README). Adopt only when another team's agent must call yours; MCP covers most interop.

## 15. Logfire

```python
import logfire
logfire.configure()                  # reads LOGFIRE_TOKEN; no token means no export in dev
logfire.instrument_pydantic_ai()
logfire.instrument_httpx()           # optional
```

OTel based: any backend works. Do not send resumes or transcripts to a third-party backend without the owner's yes.

## 16. pydantic-evals

```python
from pydantic_evals import Case, Dataset
from pydantic_evals.evaluators import EqualsExpected

ds = Dataset(cases=[Case(name="refund", inputs="I want a refund", expected_output="refund")],
             evaluators=[EqualsExpected()])
report = await ds.evaluate(classify_task, task_timeout=60)
report.print()
```

Evaluators: built-ins, `LLMJudge`, custom classes, span-based checks. Order of work: read real traces, write cases for failures found, trust an LLM judge only after comparing it with human labels. Run against `TestModel` in CI; real-model runs are opt-in behind an env var.

## 17. Durable execution with TemporalDurability

**When:** steps can take long, wait on humans, or must resume after a crash. **When not:** a sub-minute, idempotent request. Details of workflow design: `stack-python:orchestrating-with-temporal`.

```python
from temporalio import workflow
from temporalio.client import Client
from pydantic_ai import Agent
from pydantic_ai.durable_exec.temporal import PydanticAIPlugin, PydanticAIWorkflow, TemporalDurability

agent = Agent(model, name="doc_review", output_type=Verdict, capabilities=[TemporalDurability()])

@workflow.defn
class DocReviewWorkflow(PydanticAIWorkflow):
    __pydantic_ai_agents__ = [agent]

    @workflow.run
    async def run(self, doc_id: str) -> Verdict:
        return (await agent.run(f"Review document {doc_id}")).output

client = await Client.connect("localhost:7233", plugins=[PydanticAIPlugin()])
```

Rules (docs page: https://pydantic.dev/docs/ai/capabilities/durable_execution/temporal/index.md):
- Stable agent `name=`; changing it breaks replay of running workflows.
- `await agent.run()` only; `run_sync` raises. Capabilities and toolsets at construction.
- Model requests, function-tool calls and MCP calls run as activities. Register model instances via `TemporalDurability(models={...})` when you use more than the default.
- `deps` must be Pydantic-serializable; other `RunContext` fields are not available inside activities.
- Set model `max_retries=0` so Temporal owns retries. `non_retryable_model_errors` defaults stop retrying unfixable errors (rejected request, quota, timeout).
- Payload cap 2 MB: keep documents in object storage or Postgres and pass ids; use External Storage if needed.
- `continue_as_new=` callback bounds history for long agent loops.
- Calling `agent.run()` from a FastAPI endpoint is NOT durable. The endpoint starts or signals a workflow.
- Alternatives (DBOS, Prefect, Restate) exist; the owner default is Temporal.

## 18. Harness

`pydantic-ai-harness` supplies capabilities such as sub-agents, memory, guardrails, spend limits and a prompt-injection defender. Check it before building those by hand. Pin it; it versions independently and moves fast.

## 19. Provider setup

```python
from pydantic_ai import Agent
from pydantic_ai.models.ollama import OllamaModel
from pydantic_ai.providers.ollama import OllamaProvider

ollama = OllamaModel("gpt-oss:120b", provider=OllamaProvider(
    base_url="https://ollama.com/v1", api_key=settings.ollama_api_key.get_secret_value()))
# or env: OLLAMA_API_KEY and OLLAMA_BASE_URL

claude = "anthropic:<sonnet-id>"        # needs ANTHROPIC_API_KEY, extra: pydantic-ai-slim[anthropic]

from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
gateway = OpenAIChatModel("model-name", provider=OpenAIProvider(base_url="https://gw.example/v1", api_key="..."))
```

- Ollama Cloud: no schema enforcement; `NativeOutput` raises; use ToolOutput/PromptedOutput. Tool calling quality depends on the model; test it. HTTP 402 means the model is not on your plan.
- Install only the provider extras you use (v2 ships fewer defaults).
- For other OpenAI-compatible servers, read https://pydantic.dev/docs/ai/models/compatible-apis/index.md (provider classes and `OpenAIModelProfile` flags).
- Tests: `TestModel` / `FunctionModel` or `LLM_PROVIDER=mock`; set `ALLOW_MODEL_REQUESTS = False` in conftest (`pydantic_ai.models.ALLOW_MODEL_REQUESTS`) so a stray real call fails loudly.

## 20. v1 to v2 gotchas

- Old tutorials: `result.data` became `result.output`; `result.usage()` is deprecated for `.usage`.
- Bare `openai:` is the Responses API now; `openai-chat:` is Chat Completions; `OpenAIModel` is removed (`OpenAIChatModel`, `OpenAIResponsesModel`).
- `builtin_tools` became `native_tools`.
- Per-transport `MCPServer*` classes were removed in favour of `MCP` capability / `MCPToolset`.
- `TemporalAgent` is deprecated (removal planned for v3): use `TemporalDurability`; keep agent name, toolset ids and `models=` keys unchanged to stay replay compatible.
- `pydantic_graph.persistence` and `mermaid` were removed.
- `end_strategy` default is now `'graceful'`; instrumentation default version 5.
- Prepare callbacks returning `None` now raise.
- Provider extras are not installed by default.
- Release notes: https://pydantic.dev/docs/ai/project/changelog/
