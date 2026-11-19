---
name: building-pydantic-ai-agents
description: Use when writing or changing a Python agent, tool-calling loop, structured-output call, multi-agent flow, human-approval tool or agent eval with Pydantic AI, or when an agent must survive restarts. Not for the Temporal workflow side, which is stack-python:orchestrating-with-temporal, or raw provider calls, which is stack-python:calling-llms-reliably.
---

# Building Pydantic AI agents

Agents are Python + Pydantic AI (v2). Pick the smallest pattern that fits, validate everything the model returns, and put durability in Temporal instead of inventing a loop.

## When to use

- A new agent, tool, structured-output call or multi-step LLM flow in Python.
- An agent that must wait for a human, survive a crash, or run for minutes to days.
- A tutorial or old snippet uses `result.data`, `TemporalAgent`, `builtin_tools` or the bare `openai:` prefix (v1 vocabulary; see `references/patterns.md`, section "v1 to v2").

## When not to use

- Temporal workflow design on its own: `stack-python:orchestrating-with-temporal`.
- Provider routing, 402s, timeouts and the mock provider for plain LLM calls: `stack-python:calling-llms-reliably`.
- Product-level LLM feature design: `engineering-craft:building-llm-features`.
- Voice sessions: `stack-python:building-voice-agents`.

## Procedure

1. **Read the current docs for the thing you are about to use.** Pydantic AI ships a release every few days. Index: `https://pydantic.dev/docs/ai/llms.txt`; every page has an `/index.md` twin. Check the installed version with `uv pip show pydantic-ai-slim`.
   **Done when:** you can name the doc page behind each API you will call.
2. **Choose the pattern** with the table below. Prefer the first row that fits. Open `references/patterns.md` for the example.
   **Done when:** you have written down the situation and the pattern next to it.
3. **Pick output mode for the provider.** Ollama Cloud does not enforce JSON Schema, so use the default `ToolOutput` or `PromptedOutput` plus Pydantic validation and an output validator. `NativeOutput` raises `UserError` on Ollama Cloud. On Anthropic and OpenAI, `NativeOutput` is fine where the docs list it. Embed the schema in instructions for weak models anyway (`stack-python:calling-llms-reliably`).
   **Done when:** a test with the mock model proves a malformed answer triggers a retry, not a crash.
4. **Define deps and tools.** Put clients, settings and the DB session in a dataclass `deps`; tools take `RunContext[Deps]`. Write `Field(description=...)` for the model, not for humans. Tool bodies treat model arguments as untrusted input.
   **Done when:** `agent.override(model=TestModel(), deps=fake)` runs the agent in a unit test with no network.
5. **Bound the run.** Pass `UsageLimits(request_limit=..., tool_calls_limit=...)` on every run that can loop. Share `usage=ctx.usage` into delegated agents. Set a per-call timeout (3 minutes is the owner default; shorter for live voice).
   **Done when:** a test forces the limit and sees `UsageLimitExceeded`.
6. **Decide on durability.** If any step can take more than a minute, wait on a human, or must not repeat side effects after a crash, run the agent inside a Temporal workflow with `TemporalDurability` and stable `name=`. Otherwise run it in the request.
   **Done when:** the agent is either explicitly "in-request only" in the design note, or registered with a worker and a replay test exists (`stack-python:orchestrating-with-temporal`).
7. **Observe and evaluate.** `logfire.configure(); logfire.instrument_pydantic_ai()` in dev (any OTel backend works). Add a `pydantic-evals` `Dataset` for the behaviours that matter, run against the mock or an opt-in real provider guarded by an env var.
   **Done when:** `uv run pytest` passes with no real provider and the eval dataset runs on demand.

## Pattern picker

