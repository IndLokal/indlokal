# TDD-0008: Mobile auth

- **Status:** Draft
- **Linked PRD:** PRD-0008
- **Depends on:** TDD-0001

## 1. Architecture overview

- `apps/mobile/lib/auth/`:
  - `client.ts` — single-flight refresh, token store in SecureStore.
  - `apple.ts` — `expo-apple-authentication`.
  - `google.ts` — `expo-auth-session/providers/google` with native code via `@react-native-google-signin/google-signin`.
  - `magic.ts` — POST request, deep-link verify.
- Universal Links / App Links configured for `https://indlokal.com/auth/magic` and `/auth/google/callback`.

## 2. Data model changes

- See TDD-0001 (`User.appleId`, `RefreshToken`).

## 3. API surface

Reuses TDD-0001.

## 4. Mobile screens & navigation

```
auth/
  sign-in.tsx
  magic-link-sent.tsx
  onboarding/city.tsx
  onboarding/persona.tsx
me/
  profile.tsx
  delete-account.tsx
```

## 5. Push / Email / Inbox triggers

- Magic link uses existing `src/lib/email.ts`.
- On account creation: enqueue `D0_WELCOME` email (topic=`REENGAGEMENT` → split later).

## 6. Feature flags

- `auth.apple.enabled` (iOS only)
- `auth.google.enabled`
- `auth.magic.enabled`

## 7. Observability

- `auth.signin.started{method}`, `auth.signin.success{method}`, `auth.signin.failed{method,reason}`.

## 8. Failure modes & fallbacks

- Apple/Google SDK error → fall back to magic link.
- Magic link expired → resend CTA.
- Universal Link not installed handler → deep-link via `indlokal://` custom scheme as fallback.

## 9. Test plan

- Unit: token store, single-flight refresh.
- E2E: each method on iOS + Android.
- Manual: account deletion path with cascading wipes.

## 10. Rollout plan

- Magic link first; then Google; Apple at App Store submission.

## 11. Backout plan

- Disable a method via flag.
