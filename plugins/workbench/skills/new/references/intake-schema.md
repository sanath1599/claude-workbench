# Intake schema

The studio renders a `questions` step from this JSON (template: `assets/intake.json`). Fill every `value`, keep the structure, push it with `studio push --kind questions --file <json>`.

## Question JSON

```json
{
  "schema_version": 1,
  "title": "Project intake",
  "subtitle": "one sentence shown under the title",
  "sections": [
    {
      "id": "project",
      "title": "Project",
      "description": "optional",
      "showIf": { "field": "kind", "in": ["ui", "both"] },
      "fields": [ { "id": "name", "type": "text", "label": "Project name", "value": "..." } ]
    }
  ]
}
```

`showIf` hides a section unless the named field currently holds one of the listed values. Hidden sections are left out of the answers.

A field can carry `showIf` too, as `{ "field": "deployment_tier", "value": "enterprise" }` (one value) or `{ "field": "kind", "in": ["ui", "both"] }`. The field is shown only when its section is shown, the condition holds, and the field it depends on is itself shown. Hidden fields are left out of the answers and are never required.

## Field types

Every field has `id` (unique), `type`, `label`, `value` (the pre-filled answer), and optionally `help`, `placeholder`, `required`.

| type | value | extra keys |
|---|---|---|
| `text` | string | |
| `textarea` | string | |
| `list` | array of strings (editable rows) | |
| `select` | string | `options: [{value, label}]` |
| `radio` | string | `options: [{value, label, detail?, recommended?}]`; `detail` carries the trade-off |
| `toggle` | boolean | |
| `stack-table` | array of `{layer, choice, reason}` | |
| `table` | array of row objects | `columns: [{key, label, options?}]`; `options` makes a select column |
| `direction-picker` | the chosen option `id` | `options: [{id, name, reason, palette, font, paletteId, fontId}]` |

`palette` holds `bg, surface, fg, primary, onPrimary, accent` as hex, copied from `choosing-type-and-color/references/palettes.json` (`light` or `dark` block). `font` holds `label`, `display` and `body` CSS stacks from `font-pairings.json`. `paletteId` and `fontId` are the ids that `node scripts/search.mjs export <paletteId> --font <fontId>` takes; the page ignores them but answers.json keeps them so the export can run later.

## Required sections and field ids

| Section | Field ids |
|---|---|
| `project` | `name`, `purpose`, `users`, `features`, `non_goals` |
| `shape` | `kind` (`ui`, `api`, `both`), `scale` |
| `references` | `references` (rows `{kind, target, like}`; may be empty) |
| `stack` | `stack` |
| `deployment` | `deployment_tier` (`dev`, `internal`, `enterprise`); enterprise only: `cloud` (`azure`, `aws`, `gcp`), `cicd` (`none`, `existing`), `iac` (`cli-then-iac`, `terraform`, `bicep`, `cli-only`); `cicd_system` when `cicd` is `existing`; `iac_tool` (`terraform`, `bicep`) when `iac` is `cli-then-iac` |
| `delivery` | `cloud_handoff` (`yes`, `maybe`, `no`), `repo_owner`, `repo_visibility`, `commit_policy`, `coauthor`, `deploy_policy` |
| `design` (UI only) | `direction`, `theme`, `density` |
| `extra` | `notes` |

## Answers (what Submit posts, saved as docs/intake/answers.json)

```json
{
  "schema_version": 1,
  "submitted_at": "2026-11-05T10:00:00.000Z",
  "answers": {
    "name": "field-notes",
    "features": ["Log a visit"],
    "kind": "ui",
    "cloud_handoff": "maybe",
    "stack": [{ "layer": "Frontend", "choice": "TypeScript, Vite, TanStack", "reason": "..." }],
    "direction": "slate-calm"
  }
}
```

Answers are a flat map from field id to value. Lists are trimmed and empty rows dropped. Fields in hidden sections are absent. When the page runs without the collector, "Copy answers" puts this same JSON on the clipboard.

## Mapping to .claude/workbench.json

| Answer | Key |
|---|---|
| `cloud_handoff` | `cloud_handoff` |
| `repo_owner`, `repo_visibility` | `repo_owner`, `repo_visibility` |
| `commit_policy`, `coauthor` | `commit_policy`, `coauthor_trailer` |
| `deploy_policy` | `production_deploys` |
| `deployment_tier` | `deploymentTier` |
| `cloud` | `cloud` (absent unless enterprise) |
| `cicd` (and `cicd_system` when `existing`) | `cicd` (`none`, or the system's name) |
| `iac` | `iac` |
| `iac_tool` | `iacTool` (absent unless `iac` is `cli-then-iac`) |
| `iac` is `cli-then-iac` | `iacSync: true`, otherwise `false` |

Check `kickoff/skills/starting-a-project/assets/workbench.json` for the exact key names before writing, and use its spelling if it differs.

## Choices and approval

`studio export --to docs/intake` writes `answers.json` (above), `choices.json` (one entry per `choices` step title with `choice`, `comment`, `at`) and `approval.json`:

```json
{ "mock": { "decision": "approve", "approved_at": "...", "comments": "", "screenNotes": [], "artifact": "step-7.html", "sha256": "<hex>", "rounds": 2 },
  "plan": { "decision": "approve", "...": "..." } }
```

The page posts `approve` or `changes` with `comments` and `screenNotes` (mock) or `sectionNotes` (plan).
