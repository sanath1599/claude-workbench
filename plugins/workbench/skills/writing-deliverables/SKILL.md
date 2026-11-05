---
name: writing-deliverables
description: Use when writing anything the owner or their stakeholders will read: status updates, end-of-task summaries, reports, handoff notes, executive or client documents, explainers. Also when the owner asks for a TLDR or says a message is too long. Not for READMEs (design-studio:writing-showcase-readmes) or runbooks (ops-and-sre:writing-runbooks).
---

# Writing deliverables

The owner reads fast and acts on what they read. Lead with the outcome. Give evidence for claims. Leave out anything that doesn't change what they do next.

## When to use
- Every end-of-task message, and every shareable document.

## When not to use
- READMEs and runbooks have their own skills.

## Procedure

1. **Pick the form:**

   | Reader and purpose | Form |
   |---|---|
   | The owner, in chat | 3 to 10 lines: outcome, evidence, what is waiting on them (as `! commands`) |
   | The owner asks for a TLDR | 3 bullets |
   | A report, handoff, explainer or demo to share | one self-contained HTML file (or a claude.ai Artifact), printable, rather than Markdown or PDF |
   | An executive or other non-technical reader | plain words, acronyms spelled out, outcomes and numbers first, no implementation detail |
   | A Word, Excel, PowerPoint or PDF file | `docs-and-data:producing-word-documents`, `producing-spreadsheets`, `producing-slide-decks` or `working-with-pdfs`; the final PDF of a Word document is exported from Word |
   | A client-facing document | confident and positive, with no hedging or self-doubt; every claim still true and checkable |

2. **Order the content:** outcome, then evidence (the command and its result, a URL, a run id), then decisions you made on the owner's behalf (one line each, so they can veto), then pending items, with exact commands.

3. **Cut:** process narration, restated requests, caveats that change nothing, and options you didn't take. If a section has nothing that changes the reader's next action, delete it.

4. **Honesty rules:**
   - Never call something done, deployed, sent or launched without evidence.
   - Say plainly what failed or was skipped.
   - Products don't claim AI authorship unless the owner wants that (voice bots get human names; articles don't say AI wrote them).

## Verification
- [ ] The first line states the outcome.
- [ ] Every "done" has evidence attached.
- [ ] Owner actions are copy-pasteable commands.
- [ ] Shared documents are self-contained HTML.
- [ ] Any document over one page that someone will read without you passed a reader test: write the five questions the reader will most likely ask, give a fresh subagent only the document, ask it those questions, and fix every wrong or missing answer.
