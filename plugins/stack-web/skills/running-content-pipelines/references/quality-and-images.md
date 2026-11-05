# Quality bar and images

## Honesty rules for unattended content

- Every number, quote and date comes from a page opened in this run, with the retrieval date noted.
- A page that cannot be fetched (403) is not cited; its claim is left out or labelled unconfirmed.
- Label derived figures "our arithmetic" and benchmarks "vendor-reported".
- Public statements about the site stay literally true: no human byline or "reviewed by" unless a record exists.
- A draft that fails the bar is dropped, not padded. Logging "nothing published, because ..." is a valid result.

## Images

- Diffusion models cannot process negation: "not a brain" draws two brains. Prompt with positive description only.
- If the API returns a fixed square size, prompt for a band composition and centre-crop to the layout ratio.
- Results are not reproducible. Open every generated file, check for stray text and bad cropping, regenerate (cap the attempts), then write alt text from what is really in the picture.
- Accept only models whose licence allows the use; keep an allowlist in code.
- Never loop on a provider that answers "quota 0": record it and switch provider.
- Charts that carry numbers are built from data, never generated.

## When an upgrade removes a capability you rely on

Extract the last good release into a persistent folder (not `/tmp`), verify its checksum against the published digest, and run it on its own port. Stop both the server and its runner process afterwards: an orphaned runner can hold many gigabytes of RAM. Leave the normal install alone, and note the date and when to re-check whether upstream restored the feature. This is debt, not a solution.
