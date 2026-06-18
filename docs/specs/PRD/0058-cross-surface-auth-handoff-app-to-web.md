# PRD-0058: Cross-surface auth hand-off (app → web)

- **Status:** Approved
- **Owner:** Auth/Platform
- **Reviewers:** PM, Eng Lead, Design
- **Linked:** TDD-0058, [`MOBILE_WEB_INTEGRATION.md`](../../MOBILE_WEB_INTEGRATION.md) §3 & §5, [`RBAC_AND_AUTHORIZATION.md`](../../RBAC_AND_AUTHORIZATION.md)

## 1. Problem

IndLokal is **one product, two surfaces**. Some destinations are intentionally
web-only (admin, ops/pipeline, deep organizer management) and the mobile app
hands the user off to web for them (the "no orphan surface" rule,
`MOBILE_WEB_INTEGRATION.md` §5). Today that hand-off dead-ends at a **login
wall**: a user already signed in on mobile (JWT in SecureStore) opens a web
surface and is asked to authenticate again. That breaks the "sign in once"
promise (§3) and is the single biggest friction point blocking native→web
flows.

We need the §3 target: **app → web opens an in-app browser with a short-lived,
single-use session-exchange token, so the user lands authenticated** — without
ever putting a long-lived secret in a URL.

## 2. Users & JTBD

- **Any signed-in mobile user** who taps an action that lives on web (e.g.
  "Manage on web", an admin/ops link, deep organizer tooling). _JTBD: "When I
  follow an in-app link to a web-only page, I want to already be signed in, so I
  can act immediately instead of logging in again."_

## 3. Success Metrics

- Successful hand-off lands authenticated (cookie session set) — measured via
  the existing `USER_LOGGED_IN` event with `auth_method:'handoff'`.
- Zero re-login prompts on hand-off in manual cross-surface QA.
- No increase in auth error rate (consume-failure logs stay near zero).

## 4. Scope

- Direction: **app → web only** (mobile is the authenticated initiator).
- Backend mint endpoint that requires a valid mobile access token and returns a
  ready-to-open web URL containing a one-time, short-lived hand-off token.
- Web consume route that validates the token, establishes the **standard web
  cookie session** (same `lp_session` mechanism normal web login uses), and
  redirects to a validated in-product path.
- Mobile mechanism (pure helper + Expo in-app-browser binding + hook) to call
  the endpoint and open the returned URL.
- Flag-gated (`AUTH_WEB_HANDOFF_ENABLED`, default OFF) and analytics-instrumented.

## 5. Out of Scope

- **Web → app** hand-off (already served by magic links / universal links).
- Role-aware mobile workspace hub and the specific in-app entry-point buttons
  (separate follow-up; this PRD ships the reusable mechanism the hub will call).
- Any new auth provider/framework, refresh-token-in-browser, or change to the
  mobile JWT contract.

## 6. User Stories

- As a signed-in mobile user, I want a web-only surface I open from the app to
  recognize me, so I don't hit a login wall.
- As a security reviewer, I want the hand-off token to be short-lived,
  single-use, hashed at rest, and never a long-lived secret, so a leaked URL is
  low-risk.

## 7. Acceptance Criteria (Gherkin)

```
Given I am signed in on mobile and AUTH_WEB_HANDOFF_ENABLED is true
When the app requests a hand-off for next="/me"
Then the backend returns an https URL on the app origin containing a one-time token

Given a fresh, unused hand-off token
When the in-app browser opens the web consume URL
Then a secure HttpOnly cookie session is set and I am redirected to the validated next path

Given a hand-off token that was already used
When the consume URL is opened again
Then no session is established and I am redirected to /me/login?error=handoff

Given a hand-off token older than its TTL
When the consume URL is opened
Then no session is established and I am redirected to /me/login?error=handoff

Given a next value that is absolute, protocol-relative, or otherwise unsafe
When the token is consumed
Then the session is still established but I am redirected to the safe default /me

Given AUTH_WEB_HANDOFF_ENABLED is false
When the mint endpoint or the consume route is called
Then it responds as if the feature does not exist (404)

Given a request to the mint endpoint without a valid access token
When it is called
Then it returns 401 and no token is minted
```

## 8. UX

- Mobile: opening a web-only destination shows the system in-app browser
  (SFSafariViewController / Chrome Custom Tabs) already authenticated. Failure
  surfaces a friendly, non-leaky message (reuses `describeAuthError`).
- Web: the consume route is a redirect-only handler (no visible page); errors
  land on the existing `/me/login` with an inline error.

## 9. Risks & Open Questions

- **GET-consume + prefetch:** the URL is generated on-device and opened directly
  in an in-app browser (not emailed), is single-use, and expires in seconds — so
  scanner/prefetch risk is low. (Email-delivered links keep their POST-confirm
  pattern; this is a different channel.)
- **In-app browser cookie jar** persists per app, so subsequent hand-offs stay
  signed in — desired.
- Open: when the role-aware hub lands, decide which destinations auto-hand-off vs.
  prompt.
