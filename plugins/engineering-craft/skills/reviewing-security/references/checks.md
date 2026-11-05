# Check details and fixes

## IDOR / missing ownership filter

Vulnerable:

```python
@router.get("/interviews/{interview_id}")
async def get(interview_id: UUID, user=Depends(current_user)):
    return await db.fetchrow("select * from interviews where id=$1", interview_id)
```

Fixed: filter by the caller's scope in the same query, and return 404 when nothing matches.

```python
row = await db.fetchrow("select * from interviews where id=$1 and org_id=$2", interview_id, user.org_id)
if row is None:
    raise HTTPException(404)
```

Test: log in as a user of another organisation and request the same id; expect 404. Do this for every route that takes an id.

## SSRF guard

Resolve the hostname yourself, reject every address that is private, loopback, link-local, multicast, reserved or the cloud metadata address, then connect to the resolved address (to defeat DNS rebinding). Re-check on every redirect or disable redirects. Use `ipaddress.ip_address(addr).is_global`. Cap response size and time.

## Upload validation

Read at most the size limit plus one byte; reject above it. Sniff the content type from the bytes (magic numbers), compare with an allowlist, ignore the client filename and content type. Store under a generated name in private storage. Serve with `Content-Disposition: attachment` unless the type is known-safe, and with `X-Content-Type-Options: nosniff`.

## Cookies and CSRF

`Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=...`. State-changing requests authenticated by cookie also need a CSRF token or an `Origin` check. Bearer-token APIs are not CSRF-prone but are exposed to XSS token theft if stored in `localStorage`.

## CSP starting point

`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.example.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`. Tighten from report-only logs first. Vite and Vercel need the exact script hashes or nonces if you inline anything.

## Prompt injection review questions

- Which model calls include text a third party wrote?
- What tools or side effects can those calls trigger?
- Is output validated against a schema before it is acted upon?
- Can the output influence a URL, file path, query, email recipient or code to run?
- Is there a test fixture with an injection attempt?

## Dependency advisories

Run the ecosystem's audit (`npm audit --omit=dev`, `pip-audit`). Triage by reachability: an advisory in a dev-only or unused code path is low; a reachable remote-code or auth bypass is high. Pin fixes in the lockfile.

## Serving generated HTML

Serve model-generated HTML from a route that sets `Content-Security-Policy: sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:` and embed it in `<iframe sandbox="allow-scripts">` without `allow-same-origin`. Render model-written Markdown as React elements, never `dangerouslySetInnerHTML`. Set `X-Frame-Options: DENY`, `nosniff` and `Referrer-Policy: same-origin` on every other route. Other users get 404, not 403, for resources they do not own.

## Untrusted repositories

After cloning for read-only use: delete `.git`; delete `.env*` (except example, sample, template, dist, defaults), private keys and keystores (`*.pem *.key *.p12 *.pfx *.jks *.ppk`, `id_rsa*`, `id_ed25519*`), credential files (`.npmrc .netrc .pypirc .git-credentials`, `credentials` or `secrets` json/yaml/toml, `service-account*.json`); delete any symlink whose `realpath` leaves the root, and dangling ones. Report removed paths, never contents. At read time call `resolveInside(root, rel)` (realpath plus prefix check) and `lstat`, so a symlink planted later is still refused. For zip uploads, reject `..`, absolute paths, and total-size or entry-count overruns before extracting. Pass credentials for other hosts to git as a per-host `http.extraHeader` through environment variables, never argv or `.git/config`, and strip the secret and its base64 from error text.

## Containers started by the app

An app that starts per-job containers needs the host Docker socket, which is root on that host. Use a dedicated host or a socket proxy that permits only create, start, kill and remove; label every job container so cleanup finds them; and run with `--network none` (for verification jobs), `--read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges`, plus pids, memory and cpu limits and a non-root `--user`. Dev-only switches (a local runner mode, an auth bypass) must refuse to work when `NODE_ENV=production`.
