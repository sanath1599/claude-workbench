---
name: deploying-to-a-vps
description: Use when deploying or fixing something on the owner's Ubuntu VPS: a Temporal worker, a Node or Python service, an nginx vhost, certbot, pm2, systemd or Docker, or when ssh deploys misbehave (nvm missing, worker not restarted, env values mangled). Not for Vercel deploys or the release gate, which is releasing-safely.
---

# Deploying to a VPS

The VPS hosts what Vercel cannot: always-on processes such as Temporal workers. Every step is a command with a check, and the production gate in `ops-and-sre:releasing-safely` applies before any of it.

## When to use

- First deploy of a service or worker to the VPS.
- A redeploy where the old version is still running, env values look wrong, or a worker is stale.
- Adding a subdomain with nginx and TLS.

## When not to use

- Frontends and FastAPI APIs that run on Vercel: `vercel:deployments-cicd`.
- Writing the procedure down: `ops-and-sre:writing-runbooks`.

## Procedure

1. **Pass the gate.** Infrastructure changes on the VPS need the owner's explicit yes each time: a new vhost, a new service, a DNS record, a paid resource. Send the `releasing-safely` gate message. Pick the host from `{{wb.vps_hosts}}` (ssh aliases); if none is configured, ask which. **Done when:** the yes names the host and the change.
2. **Inspect before touching.** Read the current state and write it down: `ssh <host> 'systemctl list-units --type=service --state=running | head -40; pm2 jls 2>/dev/null; docker ps; ls /etc/nginx/sites-enabled; df -h /; free -m'`. Check nothing is mid-job (long workflows, builds). **Done when:** you know what runs, on which ports, and how much room is left.
3. **Back up what you will change.** Copy the nginx vhost, the systemd unit, the pm2 dump (`pm2 save` output file) and the env file to `~/backups/<service>-<UTC timestamp>/` on the host. **Done when:** the files exist there.
4. **Choose the process manager the host already uses.** One per service, not two. systemd for new Python and Node services and for Temporal workers (restart on failure, journald logs, graceful stop). pm2 only where the host already runs everything in pm2. Docker only when the service ships as an image. **Done when:** you can name the manager and the unit or app name.
5. **Run commands over ssh without losing the Node environment.** Non-interactive ssh does not load nvm, so `node`, `npm` and `pm2` are missing. Wrap: `ssh <host> 'bash -ic "source ~/.nvm/nvm.sh && cd /srv/<app> && npm ci && npm run build"'`. Check with `ssh <host> 'bash -ic "source ~/.nvm/nvm.sh && node -v"'`. **Done when:** the version prints.
6. **Write env values safely.** systemd's `Environment=` and `EnvironmentFile=` strip unquoted backslashes: single-quote any value containing one. Next.js's env loader truncates a value at `#`: wrap such values in double quotes. After writing, verify without printing secrets: `systemctl show <unit> -p Environment | sed -E 's/=.*/=<set>/'` or check the length. Never `cat` the env file into the chat. File mode `600`, owned by the service user. **Done when:** the service reads the intended values, shown as set/length only.
7. **Deploy the code.** Sync to a new release directory (`rsync -a --delete ./ <host>:/srv/<app>/releases/<sha>/` excluding `.env`, `.git`, `node_modules`), install dependencies there (`uv sync --locked` or `npm ci`), then switch the `current` symlink and restart. Keep the last two releases for rollback. **Done when:** `current` points at the new release.
8. **Restart every process, not only the web one.** Deploy scripts often restart only the web process. List units and restart the worker too: `sudo systemctl restart <app>-web <app>-worker`; for pm2 `pm2 restart all --update-env`. Then confirm each one's start time changed: `systemctl show <unit> -p ActiveEnterTimestamp`. **Done when:** every process of the app has a start time after the deploy.
9. **Temporal worker as a managed service.** Use `assets/temporal-worker.service`: `Type=simple`, `Restart=always`, `RestartSec=5`, `KillSignal=SIGTERM`, `TimeoutStopSec` longer than the longest activity so in-flight work drains, `User=` a non-root account, `EnvironmentFile=` with mode 600, `After=network-online.target`. The worker is an outbound poller; it needs no inbound port and no nginx. Install: copy to `/etc/systemd/system/`, `sudo systemctl daemon-reload`, `sudo systemctl enable --now <unit>`. When workflow code changes, follow the worker-versioning rules in `releasing-safely`. **Done when:** `systemctl is-active <unit>` prints `active` and the worker appears on the task queue (`temporal task-queue describe` or the Temporal UI).
10. **Docker fallback.** If `docker compose build` hangs on base-image metadata pulls, build the image locally (`docker build --platform linux/amd64 -t <image> .`), `docker save <image> | ssh <host> docker load`, or `docker cp` the built output into the running container, then `docker compose up -d --no-build` or `docker restart <name>`. Record that you used the fallback. **Done when:** `docker ps` shows the new image id.
11. **nginx and TLS for web services.** One vhost per `<name>.{{wb.domain}}`, proxying to a localhost port: copy `assets/nginx-vhost.conf`, link it into `sites-enabled`, run `sudo nginx -t`, `sudo systemctl reload nginx`, then `sudo certbot --nginx -d <name>.{{wb.domain}}`. DNS for the subdomain (at {{wb.dns_provider}}) must exist first and is an infrastructure change needing its own yes. **Done when:** `curl -fsSI https://<name>.{{wb.domain}}/` returns 200 and the certificate is valid.
12. **Verify the new version is serving.** `curl -fsS https://<name>.{{wb.domain}}/api/version` must return the shipped SHA (add a marker endpoint if the service lacks one), and `ssh <host> 'journalctl -u <unit> -n 50 --no-pager'` shows a clean start. Only then make a request with side effects. **Done when:** URL, SHA and the log excerpt are in your report.

