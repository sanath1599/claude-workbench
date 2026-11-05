# Flows

## OIDC sign-in with PKCE

```tsx
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
WebBrowser.maybeCompleteAuthSession();

export function useSignIn() {
  const discovery = AuthSession.useAutoDiscovery(process.env.EXPO_PUBLIC_OIDC_ISSUER!);
  const redirectUri = AuthSession.makeRedirectUri({ scheme: "example", path: "auth" });
  const [request, , promptAsync] = AuthSession.useAuthRequest(
    { clientId: process.env.EXPO_PUBLIC_OIDC_CLIENT_ID!, redirectUri, scopes: ["openid", "profile", "email", "offline_access"] },
    discovery,
  );
  return async () => {
    const res = await promptAsync();
    if (res.type !== "success") return null;
    // send code + request.codeVerifier to the backend, which exchanges it and returns app tokens
    return { code: res.params.code, verifier: request!.codeVerifier!, redirectUri };
  };
}
```

The client id is public. Send the code and verifier to the backend, which talks to the provider (using any client secret it holds) and returns the app's own access and refresh tokens. Handle `res.type === "cancel"` and `"error"` with a plain message and retry button.

## Magic link or one-time code

1. App posts the email to the backend; the backend sends the link or a 6-digit code (email provider per `{{wb.email_provider}}`; never from tests).
2. Link: `example://auth/verify?token=...` opens `app/auth/verify.tsx`, which posts the token to the backend and receives app tokens. Tokens are single use, expire in 10 minutes, and are stored hashed.
3. Code: a numeric input with `textContentType="oneTimeCode"` and `autoComplete="sms-otp"` for autofill. Rate-limit by email and IP on the server.

## Refresh client

```ts
import * as SecureStore from "expo-secure-store";
let refreshing: Promise<string | null> | null = null;

async function refresh(): Promise<string | null> {
  const rt = await SecureStore.getItemAsync("refresh_token");
  if (!rt) return null;
  const r = await fetch(`${BASE}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: rt }) });
  if (!r.ok) { await SecureStore.deleteItemAsync("refresh_token"); return null; }
  const j = await r.json();
  await SecureStore.setItemAsync("refresh_token", j.refresh_token); // rotated
  return j.access_token as string;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${accessToken}` } });
  if (res.status === 401 && retry) {
    refreshing ??= refresh().finally(() => { refreshing = null; });
    const t = await refreshing;
    if (!t) throw new SignedOut();
    accessToken = t;
    return api<T>(path, init, false);
  }
  if (!res.ok) throw new ApiError(res.status);
  return res.json();
}
```

Keep the access token in memory; only the refresh token is persisted. On a network error (not a 401), do not sign out.

## Biometric gate

```ts
import * as LocalAuthentication from "expo-local-authentication";
export async function unlock(): Promise<boolean> {
  if (!(await LocalAuthentication.hasHardwareAsync()) || !(await LocalAuthentication.isEnrolledAsync())) return true; // fall back to the existing session
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock the app", fallbackLabel: "Use passcode" });
  return r.success;
}
```

Trigger on `AppState` change to active after a configurable time in the background (default 5 minutes). Show a blank lock screen while locked so the task switcher does not reveal content.

## Server side

- FastAPI: a dependency validates the bearer token on every route; refresh tokens are stored hashed, rotated on use, and grouped in a family that is revoked when an old token is replayed.
- TanStack Start: server functions read the same bearer header; share the verification code in a package.
- Return a stable error shape (`{"code": "token_expired"}`) so the client can distinguish refreshable from fatal.
