# Routing, fallback and caching detail

Detail behind steps 1, 5, 7 and 10 of `SKILL.md`. Examples use the Anthropic Messages API for the strong model; the shape applies to any pair of providers.

## Hand-off mechanics: a cheap model answers, a marker forwards

When the cheap model receives every request and a stronger model handles only some, use three signals together:

1. The cheap model's system prompt tells it to reply with exactly one marker token (for example `<forward-to-planner/>`) when the request needs the strong path.
2. A separate tiny classification call runs in parallel and returns `question | change | unsure`.
3. Code also treats the start of a structured-change block in the cheap answer as a hand-off.

Hold back the cheap model's streamed text until the first 24 or so characters are known not to be the marker, or until the classifier says `question`, so a forwarded request never flashes a wrong answer. If text was already shown when the hand-off fires, emit a `restart` event so the UI clears it, and abort the cheap stream. Keep this logic in one generator with a test.

**Done when:** a test feeds a marker-first stream, a marker-after-prose stream and a plain answer, and the UI event sequence is right for each.

## Fallback from the strong model must be visible

- When the strong model fails mid-request (bad key, 429, outage, `stop_reason: "refusal"`), show no error. Emit `restart` if text was already streamed, then run the cheap model on the same input.
- Send a `meta` event first on every attempt with `model`, `provider` and, on fallback, a `reason` ("<model> was not available: <short cause>"). The UI shows which model wrote the answer, so a weaker answer is never passed off as the strong one.
- A client abort is a stop, not a failure: check `signal.aborted` before falling back.

## Three-tier system prompt

Order the prompt by how often it changes and put a `cache_control` breakpoint after each stable tier:

1. Rules plus the long reference guide, identical on every request.
2. Data tables that change only when the underlying data or the user's pending changes do.
3. The per-question tail, uncached.

Log `cache_read_input_tokens` and `cache_creation_input_tokens` every round; a long agent loop shows reads from round 2.

**Done when:** the second request of a session logs a non-zero `cache_read`.

## Cache results, not only prompts

Cache model output by a hash of the facts it was given: a fresh window, then a stale window served while one refresh runs. Share one in-flight promise per key so concurrent requests make one call. After repeated failures open a short breaker (minutes) and render the page or card without the AI part. Give the model a wait budget of a few seconds and render without it when exceeded. Check every number the model writes against the facts you passed in. In-process caches are per worker: note that in the design when more than one instance runs.
