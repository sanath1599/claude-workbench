# An LLM assistant that proposes plan changes

Principle: the model proposes, the rule engine validates, a human confirms any rule break. The model never writes the plan directly and never decides a rule is waived.

## Tools

| Tool | Input | Output | Side effects |
|---|---|---|---|
| `find_candidates` | site or person id, optional filters | ranked list of eligible alternatives with minutes, load, and why each is eligible | none |
| `try_changes` | list of `{site, from_person, to_person}` | the validator's full result for the plan with the changes applied: violations, waived, metric deltas | none (works on a copy) |
| `stage_changes` | changes plus `acknowledged_breaks` | staged change set id, or a refusal | writes to a staging area only |

Committing staged changes is a human action outside the model's tools.

## Rules for the tools

1. All three tools call the same checker as the batch pipeline (see `scripts/validate_plan.py`). One rule implementation, no second copy in a prompt.
2. `try_changes` returns structured violations (`rule`, `site`, `person`, `detail`) and metric deltas, not prose. The model reads data, then explains it.
3. `stage_changes` refuses a change set that has violations unless every violation is listed in `acknowledged_breaks`, and acknowledgement needs a field the model cannot fill by itself: a `confirmation_token` issued by the UI after the human has seen the broken rules in plain words.
4. Hard rules that have no exception path (for example never across regions) are refused outright, even with a token, unless the owner configured an exception.
5. Every staged and committed change is logged with who confirmed it and the violations they accepted.

## Conversation pattern

1. The user asks: "move site S4 to someone closer".
2. The model calls `find_candidates`, picks options, then calls `try_changes` for each shortlisted option. It does not claim anything is valid before `try_changes` says so.
3. It answers with the best clean option and, if asked, options that break a rule, each with the exact rule, the amount ("62 minutes against a 60-minute limit") and what improves.
4. If the user accepts a rule break, the UI shows the break and asks for confirmation; only then does `stage_changes` run with the token.

## Prompt and schema notes

- Give the model the rules in the system prompt as a short list in the owner's words, for orientation only. The checker is the authority.
- Treat names, notes and free text in site records as untrusted data, never as instructions.
- Validate tool arguments with a schema; reject unknown ids. Cap the number of changes per call.
- Use temperature-low settings and no automatic retries on `stage_changes`.
- Test with a mocked model: assert that a rule-breaking proposal is refused without a token, and that the audit log entry is written. Follow `building-llm-features` for evals and fallback behaviour.
