# Planned conversation path

Use when the agent must cover a fixed set of topics inside a time budget (an interview, an intake, a survey) and a greedy "pick the next topic" planner wanders.

## Plan

Compute an ordered plan of stages in the backend, not the worker: `intro`, topic stages each tied to one rubric criterion, and `closing`. Each stage has seconds, max follow-ups and a `required` flag. Send the plan with the context call. Keep the planner a pure function with unit tests.

## Following it

- A stage ends when its follow-ups or time budget are spent, or when the live analyst rates the answer adequate. Unused time rolls forward.
- When behind schedule, skip optional stages first and record them as `skipped`, so required stages and the closing always fit.
- If time remains, revisit the criterion with the thinnest evidence before closing.
- Publish stage progress as participant attributes for the UI, and send per-stage status back with the result.
- Keep stage labels safe to show the person on the call: generic by kind, never criterion names or weights.

## Finish contract

The finishing call (`/complete`) carries an `idempotencyKey` and returns the persisted result on any repeat, including after the session is already terminal. The backend returns the exact closing message and the worker speaks it verbatim; it never composes an outcome. Provide `/fail {reason}` for worker-side errors, with a fallback line that says nothing about the result. If `/complete` times out, speak a neutral line and report through `/fail`: a transport error is not a failed participant.
