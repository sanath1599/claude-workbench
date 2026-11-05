---
name: writing-showcase-readmes
description: Use when writing or rewriting a README for a product or project the owner will show to others, or when the owner asks for screenshots in it, a feature list, or "a proper README". Not for demo decks, which is presenting-guided-demos, and not for internal CLAUDE.md or handoff notes.
---

# Writing showcase READMEs

A showcase README lets a stranger understand the product in a minute: the problem, the solution, everything it does, how a user moves through it, and what it looks like.

## When to use

- A product repo is being published, shared with a client, or finished.
- The owner says "update the README", "add screenshots", "enough screenshots".

## When not to use

- A guided executive presentation: `design-studio:presenting-guided-demos`.
- Agent instructions (CLAUDE.md) or session handoffs: workbench skills.

## Procedure

1. **Read the product.** Read the spec, routes and seed script so the feature list is complete and true. Do not describe features that do not exist.
2. **Seed fictional data.** Use a seed script with invented people, companies and `example.com` addresses. Never real customer, candidate or employee data; if the repo only has real data, stop and ask.
3. **Run a local production build** (`build` then `start`, not the dev server) with the seeded database. Dev overlays and hot-reload badges ruin screenshots.
   **Done when:** the app serves on a local port with seeded data.
4. **Capture screenshots.** Use `design-studio:verifying-ui-in-browser` tooling at 1440 wide (plus one phone shot if the product is mobile-friendly). Take a moderate number, enough to cover each major area, roughly 6 to 12: no screenshot of an empty or error page unless the README discusses it. Save as PNG under `docs/screenshots/NN-name.png` with descriptive alt text. Headless Chrome gotchas: maps and canvas need a fresh `--user-data-dir` and `--disable-gpu`; background tabs do not paint until screenshotted.
5. **Write the README** in this order:
   1. Name and one-line summary, then live URL and repo URL.
   2. Problem: who hurts and how, in two to four sentences.
   3. Solution: what the product does about it.
   4. Screenshots interleaved with the sections they illustrate.
   5. Full functionality list, grouped by area, each item a short factual bullet.
   6. End-to-end flow: numbered steps from first visit to outcome, per role if there are several.
   7. Tech stack in one short list.
   8. Commands: install, env setup (point at `.env.example`, never real values), dev, build, test, seed.
   9. "What is real and what is simplified", taken from the spec's out-of-scope list; and "Data provenance", pointing to a catalog (source, collection date, licence and attribution, known limitations). Say plainly that a missing value means "not matched", not "confirmed none". For AI features, state which numbers are computed by code and that the model only explains them.
   10. Licence.
6. **Check for leaks.** Grep the README and images folder for emails, tokens, real names. Open every screenshot and read it.
   **Done when:** links resolve, images render, commands were run from a clean checkout where possible.

## Rules

- Do not claim AI authorship or mention Claude, in the README or its commits, unless the product itself is an AI feature.
- Plain, factual, confident prose. No marketing adjectives, no invented metrics, no emojis.
- Live URL only after confirming it responds; never state a deploy you did not check.

## Quick reference

| Section | Must contain |
| --- | --- |
| Header | name, summary, live URL, repo URL |
| Problem and solution | short, concrete |
| Screenshots | about 6 to 12, fictional data |
| Functionality | complete, grouped |
| Flow | numbered, end to end |
| Commands | exact, runnable |

## Verification

- [ ] Every listed feature exists in the app.
- [ ] Screenshots come from fictional seeded data on a production build.
- [ ] No secrets, real personal data or AI-authorship claims.
- [ ] Live URL checked with a request; repo URL correct.
