---
name: building-voice-agents
description: Use when building or changing a LiveKit Agents voice bot in Python: AgentSession, STT/TTS via LiveKit Inference, turn detection and barge-in, latency, function tools, dispatch, webhooks, mock mode, or the lk agent deploy and secrets steps. Not for the web API that mints tokens, which is stack-python:building-fastapi-services, or plain text LLM calls, which is stack-python:calling-llms-reliably.
---

# Building voice agents

A voice agent is a latency-bound pipeline (speech in, text model, speech out). Keep the logic in plain Python modules that never import LiveKit, wire them to the SDK in one file, and mock everything in tests.

## When to use

- A new LiveKit voice agent worker, or a change to turns, tools, prompts, dispatch or deployment.
- The bot feels slow, interrupts badly, talks over the user, or hangs on a model error.

## When not to use

- Minting room tokens, REST endpoints, auth: `stack-python:building-fastapi-services` (or the app's own stack).
- Non-voice LLM calls: `stack-python:calling-llms-reliably`.

## Procedure

1. **Read the current docs before coding.** LiveKit Agents moves quickly (`https://docs.livekit.io/agents/`). Check the installed version (`uv pip show livekit-agents`) and read the changelog for `AgentSession`, turn handling and inference options. Model ids for Inference STT and TTS change; look them up, do not guess.
   **Done when:** the exact STT, TTS and turn-detector identifiers come from the docs for the installed version.
2. **Structure the project** (uv, Python `>=3.11,<3.14` as the owner's agent uses):
   ```
   agent/
     pyproject.toml  uv.lock  Dockerfile  livekit.toml
     src/agent.py          # SDK wiring only: AgentServer, entrypoint, event hooks
     src/config.py         # env parsing, fails closed, no secrets in repr
     src/controller.py     # interview/conversation state machine, no LiveKit imports
     src/prompts.py        # system prompt builders
     src/app_client.py     # HTTPS client to your backend (bearer secret, constant-time checked server-side)
     tests/                # pure-Python tests; respx for HTTP
   ```
   The agent talks to the product backend over HTTPS only (no database access). Every call is idempotent (idempotency key, segment ids).
   **Done when:** `uv run pytest` passes without importing `livekit` in the logic modules.
3. **Accept only dispatched jobs.** Use explicit dispatch by `agent_name`, with job metadata such as `{"sessionId": "..."}`; reject jobs without valid metadata, and re-validate the session with the backend before saying anything. Local dev uses a different agent name (`<name>-dev`) so it never steals production jobs.
   **Done when:** a test shows a job with missing or malformed metadata is rejected.
4. **Build the session.** STT and TTS through **LiveKit Inference** (`inference.STT("<provider/model>", language=...)`, `inference.TTS("<provider/model>", voice=...)`, for example deepgram for STT and cartesia for TTS), billed through LiveKit Cloud with no vendor keys. LLM through the OpenAI-compatible plugin pointed at Ollama Cloud or Claude. VAD: Silero, prewarmed in `setup_fnc`. Turn detection: the LiveKit turn-detector model.
   ```python
   session = AgentSession(
       stt=inference.STT(cfg.stt_model, language=cfg.stt_language),
       llm=openai.LLM(model=cfg.model, base_url=cfg.base_url, api_key=cfg.key,
                      timeout=httpx.Timeout(connect=5, read=15, write=10, pool=10),
                      max_retries=0),                 # one retry owner, below
       tts=inference.TTS(cfg.tts_model, voice=cfg.voice),
       vad=ctx.proc.userdata["vad"],
       turn_handling={"turn_detection": MultilingualModel(),
                      "endpointing": {"min_delay": 0.5, "max_delay": 4.0},
                      "interruption": {"enabled": True}},
       conn_options=SessionConnectOptions(
           llm_conn_options=APIConnectOptions(max_retry=1, retry_interval=1.0, timeout=5)),
   )
   ```
   This mirrors the owner's working agent on livekit-agents 1.8.x; the `turn_handling` keys are version-specific, so confirm them in the docs.
   **Done when:** a local `dev` run connects and answers one scripted turn.
5. **Budget latency.** Target under about 1 second from end of speech to first audio. Spend it deliberately: endpointing delay (0.3 to 0.6 s), LLM time to first token (small prompt, low reasoning effort, short answers), TTS first byte. Measure with the SDK's metrics events, not by feel. Keep prompts short; push static facts into the system prompt once, not per turn. Preemptive generation helps but is discarded when you edit context in `on_user_turn_completed`; disable it if you inject per-turn directives.
   **Done when:** you have logged p50 and p95 per stage for a scripted session.
6. **Turn-taking and barge-in.** Enable interruption so the user can cut in; use VAD plus the turn-detector so pauses do not end turns; set `user_away_timeout` to detect silence; handle `StopResponse` when your controller decides the agent should stay quiet. Keep spoken replies short (one question at a time, no lists).
   **Done when:** a manual or scripted test interrupts mid-reply and the agent stops.
7. **Tools.** `@function_tool()` on the agent; write the docstring as the model's instructions. When the owner says an action should fire without a confirmation step, it fires immediately: do not add "are you sure" turns. Tools that finish the call return `None` so no extra reply is generated, and run the closing sequence in the controller.
   **Done when:** each tool has a unit test against the controller, not the SDK.
8. **Persona.** Voice bots get human names and do not announce that they are AI unless the law or the product requires it. If disclosure is required, put it in the intro text once. Never invent a credential or identity beyond the configured name and role.
   **Done when:** the prompt contains the name and the disclosure decision is written in the spec.
9. **Errors and shutdown.** Listen to the session `error` and `close` events. Decide per error kind whether to apologise and continue or end the session; make finalisation (post transcript, mark complete) run on shutdown through the `on_session_end` hook with an idempotency key, so a crash or disconnect still records the outcome.
   **Done when:** a test simulates a dropped participant and sees exactly one finalise call.
10. **Mock mode.** `VOICE_MODE=mock` (or `LLM_PROVIDER=mock`) replaces STT, TTS and LLM with scripted fakes, so tests and CI never call LiveKit Inference, Ollama, Claude or Resend. Real-provider checks are opt-in behind an env var (`test_ollama_integration.py` style).
   **Done when:** `uv run pytest` passes offline.

## Owner-machine steps

These need the owner's explicit yes each time; they are never run from a cloud session. Provide them as scripts that read secrets from the environment and print none.

```bash
lk agent create                       # first time; writes livekit.toml
lk agent update-secrets --help        # flag syntax varies by CLI version; check first
lk agent deploy                       # releases
lk agent status && lk agent logs
```

Secrets the agent needs at runtime (names only): `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, the LLM key, the backend `APP_URL` and agent bearer secret. Local `.env` is git-ignored and never overwritten.

**Scripted voice smoke test against real LiveKit** (a participant joins, speaks a fixed WAV, the transcript is checked) is an owner-machine step: it spends LiveKit Inference minutes. Offer the script, do not run it unprompted.

## Webhooks

The backend receives LiveKit webhooks (`room_finished`, `participant_left`) on a route that verifies the signature with the server SDK's webhook receiver before acting; handlers are idempotent because deliveries repeat. Use webhooks as a safety net for finalising sessions the agent could not finish.

## Rationalizations

| Excuse | Do instead |
|---|---|
| "Put the logic in the agent class" | Keep it in LiveKit-free modules so it is testable. |
| "Retry inside the LLM client and the session" | One owner: `max_retries=0` on the client, retries in `conn_options`. |
| "Ask the user to confirm the tool call" | If the owner said fire immediately, fire immediately. |
| "Just test it live once" | Live runs cost minutes and are owner-machine steps. |

## Verification

- [ ] Logic modules have no `livekit` imports; tests pass offline.
- [ ] Only dispatched jobs with valid metadata are accepted; session re-validated.
- [ ] STT/TTS/turn-detector identifiers checked against current docs.
- [ ] Latency p50/p95 per stage logged; interruption works.
- [ ] Finalisation idempotent and triggered on shutdown.
- [ ] No deploy, secret update or paid smoke test run without the owner's yes.

## Versions

- livekit-agents 1.8.10 (verified 2026-11-05, https://pypi.org/project/livekit-agents/)
- Owner agent pins `livekit-agents[openai,silero,turn-detector]~=1.8.10`, Python >=3.11,<3.14 (verified 2026-11-05, owner project pyproject)
- Docs: https://docs.livekit.io/agents/ (not re-read in this authoring pass; check before use)