## Quick reference

| Problem | Fix |
|---|---|
| `node: command not found` over ssh | `bash -ic "source ~/.nvm/nvm.sh && ..."` |
| Worker still runs old code | restart the worker unit too; compare start times |
| Backslash vanished from env value | single-quote it in the unit or env file |
| Value cut at `#` | double-quote it for the Next.js loader |
| `docker compose build` hangs | build locally, load or `docker cp`, restart |
| Cert fails | DNS record missing or not propagated; nginx vhost has the right `server_name` |
| SSE or NDJSON arrives all at once | Caddy: `reverse_proxy app:3000 { flush_interval -1 }`. nginx: `proxy_buffering off; proxy_read_timeout 3600;` on that location, plus `X-Accel-Buffering: no` from the app |
| Client reconnects and loses events | Number events monotonically; on connect read `Last-Event-ID` (or `?after=`) and send missed events first |
| Uploads fail, app logs clean, 413 | nginx default `client_max_body_size` is 1 MB and answers before the app sees it. Set it (and `proxy_read_timeout`) in every upload vhost; the error log says `client intended to send too large body`. Show the reason in the UI |
| Large upload dies at a round number of seconds (408/499) | With `proxy_request_buffering off` the body is chunked and Node's `headersTimeout`/`requestTimeout` (60 s default) can still fire. Raise them or buffer in nginx; for big files, pre-signed object-storage upload or rsync, with only metadata through the app |
| 404/405 on POST after a frontend deploy | `VITE_*` and `NEXT_PUBLIC_*` are baked in at build: set them when building the image, with the scheme (`https://api...`), validate at startup; a change needs a rebuild, not a restart |
| Page loads, data empty, `/api/...` returns 200 HTML | A static SPA server with a fallback rule answers 200 `index.html` for unknown paths. Put the API proxy in the same nginx and check `curl -i /api/health` returns JSON |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "The web restarted, so it's deployed" | The worker is a separate process. Restart and check it. |
| "Edit nginx live, it's quick" | `nginx -t` first, back up the vhost, then reload. |
| "cat the env file to check it" | Check set/length only. Secrets stay out of output. |
| "Run as root, simpler" | Use a service user. |

## Verification

- [ ] Owner yes quoted for each infrastructure change
- [ ] Backups listed with paths
- [ ] Every process restarted; start times after the deploy
- [ ] Version marker equals shipped SHA; logs clean
- [ ] No secret printed anywhere

## References

| File | Load when |
|---|---|
| assets/temporal-worker.service | installing a worker as a systemd unit |
| assets/nginx-vhost.conf | adding a subdomain |
