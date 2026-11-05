---
name: new
description: Use when the owner runs /workbench:new, or says "new project", "start a new project" or "create a new one" and wants the guided flow from brief to approved sample to plan. Not for setup of the workbench itself, which is workbench:setup, nor for the bare repo scaffold, which is kickoff:starting-a-project.
disable-model-invocation: true
argument-hint: "[brief or path]"
---

# New project, guided

The owner answers in a browser page instead of in chat. Claude and the page talk through a local "studio": Claude pushes steps (questions, choices, a sample, a plan) and the page sends each click back. Nothing is planned until the owner has seen and approved a one-page sample. This skill orchestrates existing skills; it does not repeat them.

## When to use
- `/workbench:new`, with a brief pasted or a path to one.
- The owner wants to go from an idea to an approved sample and plan with few questions.

## When not to use
- Personalising the workbench: workbench:setup.
- Only the repo scaffold, or an existing repo: kickoff:starting-a-project.
- A feature in an established repo: the relevant stack skill.

## Procedure

`studio` below means `node scripts/studio.mjs` in this skill's directory, with `--dir .workbench-studio` in the project folder. Protocol, step shapes and fallbacks: `references/bridge.md`. Question schema: `references/intake-schema.md`.

1. **Take the brief.** If `~/.claude/workbench/profile.json` is missing, say once that `/workbench:setup` personalises things, then continue with the bundled defaults. The brief is the argument (text or path); ask for it in one line if absent. Infer the folder name; ask only if it cannot be inferred. Create the folder, save the brief verbatim to `docs/requirements/original-brief.md`, and add `.workbench-studio/` to `.gitignore`.
   **Done when:** the brief file matches the input.

2. **Start the studio.** Run `studio start --dir .workbench-studio` in the background. It prints `STUDIO_URL=...` and opens the browser. Then start the listener: under the Monitor tool run `studio tail --dir .workbench-studio` so each click arrives as a live notification; without Monitor, call `studio wait --after <last id>` in a loop (exit 2 means timeout, wait again). If no browser or no local display (cloud session), use AskUserQuestion in one batch instead and skip the studio.
   **Done when:** the owner has the URL and the listener is running.

3. **Push the pre-filled questions.** Copy `assets/intake.json`, replace every `value` with answers drafted from the brief (stack rows from kickoff:choosing-the-stack, one line of reason each, with the Hosting row following the deployment tier; recommended options marked), and run `studio push --kind questions --file <json> --title "Project intake"`. For UI projects the `direction-picker` offers the two house directions first ("Navy professional", "Graphite editorial", ids `house-navy` and `house-graphite`, already in `assets/intake.json`) and a third drawn from the brief via design-studio:choosing-type-and-color. Tell the owner in one line to review the page and press Submit. Do not ask anything in chat.
   **Done when:** a reply of kind `answers` arrives.

4. **Study the reference products** (only if the `references` answer has rows). Follow `references/reference-products.md`: use toolbelt:reverse-engineer-anything per reference, learn patterns only, mark inferences, write `docs/intake/references.md`, and push a `choices` step (multi-select, with screenshots) so the owner confirms what to borrow.
   **Done when:** the owner's borrow choices arrived, or there were no references.

5. **Create the repo now.** Apply the answers through kickoff:starting-a-project steps 2 to 5 without re-asking: `.claude/workbench.json` (including `deploymentTier`, `cloud`, `cicd`, `iac`, `iacTool`, `iacSync` from the Deployment answers; mapping in `references/intake-schema.md`), CLAUDE.md (add the "Infrastructure" section when `iacSync` is true), `.env.example`, `.gitignore`, git init, private `gh repo create`, first push. If `cloud_handoff` is `yes`, run the prepare phase of kickoff:handing-off-to-cloud. Push a `message` step ("Repo created") so the page shows progress.
   For an `enterprise` tier with a cloud, plan provisioning with ops-and-sre:provisioning-on-hyperscalers; nothing paid is created before the cost statement is approved.
   **Done when:** `git remote -v` shows origin, the tree is clean, and the push output was shown.

6. **Design directions** (UI projects). Push a `choices` step with three directions: the first two are the house directions from design-studio:designing-without-ai-slop (`references/house-style.md`: Navy professional, Graphite editorial, with their real palettes and fonts), the third is built on the confirmed answers, borrow notes and any client brand (replace both house ones only when a client brand or the brief rules them out): palette swatches plus a live type sample, and layout thumbnails if the layout is open. Wait for the pick. Export tokens with `choosing-type-and-color/scripts/search.mjs export <paletteId> --font <fontId> --out design/preview/tokens.css` (house picks may instead copy `designing-without-ai-slop/assets/house-tokens.css` and set `data-house`).
   **Done when:** a `choice` reply arrived and `tokens.css` exists.

