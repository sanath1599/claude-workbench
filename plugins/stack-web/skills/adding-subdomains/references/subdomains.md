# Subdomain registry

Names under `{{wb.domain}}`. Targets are types only. Read the live target from Vercel or the server; never store IPs or secrets here. Update this table when adding a name.

| Name | Host | Record type | Notes |
|---|---|---|---|
| `{{wb.domain}}` (apex) | Vercel | A, from Vercel | main site |
| `www` | Vercel | CNAME, DNS-only | redirects with the apex |
| `app` | VPS | A, DNS-only | nginx + certbot on the owner's VPS |
| `status` | Vercel | CNAME, DNS-only | |
| `careers.acme` | Vercel | CNAME, DNS-only | two labels: client-scoped app |

Other names may already exist on the VPS (it hosts several apps). Always run the `dig` and `list` checks before trusting this table.
