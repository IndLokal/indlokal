# PRD-0008: Mobile auth — Apple, Google, Magic link

- **Status:** Draft
- **Owner:** Mobile lead
- **Reviewers:** PM, Design, Backend lead
- **Depends on:** PRD-0001, TDD-0001

## 1. Problem

Sign in must be frictionless and store-compliant. Apple requires Sign in with Apple if Google sign-in is offered.

## 2. Users & JTBD

- "Sign in once, stay signed in, with the method I trust."

## 3. Success Metrics

- New install → signed-in conversion ≥ 35 % within first 7 days.
- Sign-in error rate < 2 %.

## 4. Scope

- Sign in with **Apple** (iOS + cross-platform via web fallback).
- Sign in with **Google** (`expo-auth-session` + native).
- **Magic link** via email — opens app via Universal Link to `/auth/magic`.
- Profile screen: display name, city, persona segments, languages, sign out, delete account (DPDP).
- Onboarding: city pick → optional persona/language → push pre-prompt deferred to first valuable action.

## 5. Out of Scope

- Phone / OTP login.
- Social profile import.

## 6. User Stories

- As a new user I can sign in with Apple in two taps.
- As a returning user my session restores silently from SecureStore.
- As a user I can delete my account and all my data.

## 7. Acceptance Criteria

```
Given a user requests a magic link in the app
When they open the email on the same phone
Then the link opens the app, /auth/magic-link/verify is called, tokens stored, and they land on the screen they were on before sign-in
```

## 8. UX

Sign-in screen, onboarding flow, profile screen, delete-account confirmation.

## 9. Risks & Open Questions

- Apple's email-relay handling — store relayed email and treat as canonical.
