---
runs: 2
max_turns: 6
allowed_tools: Read, Glob, Grep, Bash, Skill
tags: [engineering, positive, distributed]
---

We are adding Stripe-style payment webhooks to our FastAPI backend. When a "payment succeeded" event arrives we mark the order paid, send a receipt email through Resend, and enqueue fulfilment. The provider retries failed deliveries for days. Design how the webhook endpoint should work. Design only, no code files.
