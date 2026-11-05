# Approval by emailed link

- Link token: `HMAC-SHA256(secret, id + "|" + lowercase(email))`, one per approver, compared with `timingSafeEqual` after a length check. Reject ids that fail a strict regex before any storage read. Store a 7-day expiry in the record and check it server side.
- The link opens a page (GET) that changes nothing. Confirm and reject are POST forms, because mail scanners and link previewers prefetch GET.
- Write each decision once with overwrite disallowed. The first writer wins; a loser sees an "already decided by X" page. Give every state (approved, rejected, withdrawn, outdated, expired) its own page.
- After a decision, mail every approver the outcome.
- An agent that drafts the proposal never gets a send-email tool. Only a person pressing a button creates the proposal and sends the mail.
- When state lives on an object store, see the versioned-state pattern in `hardening-distributed-systems`.
