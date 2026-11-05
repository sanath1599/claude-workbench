#!/usr/bin/env node
// Email the owner about high/critical vulnerabilities (and optionally a digest) via the Resend API.
// Env: RESEND_API_KEY (required), ALERT_EMAIL, ALERT_FROM, DIGEST=true to also send when only updates exist,
//      PR_URL (optional link to the maintenance PR). Never prints the key.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function buildEmail(report, { prUrl, digest } = {}) {
  const major = report.majorVulns || [];
  if (!major.length && !(digest && report.needsAttention)) return null;
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const subject = major.length
    ? `Workbench: ${major.length} high/critical vulnerabilit${major.length === 1 ? 'y' : 'ies'} in tracked packages`
    : `Workbench maintenance: ${report.updates.length} update(s) to review`;
  const rows = (items, f) => (items.length ? `<ul>${items.map((i) => `<li>${f(i)}</li>`).join('')}</ul>` : '<p>None.</p>');
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#111">
<p><strong>${esc(subject)}</strong> (${esc(report.date)})</p>
<h3 style="font-size:15px">High and critical vulnerabilities</h3>
${rows(major, (v) => `${esc(v.package)}: <a href="${esc(v.url)}">${esc(v.id)}</a> ${esc(v.severity)}, ${esc(v.summary)}`)}
<h3 style="font-size:15px">Package updates</h3>
${rows(report.updates || [], (u) => `${esc(u.name)} ${esc(u.from)} to ${esc(u.to)}${u.major ? ' (major)' : ''}`)}
${prUrl ? `<p>Review the maintenance PR: <a href="${esc(prUrl)}">${esc(prUrl)}</a></p>` : ''}
<p style="color:#555">Sent by the daily workbench maintenance workflow.</p></div>`;
  return { subject, html };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const report = JSON.parse(readFileSync(join(ROOT, 'maintenance', 'out', 'report.json'), 'utf8'));
  const email = buildEmail(report, { prUrl: process.env.PR_URL, digest: process.env.DIGEST === 'true' });
  if (!email) {
    process.stdout.write('Nothing to email.\n');
    process.exit(0);
  }
  if (!process.env.RESEND_API_KEY) {
    process.stderr.write('RESEND_API_KEY is not set; cannot send the alert.\n');
    process.exit(1);
  }
  const to = process.env.ALERT_EMAIL;
  const from = process.env.ALERT_FROM;
  if (!to || !from) {
    process.stderr.write('ALERT_EMAIL and ALERT_FROM must be set.\n');
    process.exit(1);
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json', 'idempotency-key': `workbench-maintenance/${report.date}/${email.subject.length}` },
    body: JSON.stringify({ from, to: [to], subject: email.subject, html: email.html }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.id) {
    process.stderr.write(`Resend refused the email: ${res.status} ${body.name || ''} ${body.message || ''}\n`);
    process.exit(1);
  }
  process.stdout.write(`Alert sent (id ${body.id}).\n`);
}
