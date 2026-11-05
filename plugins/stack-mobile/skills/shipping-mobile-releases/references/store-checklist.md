# Store listing checklist and review pitfalls

Sources: https://developer.apple.com/app-store/review/guidelines/ , https://support.google.com/googleplay/android-developer/ . Both change; re-read the sections for the features you use. Account fees and new-account testing requirements change too: confirm them in the consoles before promising dates.

## Listing

| Item | Notes |
|---|---|
| Name, subtitle / short description | No keyword stuffing, no competitor names |
| Description, what's new | Plain words; no unverified claims or invented metrics |
| Screenshots | Required device sizes for each store; real UI, fictional data; no device art with another brand |
| Icon | 1024 x 1024 for iOS, 512 x 512 for Play; no transparency on iOS |
| Privacy policy URL | Public, on `{{wb.domain}}`, matches what the app does |
| Data safety / privacy labels | Declare every SDK's collection, including analytics and crash reporting |
| Age rating, content questionnaire | Answer honestly |
| Support URL and contact | A monitored address from `{{wb.email_from}}`'s domain |
| Review notes | Demo account, how to reach every feature, hardware needed |
| Export compliance | Answer the encryption question; set `ITSAppUsesNonExemptEncryption` accordingly |
| Permission strings | Specific: "Used to scan receipts", not "Needs camera" |
| Account deletion | In-app path and a web URL if the app has sign-up |
| Tracking | App Tracking Transparency prompt only if you track |

## Frequent rejection reasons

- Crashes or placeholder content at review time; a broken demo login.
- Login required with no demo credentials, or a backend that is down or geo-blocked.
- Missing account deletion; privacy policy missing or inconsistent with labels.
- Vague or missing permission purpose strings; requesting permissions that are not used.
- Web view wrapper with little native value; links to external purchase flows where in-app purchase rules apply.
- Sign in with Apple required when other third-party social sign-ins are offered (check the current rule for your case).
- Android: target API level below the current requirement; undeclared sensitive permissions; data safety form mismatch.
- Metadata that mentions other platforms or unreleased features.

## Submit sequence

1. Internal test build confirmed on devices.
2. Listing and labels complete; screenshots attached.
3. Gate message sent; owner's yes received.
4. `eas submit`; iOS set to manual release; Play staged rollout at a small percentage.
5. Watch review status; answer in the resolution centre politely and specifically.
6. After release: crash-free rate, ratings, support inbox for 48 hours; widen the rollout.
