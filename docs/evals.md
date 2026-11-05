# Eval results

Each case runs twice with `claude plugin eval`: once with the plugin and once without (the baseline). The difference shows what the plugin changes.

| Date | Plugin | Case | With plugin | Without | Cost |
|---|---|---|---|---|---|
| 2026-11-05 | kickoff | new-project-asks-cloud: the cloud-handoff question comes first at kickoff | 1.0 | 0.0 | $0.09 |
| 2026-11-05 | workbench | toast-after-save: sileo, not sonner, with sentence-case titles | 1.0 | 0.0 | $0.08 |
| 2026-11-05 | workbench | near-miss-explain-regex: no workbench skill fires on a trivia question | 1.0 | 1.0 | $0.06 |

Run settings: sonnet, 1 run per arm. Re-run before releasing big changes:

```bash
claude plugin eval plugins/<plugin> --runs 2 --model sonnet --no-publish
```

`--case` takes a single glob; repeat the command for each case.
