# <Feature> implementation plan

Spec: <path to the approved design>
Goal: <one sentence>
Approach: <two or three sentences>
Execution: subagent-driven, reviews batched after tasks <a-b>, <c-d>; critique pass at the end.

## Global constraints

One line each, with exact values from the spec: versions, naming and copy rules, banned libraries, stack defaults, "no real LLM/voice/email calls in tests".

## File map

| File | Responsibility | Task |
|---|---|---|

## Tasks

### Task 1: <name>  [independent | after: N]

- Goal: <what is true afterwards>
- Files (owned): <paths>
- Interface: <signatures other tasks rely on>
- Test first: <test file and the behaviour it pins> (or "no test: visual tweak")
- Steps:
  1. <single action with a checkable result>
  2. ...
- Verify: `<command>` expects `<output>`
- Commit: `<message>`

## Owner-only steps

Scripts the owner runs with `! bash <script>`. Nothing here prints a secret.

## Parked

Stretch goals, moved to NEXT_STEPS.md.
