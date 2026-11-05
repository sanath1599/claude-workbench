---
name: sending-push-notifications
description: Use when a mobile app needs push notifications, reminders, alerts, a notification permission prompt, notification taps that open a screen, Expo push tokens, FCM or APNs setup, or quiet hours. Covers sending from the owner's FastAPI backend. Not for email or SMS (stack-web:sending-email-with-resend) or in-app toasts (designing-native-ui).
---

# Sending push notifications

Use the Expo push service by default: one API for iOS and Android, receipts included. Ask for permission in context, store tokens per device on the server, check receipts, and drop dead tokens. Real pushes to real users need the owner's yes.

## When to use

- Adding notifications to an Expo app, or fixing one that does not arrive.
- Sending from FastAPI or a worker, with retries and receipts.
- A notification tap that must open a specific screen.
- Quiet hours, per-topic preferences, or testing without spamming people.

## When not to use

- Email or SMS: `stack-web:sending-email-with-resend`.
- Local confirmation inside the app: toasts in `stack-mobile:designing-native-ui`.
- Long-running scheduled work itself: `stack-python:orchestrating-with-temporal` (it can call the send function).

## Choice: Expo push service or direct

| Option | Pick when | Cost |
|---|---|---|
| Expo push service | Default. Expo app, both platforms, small team | Free to send; needs FCM and APNs credentials set up once |
| FCM and APNs directly | You must avoid a third party, need features Expo's API lacks, or already run a notification service | More server code: two providers, token types, per-platform payloads |

State the choice and reason in one line. The rest of this skill assumes Expo push; direct sending changes only steps 4 to 6.

## Procedure

1. **Plan the notification types.** List each type, its trigger, audience, deep link target, and whether the user can turn it off. A notification that does not lead to an action is a candidate for deletion. **Done when:** a table of types exists in the README or a spec.
2. **Set up credentials (owner machine).** A development build is required on Android and recommended everywhere; push does not work in Expo Go on Android. Add the `expo-notifications` config plugin, run `eas credentials` to create the iOS push key and upload the Android FCM V1 service account key. These are owner-machine steps: give the exact commands as `! eas credentials` and never print or commit keys. Enable the push-security access token in the Expo dashboard and keep it in the server's env.
3. **Ask for permission in context.** Never on first launch. Show your own explanation screen at the moment of value ("Get a reminder before it is due"), then call the system prompt. Handle denied (offer a link to settings, keep the feature usable) and never re-prompt after denial. Create the Android notification channel(s) before requesting a token. Code in `references/client.md`.
4. **Register the token.** Get the Expo push token with the EAS `projectId`, send it with the device id and platform to the backend after sign-in, and refresh it on launch (tokens can change). Physical device only. Remove the token on sign-out.
5. **Send from the server.** Batch up to 100 messages per request to `https://exp.host/--/api/v2/push/send` with the access token, keep payloads under 4 KiB, use `data` for the deep link, `channelId` for Android, and a `ttl` that matches how long the message stays useful. Retry 429 and 5xx with exponential backoff and jitter; do not retry malformed 4xx. Code in `references/server.md`.
6. **Process tickets and receipts.** Store ticket ids; about 15 minutes later fetch receipts (they expire after 24 hours). On `DeviceNotRegistered` delete that token. On `MessageRateExceeded` slow down. An `ok` ticket means Expo accepted it, not that the phone got it. **Done when:** a test run shows a ticket stored, a receipt read, and a dead token removed.
7. **Handle taps and foreground.** Set a notification handler for foreground display, listen for responses, and route with Expo Router from `data.url` after validating it against an allowlist of internal paths. Handle the cold-start case with `useLastNotificationResponse`. Clear the badge when the relevant screen opens.
8. **Quiet hours and preferences.** Store each user's timezone and quiet window server-side (fall back to `{{wb.timezone}}` only when unknown); the sender defers non-urgent types to the window end. Provide per-type switches in a settings screen, cap frequency, and merge bursts into one summary message instead of many.
9. **Test safely.** Unit-test the sender against a recorded fake of the Expo API; tests never call the real push service or real users. Manual checks use the owner's own device and Expo's push tool. Sending to real users is a production action: state the audience size and wait for the owner's yes.
    **Done when:** a push sent to the owner's test device opens the right screen from a killed app, a backgrounded app and the foreground, and evidence (ticket id, receipt status, screen recording or screenshot) is attached.

## Quick reference

| Item | Value |
|---|---|
| Send | `POST https://exp.host/--/api/v2/push/send` |
| Receipts | `POST https://exp.host/--/api/v2/push/getReceipts` |
| Batch | 100 messages per send, 1000 ids per receipts call |
| Rate | 600 notifications per second per project |
| Payload | 4 KiB max |
| Receipts window | check after ~15 min; kept 24 h |
| Dead token | `DeviceNotRegistered`: delete it |
| Retry | 429 and 5xx with backoff; never malformed 4xx |

## Rationalizations

| Excuse | Do instead |
|---|---|
| "Ask for permission on launch." | Ask in context after an explanation screen. |
| "The ticket was ok, so it was delivered." | Read the receipt; even then it only means FCM or APNs accepted it. |
| "Send to everyone to test." | Send to a test device; broadcast needs the owner's yes. |
| "Put the deep link in the title." | Put it in `data`, validate against an allowlist. |

## Verification

- Credentials were set by the owner; no key in the repo or logs.
- Permission is requested in context; denial path works.
- Server batches, retries with backoff, stores tickets, reads receipts, prunes dead tokens.
- Taps route correctly from killed, background and foreground states.
- Quiet hours and per-type switches exist; tests use a fake Expo API.

## References

| File | Load when |
|---|---|
| references/client.md | writing permission, token registration, handlers, deep link routing |
| references/server.md | writing the FastAPI sender, receipts job, quiet hours, direct FCM/APNs notes |

## Versions

- expo-notifications 58.1.8, expo-device 58.0.5 (verified 2026-11-05, https://docs.expo.dev/versions/latest/sdk/notifications/)
- Expo push API limits: 100 per request, 600 per second per project, 4 KiB, receipts after about 15 minutes (verified 2026-11-05, https://docs.expo.dev/push-notifications/sending-notifications/)
- expo-server-sdk 8.0.0 for Node (verified 2026-11-05, https://www.npmjs.com/package/expo-server-sdk)
