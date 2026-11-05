---
name: researching-in-depth
description: Use when a decision or document needs research across several sources: comparing vendors or options, market or regulatory questions, "what is the current best practice", literature or competitor scans, or any question where the answer must be cited. Not for a single factual lookup, nor for reading the project's own code (use Explore).
---

# Researching in depth

Research is finished when a reader can check every claim. Split the question, send researchers out with clear briefs, make them keep a source log, and write a synthesis that says what is known, what is disputed and what is a guess.

## When to use

- A choice between options (vendors, libraries, architectures, plans) that costs money or time to reverse.
- A report, proposal or spec that cites outside facts.
- A question about something recent where memory is likely stale.

## When not to use

- One fact or one page: just search or fetch it.
- Understanding this repository: use the Explore agent.
- Writing up findings you already have: `workbench:writing-deliverables`.

## Procedure

### 1. Frame the question

Write: the decision this research feeds, the question in one sentence, the scope (dates, regions, versions), what would change the decision, and the form of the output (a recommendation, a comparison table, a briefing). Ask the owner only about an ambiguity that changes which sources matter, in one batch of at most four questions with recommended defaults.

**Done when:** you can state the decision and the stopping rule ("enough evidence to choose between A and B", not "everything").

### 2. Split into independent threads

Pick the number of researchers from the shape of the question:

| Shape | Threads |
|---|---|
| One narrow topic | 1, inline |
| A few angles on one topic | 3 |
| Options compared on criteria | one per criterion, or one per option |
| Many entities (countries, vendors) | one per entity, up to about 6 |

Threads must not overlap. Always add one thread whose job is to find the strongest evidence against the leading option.

**Done when:** each thread has a one-line scope and no two threads share a question.

### 3. Brief the researchers

Subagents run on `{{wb.subagent_default_model}}` (sonnet; never opus unless the owner says so), launched in parallel in one message. Each brief contains the decision, its thread's questions, the date and scope limits, preferred source types (primary documents, official docs, filings, standards, original papers before blog summaries), the output path, and the log format below. Brief them like a peer who has seen none of this conversation (`workbench:delegating-to-subagents`).

Each researcher writes a notes file with:

- Findings as short claims, each followed by a source number.
- A source log: number, title, publisher, URL, publication or access date, and a note on how reliable it is (primary, vendor claim, opinion, undated).
- A list of things looked for and not found.
- Disagreements between sources, with both sides.

**Done when:** every notes file exists and each claim has a source number.

### 4. Check before synthesising

Read the notes yourself. For the three claims that matter most to the decision, open the cited source and confirm it says that. Look for single-source claims, vendor-only claims, undated pages and circular citations (two sources that quote each other). One more research round is allowed, only for a gap that blocks the decision.

**Done when:** each decision-critical claim has been traced to a source you read, or is marked unverified.

### 5. Write the synthesis

Use `references/report-template.md`. The structure is: answer first (recommendation or conclusion, with confidence), the evidence in the order the reader needs it, the disagreements, what is unknown, and the sources. Rules:

- Claims carry their citation numbers. A number without a source is deleted or marked as an estimate with its method.
- Distinguish fact, source's opinion and your inference.
- Use the owner's language rules: plain words for executives, acronyms spelled out, no hedging that does not change a decision.
- Currency of facts: say "as of <date>" on anything that changes (prices, versions, rules).
- A report for sharing is one self-contained HTML file; a Word deliverable goes through `producing-word-documents`.

**Done when:** the report is written to a file, every citation resolves to a log entry, and the unknowns section is not empty unless truly nothing is unknown.

### 6. Deliver

Reply with the recommendation in the first line, confidence, the two strongest reasons, the biggest unknown, and the report path. Do not paste the report.

## Rationalizations

| Excuse | Instead |
|---|---|
| "The first three results agree." | Check whether they share one origin. |
| "I remember this from training." | Facts about versions, prices and rules go stale; search. |
| "The vendor page says it clearly." | Vendor claims are claims. Find an independent source or label it. |
| "More researchers means better." | Overlap wastes money. Split by question, not by enthusiasm. |

## Verification

- [ ] The decision and stopping rule were written down first.
- [ ] A contrary-evidence thread ran.
- [ ] Three decision-critical claims were traced to the source text.
- [ ] Every claim in the report has a source number; dates are stated.
- [ ] The final reply gives the answer, confidence, biggest unknown and report path.

## References

| File | Load when |
|---|---|
| references/report-template.md | writing the synthesis and the source log |
