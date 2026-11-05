# Evidence by kind of work

| Work | Strongest evidence | Also check |
|---|---|---|
| Library or backend logic | Test suite output with counts | Type-check and lint exit codes |
| HTTP API | A real request against the running server with status and body | Error path, auth path, OpenAPI diff if a spec exists |
| Database migration | Applied on a throwaway database, row counts before and after, rollback tried | Never claim a production migration without the owner's run output |
| Background job or workflow | A run started and completed, with its id and final status | Retry and duplicate delivery behaviour |
| Script or CLI | Run on sample input, exit code and output file inspected | Behaviour on missing input |
| Config or infrastructure | The tool's own plan or status command, then a live probe | Rollback path written down |
| Documentation | Every command in it executed once, every link opened | Screenshots current |
| Refactor | Same test suite green before and after, diff shows no behaviour change | Public interfaces unchanged |
| Cloud or remote run | Run id, status from the platform, pushed commits, branch name | The session link, as the owner cannot see it otherwise |
| Scheduled task | Next run time shown by the scheduler, and one forced run | No duplicate schedule exists |

When the best evidence needs something you cannot reach, report the strongest evidence you do have and hand the rest to the owner as a one-line command.
