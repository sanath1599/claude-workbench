# Design template

Copy the headings you need. A medium design is the same list in under 20 lines of chat.

```
# <Topic>: design

Date, author, status (draft | approved).

## Intent
What this is for and who it serves, in two or three sentences. Why now.

## Goals / non-goals
- Goals: what must be true when this is done.
- Non-goals: things that look related but are out.
- Anti-goals: outcomes that would make it a failure even if it technically works.

## Constraints
Stack, hosting, budget, deadlines, data rules, things that must not be touched.

## Decisions
| Decision | Made by (owner | my call) | Cost if wrong |

## Parts
One paragraph per part: what it does, its inputs and outputs, what it depends on.

## Open items
Each with the default that will be used if nobody answers.

## Risks
One line each. Mention once.

## Verification
How the owner will know it works: the commands, the pages, the numbers.
```

Rules: keep the verbatim brief in its own file; amendments go in this design and say they override the brief; undecided client values ship as config with a documented default.
