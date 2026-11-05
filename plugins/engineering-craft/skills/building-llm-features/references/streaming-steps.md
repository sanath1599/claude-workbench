# Cost, latency, streaming and hand-off

## Effort and latency

Choose reasoning effort per request, not per app: a default level, a higher one when the ask is open-ended, has several verbs, carries attachments or is long, and an environment override read first so the owner can force a level without a deploy. Keyword heuristics are language-specific, so include every supported language. Re-check the effort and thinking parameter names in the current API docs before copying; they change.

Response time follows tokens written, not tokens read, so shrinking the prompt rarely helps while cutting or splitting long outputs does. Return the primary result first and run enrichment (skill lists, rubrics, summaries) after it, in the background; run independent reads in parallel with a bounded pool. Before proposing a latency fix, pull per-call timings from telemetry (tokens and duration per call) and check the correlation; write down the guesses the data disproved. Putting all reference data in a cached system prompt is fine while it fits comfortably; set a byte ceiling, log the prompt size, and move to retrieval or a lookup tool when it is exceeded. Stream when a person waits. Cache by input hash where inputs repeat. Set a hard per-request and per-user ceiling.

## Progress

Progress shown while the model works comes from events the system really saw (first file read, first output written, tool result received), never from timers. If billed usage is invisible, label counts as estimates and say how they are estimated. A job with no report for several minutes shows as "interrupted", not "running".

## NDJSON events to the UI

Stream one JSON object per line (`application/x-ndjson`); it parses with `fetch` and `getReader` and survives proxies better than custom framing. Keep a small fixed vocabulary and document it in a header comment next to the generator:

| Event | Meaning |
|---|---|
| `meta` | which model answers |
| `s` | a new step started (for example thinking) |
| `think` | reasoning summary text |
| `tool` | `{id, name, phase: writing/running/done, title, ok, error}` |
| `t` | answer text |
| `demote`, `restart`, `error` | UI corrections and failure |

Show a tool step while the model is still writing its arguments: pull the title field out of the half-written JSON with a tolerant regex on the accumulated input deltas and emit `phase: writing` as it grows; switch to `running` when the call is complete and `done` with the result. Wire the request's abort signal to the model stream so closing the tab stops the spend.

## Cheap model answers, strong model only where needed

When the cheap model receives every request, use three signals together:

1. Its system prompt says to reply with exactly one marker token (for example `<forward-to-planner/>`) when the request needs the strong path.
2. A tiny classification call runs in parallel and returns `question | change | unsure`.
3. Code also treats the start of a structured-change block in the cheap answer as a hand-off.

Hold back the cheap model's streamed text until the first characters are known not to be the marker, or the classifier says `question`, so a forwarded request never flashes a wrong answer. If text was already shown when the hand-off fires, emit `restart` so the UI clears it, and abort the cheap stream. Keep this logic in one generator.

**Done when:** a test feeds a marker-first stream, a marker-after-prose stream and a plain answer, and the UI event sequence is right for each. Retries and fallback models themselves are `stack-python:calling-llms-reliably`.
