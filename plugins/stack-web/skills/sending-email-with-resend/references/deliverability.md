# Deliverability and templates

## Before the first production send on a new sending subdomain

- SPF and DKIM show verified in the Resend dashboard (records: `stack-web:adding-subdomains`).
- A DMARC record is published; start with `p=none` and a report address.
- The return-path subdomain is set; links and images point at the same organisation's domain.
- Transactional and marketing mail use different subdomains.
- Anything not strictly transactional carries a plain-text part and a working unsubscribe.
- `email.bounced` and `email.complained` webhooks add the address to a suppression table, and nothing mails a suppressed address again.

## React Email

For rich templates use React Email components. `npx create-email@latest` starts the preview server; render to HTML plus a text version with the package's render function, or pass `react:` in Node. Check client rendering in the preview, keep styles inline through the Tailwind component rather than hand-written table markup, and pin `react-email` and `@react-email/components`.

## CLI in scripts and CI

Use the `resend` CLI non-interactively with `RESEND_API_KEY` in the environment, and a domain-scoped sending key where possible. Never pass a key as an argument. Ask the owner before creating or deleting domains, keys or broadcasts.

## Safe local approval flows

Add one env switch that redirects every outgoing message to a test address (`MAIL_TEST_TO`, or `delivered@resend.dev`), and give the local server its own store prefix (`dev/`) so approval flows run end to end without live data. Send the plain-text part too, and HTML-escape every interpolated value in the HTML body.
