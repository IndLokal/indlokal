# PRD-0040: Mobile v1.0 Member-parity close-out

- **Status:** Implemented
- **Owner:** Product + Mobile Eng
- **Reviewers:** PM, Eng Lead, Design
- **Linked:** TDD-0040, [MOBILE_APP_STRATEGY.md](../../MOBILE_APP_STRATEGY.md) §4.1, [MOBILE_APP_AUDIT.md](../../MOBILE_APP_AUDIT.md) §8, [MOBILE_WEB_INTEGRATION.md](../../MOBILE_WEB_INTEGRATION.md) §10

## 1. Problem

The mobile app is a complete consumer-discovery app for the **Member** persona, but the
[audit](../../MOBILE_APP_AUDIT.md) found it **incomplete relative to the web Member surface**.
Five Member-parity gaps block declaring App v1.0 "done":

1. **Profile is read-only.** Members can only set city/persona/languages during onboarding;
   web `/me` lets them edit anytime.
2. **Submissions are text-only.** The strategy (§4.7) promises camera + gallery upload; the
   API (`/api/v1/uploads/presign`) and contracts (`imageKey`) exist, but mobile posts text only.
3. **Public-surface lag.** Web ships `consular-services` and `indian-events-this-week` as
   first-class value surfaces; mobile has neither.
4. **No event report.** Members can report a community but not an event.
5. **No offline durability / no analytics.** The feed cache is in-memory only (lost on cold
   start) and no behavioral analytics fire from mobile, so cross-surface funnels are blind on
   the device half.

These are the open items in [MOBILE_APP_STRATEGY.md](../../MOBILE_APP_STRATEGY.md) §4.1 (items
7, 8, 11, 12) and the audit P0/P2 backlog.

## 2. Users & JTBD

- **Member (E2)** — "When I open the app I want to keep my city/persona/languages current,
  add a photo to what I submit, see what's on this week, find consular services, flag a wrong
  event, and have my last feed available even with no signal."

## 3. Success Metrics

- `profile_updated` fires on profile edit; profile is editable post-onboarding.
- ≥ 30% of new submissions include an image once shipped (strategy §1 contribution goal).
- `consular.viewed` / `this_week.viewed` fire; both surfaces reachable from the app.
- Event reports submit successfully and appear in the admin report queue.
- Last feed + saved items render on cold start with no network (offline cache hit).
- Discover/event analytics (`discover.feed.viewed`, `event.detail.viewed`, `event.saved`,
  `event.shared`, `event.calendar_added`, `event.register_clicked`) recorded via `/api/v1/track`.

## 4. Scope

- **Editable profile & preferences** — a mobile `Edit profile` screen (display name, city,
  persona segments, preferred languages) writing `PATCH /api/v1/me/onboarding`, with the
  signed-in session refreshed so the UI reflects the change immediately.
- **Image upload in submissions** — camera + gallery picker on submit-event and
  submit-community; client computes SHA-256, requests a presigned PUT, uploads, and attaches
  `imageKey` to the submission. Honors the existing 10 MB / image-type contract.
- **Consular services surface** — a mobile screen listing the city's consular/official/
  government/visa resources, grouped by type, opening official links.
- **This-week surface** — a mobile screen listing events in the current city from now through
  the next 7 days, expanding to 30 days when the week is empty (mirrors web behavior intent).
- **Event report** — a report sheet on event detail. Backend gains a first-class `eventId`
  on `ContentReport` (orthogonal to `communityId`) so event reports are queryable.
- **Offline cache** — last Discover feed + saved items persist to device storage and render
  on cold start; refreshed in the background when online.
- **Analytics** — a lightweight mobile analytics client posting the shared event names to
  `POST /api/v1/track`, wired into the Member discover/event/save/share funnel.

## 5. Out of Scope

- Role-aware shell / Organizer / Host / Ambassador surfaces (App v1.1–v1.3, separate PRDs).
- Server-driven saved-event reminders (audit P3) — local reminders remain.
- Promoting tokens to a shared `ui-tokens` package (integration doc §6, separate work).
- PostHog/Sentry adoption — `/api/v1/track` (Vercel-logged) is the v1.0 analytics sink per
  the strategy's "Vercel logs first for MVP" decision.
- Editing avatar image.

## 6. User Stories

- As a Member I can edit my city, persona, languages, and name after onboarding.
- As a Member I can attach a photo (camera or gallery) when I submit an event or community.
- As a Member I can browse consular services and "this week" events for my city.
- As a Member I can report an event that is wrong, broken, or out of date.
- As a Member I can still see my last feed and saved items when offline.

## 7. Acceptance Criteria (Gherkin)

```
Given I am a signed-in Member
When I open Edit profile, change my city and languages, and save
Then PATCH /api/v1/me/onboarding succeeds, my session reflects the new values
And a profile_updated analytics event fires

Given I am submitting an event
When I add a photo from the gallery and submit
Then the image is uploaded via a presigned URL
And the submission is created with the returned imageKey

Given my city has consular resources
When I open Consular services
Then I see them grouped by type and can open the official link

Given my city has events in the next 7 days
When I open This week
Then I see those events; if none, the window expands to 30 days

Given I am viewing an event
When I open the report sheet, pick a reason, and submit
Then a ContentReport is created with eventId set

Given I have opened the Discover feed while online
When I relaunch the app with no network
Then the last feed and my saved items render from the offline cache
```

## 8. UX

- Reuses existing mobile theme tokens (`@/constants/theme`) and the screen idioms already in
  `submit/`, `resources/`, and `report/community/`. Empty/loading/error states required on
  every new screen. Image picker shows a thumbnail with a remove affordance. Edit-profile
  uses the same persona/language chip controls as onboarding.

## 9. Risks & Open Questions

- **Presign checksum:** S3 presign embeds `ChecksumSHA256`; the PUT must send the matching
  `x-amz-checksum-sha256` header. The upload helper must compute SHA-256 of the file bytes.
- **Event report migration:** adds a nullable `eventId` FK; existing rows stay valid.
- **Offline cache size:** cap persisted payloads (feed + saved) to avoid unbounded storage.
- **Analytics PII:** `/api/v1/track` records userId when authed; no extra PII in metadata.
