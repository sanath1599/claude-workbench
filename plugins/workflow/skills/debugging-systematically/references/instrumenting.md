# Instrumenting and narrowing

## Boundary probes

When a value travels through several layers (browser, API, service, database, queue), print what each boundary receives and returns, once, in a single run, with a marker prefix such as `DBG:` so you can grep and delete them. Read the output top to bottom: the first wrong value tells you which layer to open.

- Log shapes and lengths, not secrets. Mask tokens and keys.
- Print the environment variables a layer reads by name and whether they are set, never their values.
- Remove every probe before committing: `git diff | grep DBG:` must return nothing.

## git bisect

```
git bisect start
git bisect bad            # current commit fails
git bisect good <sha>     # last known good
git bisect run <red-loop-command>
git bisect reset
```

The red loop must exit non-zero on failure and zero on success, and must not depend on files outside the checkout. If a commit cannot build, `exit 125` skips it.

## Flaky tests

1. Run the test alone, 50 times, in a loop. If it never fails alone, it depends on order or shared state: run the whole file, then the suite, with a fixed order and then a shuffled one.
2. Print the random seed and the clock source. Pin both.
3. Look for: shared module state, leftover rows or files, unawaited promises, timers, ports, network calls that should be mocked, locale and time zone.
4. Replace sleeps with waits on a condition. Do not raise a timeout to make it pass.

## Shrinking input

Halve the input (rows, lines, fields, steps) and rerun. Keep the half that still fails. Stop when removing anything makes it pass. The result is usually the test case.

## Performance

Measure before changing anything: a timing log around the suspect call, a profiler, or the browser performance panel. Record the number before and after the change. A change with no measured effect is reverted.
