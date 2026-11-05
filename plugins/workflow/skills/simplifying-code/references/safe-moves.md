# Safe and unsafe moves

## Normally safe (with green tests)

- Rename a local variable or a private function.
- Replace nested ifs with guard clauses when every branch keeps the same return and side effects.
- Extract a pure block into a function with the same inputs.
- Delete code that nothing references (confirm with a repo-wide search, including dynamic use such as string-built names, reflection, route tables and config).
- Replace a loop with a map or filter when there are no side effects inside.
- Inline a variable used once.

## Can change behaviour: check first

| Move | Risk |
|---|---|
| Reordering statements | Side-effect order, short-circuit evaluation, timing |
| Merging two similar functions | The small difference between them was deliberate |
| `==` to `===`, truthiness changes | Different coercion |
| Swapping `||` for `??` | Zero, empty string and false now pass through |
| Making something async, or removing async | Error handling and ordering change |
| Catching fewer or more errors | Failures change from handled to crashes or the reverse |
| Changing default arguments | Callers that relied on them |
| Changing sort or dedupe code | Stability and ordering |
| Renaming exports, routes, config keys, JSON fields, columns | Outside callers break |

## Leave alone

Generated files, vendored code, migrations that already ran, snapshots, lockfiles, and anything the owner has said is intentionally written a certain way.
