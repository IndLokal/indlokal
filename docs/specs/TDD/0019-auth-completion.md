# TDD-0019: Auth Completion - Onboarding, Session Restore, Profile & Account Management

- **Status:** Draft
- **Linked PRD:** PRD-0019
- **Owner:** Mobile Lead / Backend Lead
- **Depends on:** TDD-0001, TDD-0008

## 1. Architecture overview

```
packages/shared
  src/contracts/auth.ts        + OnboardingUpdate schema

apps/web
  src/app/api/v1/me/
    route.ts                   + DELETE handler
    onboarding/route.ts        new - PATCH /api/v1/me/onboarding

apps/mobile
  lib/auth/
    AuthContext.tsx             new - React Context + useAuth()
  app/
    _layout.tsx                 + AuthProvider wrap + onboarding gate
    auth/
      sign-in.tsx               onboarding-aware routing post-auth
      magic-link/verify.tsx     onboarding-aware routing post-verify
      onboarding/
        city.tsx                cities API picker + save cityId
        persona.tsx             multi-select + PATCH /api/v1/me/onboarding
    (tabs)/
      me.tsx                    auth-aware (sign-in CTA vs. profile links + sign-out)
      bookmarks.tsx             auth gate (sign-in CTA vs. saved items)
    me/
      profile.tsx               useAuth() + sign-out
      delete-account.tsx        DELETE /api/v1/me + SecureStore clear
```

## 2. Data model changes

No schema migrations - all required columns already exist in `users`:

- `city_id` (nullable)
- `persona_segments` (string array)
- `preferred_languages` (string array)
- `onboarding_complete` (boolean, default false)
- `display_name` (nullable)

`PATCH /api/v1/me/onboarding` writes all five fields and flips `onboarding_complete = true`.

`DELETE /api/v1/me`:

1. `db.refreshToken.updateMany` - revoke all active refresh tokens for user
2. `db.user.delete` - cascades to `MagicLinkToken`, `RefreshToken`, `UserInteraction`,
   `SavedCommunity`, `SavedEvent`, `Device`, `NotificationPreference`, `QuietHours`,
   `NotificationOutbox`, `InboxItem` (all carry `onDelete: Cascade`)

## 3. API surface

### Zod schemas - `packages/shared/src/contracts/auth.ts`

```typescript
export const OnboardingUpdate = z.object({
  cityId: Cuid.optional(),
  displayName: z.string().min(1).max(80).trim().optional(),
  personaSegments: z.array(z.string().min(1).max(40)).max(10).optional(),
  preferredLanguages: z.array(z.string().min(2).max(10)).max(10).optional(),
});
export type OnboardingUpdate = z.infer<typeof OnboardingUpdate>;
```

### Endpoint table

| Method | Path                    | Auth   | Request            | Response    |
| ------ | ----------------------- | ------ | ------------------ | ----------- |
| PATCH  | `/api/v1/me/onboarding` | Bearer | `OnboardingUpdate` | `MeProfile` |
| DELETE | `/api/v1/me`            | Bearer | -                  | `Ack`       |

### PATCH /api/v1/me/onboarding - detail

- Validates `cityId` against the `cities` table (must be active).
- Updates `cityId`, `displayName`, `personaSegments`, `preferredLanguages` (only fields
  present in request body - partial update semantics).
- Always sets `onboardingComplete = true` on success.
- Returns the updated `MeProfile`.

### DELETE /api/v1/me - detail

- Requires `Bearer` token (requireAccessToken).
- Revokes all non-revoked `RefreshToken` rows for the user.
- Deletes the `User` row (cascades to all related tables via Prisma).
- Returns `{ ok: true }`.
- Mobile client clears `SecureStore` on success and navigates to `auth/sign-in`.

## 4. Mobile screens & navigation

### New navigation graph (post-0019)

```
Cold launch
  └─ AuthProvider restores tokens
       ├─ No tokens               → initial Expo Router route (Discover tab)
       ├─ Valid access token      → check onboardingComplete
       │    ├─ false              → /auth/onboarding/city
       │    └─ true               → stay (already on tabs)
       └─ Expired, refresh ok     → same check as above
       └─ Refresh fails           → tokens cleared, stay on Discover

Successful sign-in (any method)
  └─ tokens.user.onboardingComplete?
       ├─ false  → /auth/onboarding/city
       └─ true   → /(tabs)

/auth/onboarding/city
  └─ city selected + Continue → /auth/onboarding/persona

/auth/onboarding/persona
  └─ Done → PATCH /api/v1/me/onboarding → /(tabs)
```

### Screen inventory

| Path                      | Auth required | Changes                                                        |
| ------------------------- | ------------- | -------------------------------------------------------------- |
| `auth/sign-in`            | No            | Route to onboarding or tabs based on `user.onboardingComplete` |
| `auth/magic-link/verify`  | No            | Same routing change                                            |
| `auth/onboarding/city`    | Yes           | Replace TextInput with filtered FlatList from `/api/v1/cities` |
| `auth/onboarding/persona` | Yes           | Multi-select; call `PATCH /api/v1/me/onboarding` on Done       |
| `(tabs)/me`               | Optional      | Auth-aware: sign-in CTA or links + sign-out                    |
| `(tabs)/bookmarks`        | Optional      | Auth gate: sign-in CTA when anonymous                          |
| `me/profile`              | Yes           | `useAuth()` user data + sign-out button                        |
| `me/delete-account`       | Yes           | Real `DELETE /api/v1/me` call + SecureStore clear              |

## 5. Push / Email / Inbox triggers

None in this spec (D0_WELCOME deferred to next sprint).

## 6. Feature flags

No new flags. Existing `authFlags.{apple,google,magic}.enabled` unchanged.

## 7. Observability

- `console.error('[auth/session-restore]', err)` on refresh failure.
- `console.error('[auth/onboarding]', err)` on PATCH failure.
- `console.error('[auth/delete]', err)` on DELETE failure.

## 8. Failure modes & fallbacks

| Failure                                              | Behaviour                                                                               |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Session restore: access token expired, refresh fails | Tokens cleared silently; user stays on current screen; authed features show sign-in CTA |
| `PATCH /api/v1/me/onboarding` fails                  | Alert shown; user remains on persona screen with retry                                  |
| `DELETE /api/v1/me` fails                            | Alert shown; no data deleted; user stays on delete-account screen                       |
| City list fetch fails                                | Retry button shown on onboarding/city screen                                            |

## 9. Test plan

- **Unit** - `AuthContext`: session restore with valid token, with expired+refreshable token,
  with expired+non-refreshable token; `signOut()` clears store.
- **Unit** - `PATCH /api/v1/me/onboarding`: valid payload, invalid cityId, partial update.
- **Unit** - `DELETE /api/v1/me`: success cascade, unauthenticated request.
- **E2E (manual)** - Full onboarding flow after fresh Apple sign-in on device.
- **E2E (manual)** - Cold launch with valid tokens → direct to Discover (no sign-in screen).
- **E2E (manual)** - Delete account → confirm → sign-in screen.

## 10. Rollout plan

Shipped as a single PR behind the existing auth flags (no new flag needed - these are all
completion steps for already-enabled flows). No staged rollout required; feature is additive
and non-breaking.

## 11. Backout plan

Revert the PR. Old auth flows (`router.replace('/(tabs)')`) are fully restored. The
`onboarding_complete` column defaults `false` and no existing UI reads it - safe to leave
unset in the DB.