7. **Sample, then approval loop.**
   - UI (`ui` or `both`): follow design-studio:previewing-ui-before-building, as one page of the key screens in tabs or sections with fictional data, loading, empty and error states. Mark each screen with `data-screen`. Verify with design-studio:verifying-ui-in-browser.
   - `api`: a one-page system sketch: inline SVG architecture diagram, main endpoints or agent tools, Temporal workflows if any, data model.
   Push it with `studio push --kind mock --file sample.html --title "Sample" --screens "Home,Detail"`. On `changes`, read `comments` and `screenNotes`, rebuild, push a new mock. Repeat without asking in chat until `approve`.
   **Done when:** an `approve` reply to a mock step arrived.

8. **Record.** Run `studio export --dir .workbench-studio --to docs/intake` (writes `answers.json`, `choices.json`, `approval.json` with timestamps and the sha256 of the approved sample). Copy the approved page to `design/preview/`, freeze `tokens.css`, point CLAUDE.md "Start here" at them, commit and push.
   **Done when:** the hash in `approval.json` equals `shasum -a 256 design/preview/<file>`.

9. **Plan, then plan approval.** Write the design spec (kickoff:writing-the-design-spec) from the answers and the approved sample, then the implementation plan (workflow:writing-implementation-plans), small increments, the first one visible. Push the plan as `--kind plan --file plan.md`; iterate on `changes` (per-section notes) until `approve`. Then ask one question in the page or chat: build here, or hand off to a cloud session, preselected from `cloud_handoff`. Export again, commit, push a `done` step with a five-line summary.
   **Done when:** the plan has an `approve` reply and the owner chose where to build.

10. **Finish the base.** Run steps 8 and 9 of kickoff:starting-a-project (prove the bootstrap; graphify and the CLAUDE.md "Knowledge graph" release rule; skip graphify if `.claude/workbench.json` says `graphify` is false). Then `studio stop`.
    **Done when:** bootstrap output was shown and `graphify-out/graph.json` exists, or graphify was skipped by policy.

## Quick reference

| Command | Effect |
|---|---|
| `studio start [--port 0] [--no-open]` | start server, print `STUDIO_URL` |
| `studio push --kind questions\|choices\|mock\|plan\|message\|done --file F [--title T] [--screens A,B] [--asset img]` | add a step; the page shows it at once |
| `studio wait [--after N] [--timeout S]` | one reply as a JSON line; exit 2 on timeout |
| `studio tail [--after N]` | every new reply, forever (run under Monitor) |
| `studio export --to docs/intake` | write the decision files |
| `studio stop` | stop the server |

| Reply kind | Meaning |
|---|---|
| `answers` | the submitted intake |
| `choice` | picked option id(s) and a comment |
| `approve`, `changes` | decision on a `mock` or `plan` step, with comments and per-screen or per-section notes |

## Rationalizations

| Excuse | Instead |
|---|---|
| "Skip the sample, the brief is clear" | The owner approves what they can see. Build the one page. |
| "Ask the questions in chat instead" | One pre-filled page beats a question stream. Chat only when no browser exists. |
| "Plan while the sample is under review" | Planning on an unapproved design wastes the plan. Wait for `approve`. |
| "Create the repo after the plan" | The repo comes first so every artifact is versioned. |
| "Copy the reference product's wording or assets" | Patterns only. Never its brand, copy, assets or code. |
| "Re-ask the delivery questions" | The intake answered them. Read `answers.json`. |

## Verification
- [ ] Brief saved verbatim; `answers.json`, `choices.json`, `approval.json` exist.
- [ ] `approval.json` mock decision is `approve` and its sha256 matches `design/preview/`.
- [ ] Repo pushed and clean; `.workbench-studio/` is git-ignored; no secrets committed.
- [ ] Spec and plan committed; plan approved; the owner chose where to build.
- [ ] No planning happened before the sample was approved.

## References
| File | Load when |
|---|---|
| `references/bridge.md` | step shapes, fallbacks, future channels |
| `references/intake-schema.md` | step 3, reading answers |
| `references/reference-products.md` | step 4 |
| `assets/intake.json` | step 3 |
| `assets/studio.html` | served by the studio; do not edit per project |
