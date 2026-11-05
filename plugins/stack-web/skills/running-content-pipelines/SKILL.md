---
name: running-content-pipelines
description: Use when a site publishes articles or pages on a schedule from drafts written by an unattended agent, or when designing the draft, gate and release path for such content, including images, corrections and retirements. Not for one-off page copy, which is workbench:writing-deliverables, nor for the Vercel build itself, which is deploying-on-vercel.
---

# Running content pipelines

Split the work in two. Drafting runs unattended (a scheduled cloud routine) and writes files; releasing runs where the credentials are (the owner's machine or CI) and is the only step that touches the database. A gate in code decides what ships.

## When to use

- A recurring routine drafts articles, news items or pages into a repository.
- Adding or fixing the release script, publish gate, image step or retirement path.

## When not to use

- A single page or document: `workbench:writing-deliverables`.
- Wiring the release into the build: `stack-web:deploying-on-vercel`, its config reference ("Release steps in the build").

## Procedure

1. **Lay out content by slug.** Name files by slug only and keep ordering in front matter (`publishedAt`) or the database. Sequence prefixes (`41-topic.md`) make parallel draft branches collide at merge time.
2. **Draft under the quality bar** (`references/quality-and-images.md`): every figure from a page opened in this run, claims literally true, nothing published rather than something forgettable.
3. **Pre-check locally.** Give the drafting agent a cheap script for what the gate rejects (empty table header cells, over-long descriptions), so a bad file never costs a failed production build.
4. **Gate in the release script.** Abort the whole release on any failure: required fields, SEO lengths, valid canonical, first heading H2, image with alt text, every source marked checked, valid structured data, an approval record. A failed build leaves the previous deployment serving.
   **Done when:** a deliberately broken draft stops the release with a named reason.
5. **Release idempotently.** Store a hash of each source file's content and metadata and skip rows whose hash is unchanged. Touch `updatedAt`, sitemap `lastmod` and feed entries only for changed rows: a daily run that republishes untouched pages tells crawlers everything changed.
   **Done when:** running the release twice in a row changes nothing the second time.
6. **Trigger the release from where credentials live.** A cloud session cannot reach the owner's machine or database. It commits drafts and, if allowed, includes a release token in the commit message that the production build honours (see the Vercel config reference); otherwise the owner or CI runs the script.
7. **Retire, do not delete.** Remove a duplicate or wrong article with a retirement list that archives the row and 301-redirects to the survivor. Unpublishing in the admin is a separate manual step and must be reported. Corrections carry a dated correction note, never a silent rewrite. Before drafting, search existing content and update the living page instead of writing a near-duplicate.
8. **Log each run in one line**, including what was not verified and any "nothing published, because ...".

## Quick reference

| Concern | Rule |
|---|---|
| Filenames | slug only, order in metadata |
| Re-runs | hash-skip unchanged rows |
| Gate | in the release script, abort all on one failure |
| Duplicates | archive plus 301, report the manual step |
| Images, sources, honesty | `references/quality-and-images.md` |

## Verification

- Release run twice produces no changes the second time.
- A broken draft is rejected by the gate with a reason.
- Retired content redirects; corrections are dated.
- No claim lacks a source opened in the run that wrote it.

## References

| File | Load when |
|---|---|
| references/quality-and-images.md | writing the drafting prompt, generating images, or an upgrade removed a local tool |
