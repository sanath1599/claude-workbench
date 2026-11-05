# The studio bridge

Claude Code cannot be called from a web page, so the page and the session meet in files and a local server.

```
browser page  --POST /api/reply-->  server  --append-->  inbox.jsonl  --tail/wait-->  Claude
browser page  <--SSE /events------  server  <--POST /api/push--  studio push (Claude)
```

State lives in `<project>/.workbench-studio/` (git-ignored): `state.json` (port, token, pid), `inbox.jsonl` (page to Claude), `outbox.jsonl` (Claude to page), `artifacts/` (mock HTML and images). Restarting the studio in the same folder continues the numbering and the page replays all steps.

## Security
- Binds to 127.0.0.1 only; the Host header must be local.
- Every request needs the random token (`X-Studio-Token` header, or `?t=` for the page, SSE and iframes). No token gives 401.
- A request that carries an Origin must come from a local http origin.
- Replies are capped at 256 KB, pushes at 24 MB.
- The app page has a strict CSP (no external requests). Mocks are served with their own CSP and rendered in `<iframe sandbox="allow-scripts">` without `allow-same-origin`, so a mock cannot read the token or call the API.

## Step shapes (`push --file`)

| kind | file | data |
|---|---|---|
| `questions` | JSON | the intake schema (`assets/intake.json`) |
| `choices` | JSON | `{prompt, multi?, commentHint?, options:[{id, name, reason, palette?, font?, image?}]}`; `image` is the basename of a file sent with `--asset`. `palette` takes `{bg, surface, fg, primary, onPrimary, accent}`, a choosing-type-and-color palette entry (its `light` values are used), or a list of hex values in the order bg, fg, primary, surface, accent. `font` takes `{label, display, body}`, a font-pairing entry, or `"Display / Body"`. |
| `mock` | HTML | the file is the artifact; `--screens "A,B"` fills the area selector |
| `plan` | Markdown | headings `##` and `###` each get a comment box |
| `message` | JSON `{text, progress?}` or `--text` | a status line with a spinner |
| `done` | Markdown or JSON `{markdown}` | closing summary |

Replies arrive as `{id, ts, stepId, kind, data}`: `answers` (`data.answers`), `choice` (`data.choice`, `data.comment`), `approve` and `changes` (`data.comments`, `data.screenNotes` or `data.sectionNotes`).

## Waiting for the owner
Preferred: run `studio tail` under the Monitor tool. Each reply is one line and wakes the session. Otherwise loop `studio wait --after <last id> --timeout 600`; exit code 2 means nothing arrived yet, so wait again and tell the owner the page is still open.

## Fallbacks
- No browser, a cloud session, or `studio start` fails: ask the same questions with AskUserQuestion in one batch (at most 4 per call), and show the sample as a file path.
- MulmoTerminal present: its `presentHtml` can show the sample in the side pane, and its Send button returns the decision as a chat message. Use it for the approval only; the intake still goes through the studio when a browser exists.

## Future: Claude Code channels
Claude Code plugins can declare a `channels` entry, an MCP server that pushes messages into a running session, which would wake an idle session without the Monitor tail. Not used yet: the feature is a research preview and needs a launch flag. Read the current docs at https://code.claude.com/docs/en/channels before adopting it. If adopted, the server would forward `inbox.jsonl` events as channel messages and `tail` would become unnecessary.