| Situation | Pattern |
|---|---|
| Need typed data back from a model | `output_type=Model` (ToolOutput default) |
| Answer is one of several shapes | union output, or discriminated union inside one model |
| Weak model or Ollama Cloud, JSON keeps breaking | `PromptedOutput` or ToolOutput + `output_validator` raising `ModelRetry` |
| Tool needs a DB, HTTP client or settings | `deps_type` + `RunContext` |
| Many related tools, reuse across agents | `FunctionToolset`, `.prefixed()` |
| A rule the schema cannot express | `@agent.output_validator` + `ModelRetry` |
| One task per agent, app decides the order | programmatic hand-off (pass `message_history`) |
| Model decides which specialist to ask | agent delegation through a tool, share `usage` |
| Real branching, loops, parallel joins in one process | `pydantic-graph` |
| Branching or loops that must survive restarts | Temporal workflow, not graph persistence |
| Tool must be approved by a human | `requires_approval=True` or `ApprovalRequired`. Let the person approve with one tap: a reply "yes"/👍 to the request (read the token from the quoted request) or a bare "approve" when exactly one is pending; never make them type a code, and never treat a bare "yes" outside a reply as approval |
| Approval can take hours or days | `TemporalDurability` + `HandleDeferredToolCalls` waiting on a signal/update |
| Work finishes elsewhere, result arrives later | `CallDeferred` + `deferred_tool_results` |
| Multi-turn chat across requests | store `ModelMessagesTypeAdapter` JSON in Postgres JSONB. If conversations expire or messages are sent outside a turn (reminders, notifications), prepend a capped recap of messages the history lacks (high-water mark on message id), and pass a quoted reply's text into the turn |
| Chat UI needs partial output | `run_stream`, `stream_output()` |
| Agent must chase people (unanswered questions, promised deadlines) | tools that record each item with a `next_check_at`; a scheduled job acts only in their working hours, closes items whose task is done, asks a model whether replies since settle it (an unreadable verdict waits, never nags), sends one combined nudge, and stops after two to escalate to the owner |
| Cheap model for most turns, a strong one when needed | route per turn: code rules for the obvious, then a cheap classifier (unreadable or down = strong); `agent.run(..., model=strong)` overrides per run; give the cheap model a hand-up tool that raises an exception you catch to rerun on the strong model, and retry its failures there. Fall back the other way too: Claude intermittently refuses with `ContentFilterError` (an `UnexpectedModelBehavior`), so answer on the cheap model rather than drop the turn; on the last attempt reply with an apology, never silence. Mixed-provider history replays, but drop other models' `ThinkingPart`s before sending it to Claude (they go as plain text). Audit the route |
| A reply is only the run's last text | `result.output` is the final text only; Claude often writes the real answer beside its tool calls and ends with a one-liner. Send an earlier long text from `result.new_messages()` first |
| Cost or loop runaway | `UsageLimits` |
| Provider outage, 402, rate limit | `ModelFallback` capability (or `FallbackModel`) |
| Use an MCP server's tools | `MCP(...)` capability or `MCPToolset` |
| Expose the agent to other agents | MCP server first; `fasta2a` only if A2A is a real requirement |
| Trace a run | Logfire / OTel |
| Regression-test prompts and behaviour | `pydantic-evals` |

## Provider setup (short)

- Ollama Cloud: `OllamaProvider(base_url="https://ollama.com/v1", api_key=settings.ollama_api_key.get_secret_value())`, model `gpt-oss:120b`. Some models answer HTTP 402 on the free plan; treat 402 as "switch model", not "retry".
- Anthropic: `pydantic-ai-slim[anthropic]`, `anthropic:<model>`, `ANTHROPIC_API_KEY`. Use `sonnet` class models for quality-critical paths; look up the exact id in the Versions block of `stack-python:calling-llms-reliably`.
- OpenAI-compatible gateway: `OpenAIChatModel(name, provider=OpenAICompatibleProvider(...))`. In v2 the bare `openai:` prefix means the Responses API; use `openai-chat:` for Chat Completions.

Full examples and tuning flags are in `references/patterns.md`.

## Rationalizations

| Excuse | Do instead |
|---|---|
| "The session history is enough memory" | Sessions expire and notifications bypass them; a user's "what about this?" then has no referent. Recap what the history lacks. |
| "I will write a retry loop around `agent.run`" | Let Temporal own retries for durable work; set provider `max_retries=0` there. Use `ModelRetry` for output problems only. |
| "NativeOutput is more reliable" | Not on Ollama Cloud. Use ToolOutput/PromptedOutput and validate. |
| "pydantic-graph persistence will do durability" | Persistence modules were removed in v2. Use Temporal. |
| "A resume or JD is just text for the prompt" | It is untrusted. Fence it, never let it choose tools or change instructions. |
| "The agent acts for the owner, so give it the owner's keys and let an approval flip it to full access" | An agent that acts on infrastructure gets its OWN scoped, revocable credentials (a dedicated gateway key, its own SSH key, a fine-grained PAT), never the owner's personal ones. Enforce the approval gate in code, not the prompt: what the owner approves is the exact command or scoped task (hashed), run with no model in between — never a blanket "allow all". Default to a no-mutations setup mode until the owner enables changes, and redact secret shapes from every outbound channel. |

## Verification

- [ ] `uv run pytest` passes with a mock/`TestModel`; no network.
- [ ] Output type validated; a bad answer path is tested.
- [ ] `UsageLimits` and a timeout are set on any looping run.
- [ ] Untrusted text is fenced and cannot trigger side-effecting tools without approval.
- [ ] Durable agents have `name=` set, run only inside a workflow, and have a replay test.
- [ ] Versions block below still matches `uv pip show`.

## References

| File | Load when |
|---|---|
| references/patterns.md | choosing or writing any pattern, provider setup, v1 to v2 migration, or a hand-rolled bounded tool loop on a serverless platform (section 21) |

## Versions

- pydantic-ai 2.66.0 (verified 2026-11-05, https://pypi.org/project/pydantic-ai/)
- pydantic-graph 2.66.0, pydantic-evals 2.66.0 (verified 2026-11-05, PyPI)
- pydantic-ai-harness 0.66.0 (verified 2026-11-05, https://pypi.org/project/pydantic-ai-harness/)
- fasta2a 2.1.1 (verified 2026-11-05, https://pypi.org/project/fasta2a/)
- pydantic 2.14.3 (verified 2026-11-05, https://pypi.org/project/pydantic/)
- logfire 5.4.0 (verified 2026-11-05, https://pypi.org/project/logfire/)
- Docs: https://pydantic.dev/docs/ai/ (verified 2026-11-05)
