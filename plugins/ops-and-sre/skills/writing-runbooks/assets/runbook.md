# <Runbook title>

Last verified: YYYY-MM-DD

Purpose: <one sentence>

Use this when: <alert name or symptom>

## Before you start

- Access: <what you need and how to get it>
- Run from: <your laptop | the VPS via `ssh <alias>`>
- Tools: <list>

## Steps

1. <One action.>

   ```bash
   <exact command>
   ```

   Expected: <exact output, status or marker>

2. <One action.>

## Check it worked

```bash
curl -fsS https://<name>.<domain>/api/version
```

Expected: `sha` equals `<commit>`.

## Roll back

```bash
<exact command>
```

## Who to tell

<owner, channel, message in plain words>
