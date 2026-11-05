# EAS configuration

Docs: https://docs.expo.dev/build/eas-json/ . Fields not covered on that page (`channel`, `autoIncrement`, submit) are in the schema reference linked from it.

## eas.json

```json
{
  "cli": { "version": ">= 27.0.0", "appVersionSource": "remote" },
  "build": {
    "base": { "node": "22.13.0" },
    "development": {
      "extends": "base",
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": false },
      "env": { "EXPO_PUBLIC_API_URL": "https://api.staging.{{wb.domain}}" }
    },
    "e2e-test": {
      "extends": "base",
      "withoutCredentials": true,
      "ios": { "simulator": true },
      "android": { "buildType": "apk" },
      "env": { "EXPO_PUBLIC_API_URL": "https://api.staging.{{wb.domain}}" }
    },
    "preview": {
      "extends": "base",
      "distribution": "internal",
      "channel": "preview",
      "env": { "EXPO_PUBLIC_API_URL": "https://api.staging.{{wb.domain}}" }
    },
    "production": {
      "extends": "base",
      "channel": "production",
      "autoIncrement": true,
      "env": { "EXPO_PUBLIC_API_URL": "https://api.{{wb.domain}}" }
    }
  },
  "submit": {
    "production": {
      "ios": { "ascAppId": "REPLACE_WITH_APP_STORE_CONNECT_APP_ID" },
      "android": { "track": "internal", "releaseStatus": "draft" }
    }
  }
}
```

Notes:

- Only public values in `env`. Secrets used by build tooling go in EAS environment variables with secret visibility (`eas env:create`), never in the file or behind `EXPO_PUBLIC_`.
- Android submit defaults to the internal track as a draft so nothing reaches users without a console action by the owner.
- Use a staging API for `development` and `preview`, production API only for `production`.
- Pin the Node version so local and cloud builds agree.

## app.config.ts fields that matter to releases

```ts
updates: { url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}` },
runtimeVersion: { policy: "fingerprint" },
ios: { bundleIdentifier, infoPlist: { ITSAppUsesNonExemptEncryption: false } },
android: { package },
```

`eas update:configure` writes `updates.url` and the runtime setting for you. Set `ITSAppUsesNonExemptEncryption` only if true: standard HTTPS usage is generally exempt, but answer the export compliance question honestly and check the current Apple wording.

## Runtime version policies

| Policy | Meaning | Use |
|---|---|---|
| `fingerprint` | new runtime whenever anything affecting native code changes | default; safest, more builds |
| `appVersion` | runtime follows `version` | fine if every native change bumps `version` |
| fixed string | you manage it | avoid |

Preview what changed: `npx @expo/fingerprint` (see its docs) or `eas fingerprint:compare`; check `eas --help` for the current subcommands.

## Build workflow on CI

Prefer EAS Workflows (`.eas/workflows/`) or GitHub Actions calling `eas build --non-interactive --no-wait` with `EXPO_TOKEN` in the CI secret store. A production build job triggers only from a tag or a manual dispatch, and never submits.
