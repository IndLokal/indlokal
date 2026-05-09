# PRD-0011: Magic-link admin & organizer authentication

- **Status:** Shipped
- **Owner:** Founders
- **Reviewers:** PM, Eng Lead
- **Linked:** TDD-0011, ADR-0004

## 1. Problem

Founders, ops staff, and verified community organizers need to sign in to the
web admin from anywhere — including from a phone — without password
management, without a third-party SSO bill, and with email link previewers
(Gmail, Outlook Safe Links, mail-server scanners) not silently consuming the
one-shot token before the human ever clicks it.

## 2. Users & JTBD

- **Platform admin** — wants to triage submissions, run bootstrap, manage
  data; expects "log in once a week, stay signed in".
- **Community organizer** (claimed community) — wants to update events and
  respond to claims; logs in much less often, almost always on mobile.
- **Both** — must be able to sign out cleanly from a shared device.

## 3. Success Metrics

- 0 reports of "magic link already used" caused by scanner pre-fetch.
- ≥ 95 % of sent magic-link emails clicked within 24 h result in a session.
- p95 admin session lifetime ≥ 5 days (sliding refresh works).
- Sign-out clears server-side token within one request (no stale cookies).

## 4. Scope

- Email-based magic-link request for both `/admin/login` and
  `/organizer/login`.
- Token issued once, hashed at rest (SHA-256), 24-hour TTL, single-use.
- Verify route safe to GET-prefetch by email scanners — GET shows a confirm
  page, POST consumes the token; all redirects use HTTP **303** to force
  the follow-up to be GET.
- 7-day **sliding** session cookie; renewed when the request is within 24 h
  of expiry.
- Visible "Sign out" affordance in the admin dashboard header that revokes
  the session server-side and clears the cookie.
- Sign-out confirmation banner on `/admin/login?signed_out=1`.

## 5. Out of Scope

- Username/password fallback.
- WebAuthn / passkeys (planned, not in this cut).
- Per-IP rate-limit (currently per-email throttle only).
- Multi-tenant org switcher.

## 6. User Stories

- As an admin I want to receive a sign-in email and click it once on any
  device so that I get into the dashboard without a password.
- As an admin I want to stay signed in across a normal work week without
  having to re-request a link every day.
- As an admin on a borrowed laptop I want a clear "Sign out" button so I
  know I'm gone after I leave.
- As an organizer I want the same one-tap experience on my phone, even
  though my mail provider may pre-fetch URLs.

## 7. Acceptance Criteria

```
Given an admin requests a sign-in link
 When the email body is scanned by Gmail / Outlook Safe Links (HEAD/GET)
 Then the token is NOT consumed and the human can still complete sign-in.

Given an admin clicks the link in their email
 When the verify page renders
 Then a one-button form completes sign-in via POST and 303-redirects to /admin.

Given an admin signed in 6 days ago and is still active
 When they make any request
 Then their cookie + DB session are extended for another 7 days.

Given an admin clicks "Sign out"
 When the request completes
 Then the cookie is cleared, the DB session row is deleted, and they land on
      /admin/login?signed_out=1 with a green confirmation banner.

Given a magic link is older than 24 h or already used
 When the verify POST runs
 Then the user sees a clear "expired or already used" message with a
      "Request a new link" action.
```

## 8. UX

- `/admin/login` — email input, submit returns to the same page with
  "Check your inbox" notice; renders signed-out banner when
  `?signed_out=1`.
- `/admin/verify?token=…` — single-button confirm page ("Click to sign in")
  to ensure POST consumption.
- Admin layout header — admin email + Sign out button (form POST to
  `/admin/logout`).
- Organizer flow mirrors the same pattern at `/organizer/...`.
- Errors: invalid token, expired token, network — all surface inline.

## 9. Risks & Open Questions

- **Risk:** if `NEXT_PUBLIC_APP_URL` is shared between Production and Preview
  Vercel environments, preview emails point to production. Resolved:
  scope per environment (see TDD-0011 §6).
- **Open:** add WebAuthn for admin step-up (deferred).
- **Open:** allow admin to invalidate all other sessions ("sign out
  everywhere") — deferred until we add a sessions list.
