# PRD-0019: Auth Completion — Onboarding, Session Restore, Profile & Account Management

- **Status:** Implemented
- **Owner:** Product Lead
- **Reviewers:** Mobile Lead, Backend Lead, Design
- **Linked:** TDD-0019, ADR-0005

## 1. Problem

The auth foundation (JWT, three sign-in methods) was shipped in PRD-0008/TDD-0001 but the
post-authentication product loop is incomplete:

- New users land on the Discover tab without completing onboarding — `cityId` and
  `personaSegments` are never collected, so the feed cannot personalise.
- The app has no global auth state: the Me tab and Profile screen show identical UI to
  signed-in and anonymous users; there is no sign-out button.
- Cold-launching the app after a previous session always shows the sign-in screen, even when a
  valid refresh token exists in `SecureStore`.
- Delete Account is a UI stub with an alert.

## 2. Users & JTBD

- **New user (first install):** "I signed in — now tell me what the app needs to show me the right
  content." → Needs a guided onboarding that captures city + persona in ≤ 2 taps.
- **Returning user:** "I closed the app and reopened it — I don't want to sign in again."
  → Session must restore silently on every cold launch.
- **Authenticated user:** "I want to see my profile and sign out when I'm done."
  → Me tab must reflect auth state and provide a sign-out action.
- **User who wants to leave:** "I want to delete my account and all my data (DPDP)."
  → Delete Account must complete the full cascade, not show a placeholder.

## 3. Success Metrics

| Metric                                                 | Target                            |
| ------------------------------------------------------ | --------------------------------- |
| Sign-in → onboarding completion rate                   | ≥ 85 %                            |
| Cold-launch session restore success rate               | ≥ 95 % (when refresh token valid) |
| Profile screen load time (p95)                         | < 400 ms                          |
| Delete-account completion rate (initiated → confirmed) | ≥ 80 %                            |

## 4. Scope

- **Auth context** (`useAuth` hook): exposes `{user, isLoading, onSignIn, signOut}` globally.
- **Session restore**: on cold launch, read `SecureStore` → validate/refresh access token →
  route to correct screen without requiring re-authentication.
- **Onboarding gate**: after any successful sign-in, if `user.onboardingComplete === false`,
  route to `/auth/onboarding/city` before entering the main tab loop.
- **Onboarding/city screen**: replace free-text with a filtered list from `GET /api/v1/cities`
  (active cities only). Selection stores a valid `cityId`.
- **Onboarding/persona screen**: persist selected segments via
  `PATCH /api/v1/me/onboarding`, set `onboardingComplete: true`.
- **`PATCH /api/v1/me/onboarding`** endpoint: updates `cityId`, `personaSegments`,
  `preferredLanguages`, `displayName` atomically and flips `onboardingComplete`.
- **Profile screen**: fetch and display `GET /api/v1/me`; show sign-out button.
- **Me tab**: show sign-in CTA when anonymous, show display name + sign-out when signed in.
- **Delete account**: `DELETE /api/v1/me` — authenticated, revokes all refresh tokens,
  cascades DB deletion, clears `SecureStore`.
- **Bookmarks auth gate**: show sign-in CTA when not authenticated instead of error text.

## 5. Out of Scope

- Phone/OTP sign-in.
- Edit profile (name, avatar) — separate spec.
- Web sign-in for general users — decision deferred (D2 in audit).
- D0_WELCOME email — next sprint.
- Analytics instrumentation — next sprint.

## 6. User Stories

- As a new user I complete onboarding (city + persona) in ≤ 2 screens immediately after sign-in.
- As a returning user my session restores automatically when I reopen the app.
- As a signed-in user I can see my name and city on my profile screen.
- As a signed-in user I can sign out from the Me tab.
- As a user I can permanently delete my account from the delete-account screen.
- As an anonymous user visiting Bookmarks I see a clear sign-in CTA instead of an error.

## 7. Acceptance Criteria

```
Given a new user completes Apple/Google/magic-link sign-in
When the auth callback succeeds and user.onboardingComplete === false
Then the app navigates to /auth/onboarding/city

Given a user selects a city and persona and taps Done
When PATCH /api/v1/me/onboarding responds 200
Then user.onboardingComplete === true and app navigates to /(tabs)

Given a user has a valid refresh token in SecureStore
When they cold-launch the app
Then they land on /(tabs) without seeing the sign-in screen

Given a signed-in user on the Me tab
When they tap Sign out
Then their SecureStore tokens are cleared, the Me tab shows the sign-in CTA

Given a signed-in user on Delete Account
When they confirm deletion
Then DELETE /api/v1/me is called, all tokens are revoked, user lands on sign-in

Given an anonymous user navigates to the Bookmarks tab
Then a sign-in CTA is displayed (no error message)
```

## 8. UX

### Onboarding city screen

- Title: "Which city are you in?"
- Searchable FlatList of active cities (name, state)
- Single selection
- "Continue" enabled only when a city is selected

### Onboarding persona screen

- Title: "What best describes you?"
- Multi-select option pills: New to this city / Student / Family / Working professional
- "Done" button — always enabled (persona is optional but encouraged)
- Progress: step 2 of 2

### Me tab — authenticated state

- Display name (or email fallback) + city name
- Links: View Profile, Notifications, Inbox, Submit, Resources, Delete Account
- "Sign out" at the bottom (destructive style)

### Me tab — anonymous state

- Headline: "Sign in to save and get reminders"
- Primary CTA: "Sign in" → `/auth/sign-in`

### Profile screen

- Display name, email, city, persona segments
- "Edit profile" — disabled / placeholder for next sprint
- "Sign out" button

## 9. Risks & Open Questions

- **Magic link on shared device**: if a user forwards the magic link email to another device,
  both devices get signed in. Acceptable for v1 (standard magic-link behaviour).
- **Onboarding skip**: should users be able to skip the city step? Recommendation: No —
  `cityId` is required for meaningful discovery.
- **Account deletion grace period**: v1 is immediate. Consider soft-delete + 30-day window
  post-launch if user feedback warrants.
