# PRD-0015: City Ambassador console

- **Status:** Draft
- **Owner:** Y (Ops & Community Growth)
- **Reviewers:** JP (Founder), X (Partnerships), Eng Lead
- **Linked:** PRD-0014 (RBAC), PRD-0013 (pipeline review), PRD-0009 (submit),
  PRD-0016 (Outreach CRM)

## 1. Problem

The City Ambassador role (per the attached JD) is the field arm of IndLokal:
discover communities and events, push them into the platform, attend events,
capture insights, and feed back to ops. Today, an ambassador's only entry
points are the public `/submit` form and direct messages to the founder.
This:

- Buries their submissions in the same queue as anonymous tips.
- Gives them no view of "what's happening in my city right now".
- Provides no scoreboard for the JD's success metrics
  (communities/events identified, outreach contribution, social/content
  contribution, consistency).
- Creates no pull for them to log attendance, photos, or ground feedback.

## 2. Users & JTBD

- **City Ambassador (Stuttgart, Karlsruhe, Munich, Frankfurt …)** — wants a
  single place to see their city, drop new communities/events fast, log a
  visit, and watch their own contribution score.
- **Y (Ops)** — wants per-ambassador throughput visibility for the monthly
  evaluation cadence in the JD.
- **JP / X** — want city-by-city ecosystem signal that maps to partner city
  one-pagers and grant evidence.

## 3. Success Metrics

- ≥ 5 ambassador submissions/week per active ambassador by month 2.
- Median time from ambassador submission → published < 24 h (vs. current ~3 d
  for anonymous submissions).
- ≥ 70 % of ambassador submissions auto-fast-track-eligible (lower confidence
  threshold) at pipeline review.
- Ambassador weekly active rate ≥ 80 % over rolling 4 weeks.
- Analytics events: `ambassador.console.opened`,
  `ambassador.community.submitted`, `ambassador.event.submitted`,
  `ambassador.event.checkin`, `ambassador.feedback.submitted`.

## 4. Scope

- New route group `/ambassador/*` gated by
  `can(user, 'ambassador.console.read')` → `RoleAssignment.role = CITY_AMBASSADOR`.
- All queries filtered by `user.cityScopes` (from `RoleAssignment.cityId[]`).
- Pages:
  1. `/ambassador` — dashboard: this-week-in-{city} cards (new submissions,
     unverified communities, upcoming events, stale communities).
  2. `/ambassador/submit/community` and `/ambassador/submit/event` — quick-add
     wizards (mobile-web friendly), pre-filling `cityId` from scope, marking
     `pipeline_items.submittedBy = ambassador.userId` and
     `metadata.submittedByRole = 'CITY_AMBASSADOR'` for fast-track routing.
  3. `/ambassador/checkin/[eventId]` — log attendance + upload photo →
     `ActivitySignal` of type `EVENT_VERIFIED_ATTENDED` + `MediaAsset`.
  4. `/ambassador/feedback` — free-text feedback form (creates a
     `ContentReport` with `reportType = OTHER`, plus tag).
  5. `/ambassador/me` — personal scoreboard (counts of submissions, check-ins,
     feedback, week-over-week trend).
- Pipeline auto-fast-track rule: items with `submittedByRole = CITY_AMBASSADOR`
  and dedup match-score < 0.4 jump to top of queue, default `confidence`
  treated as +0.1.
- Email digest to Y every Monday with per-ambassador weekly counts (reuses
  existing notification worker).

## 5. Out of Scope

- Native mobile field-mode (tracked separately as a follow-up after web v1).
- Direct social posting from the console (handled by content pipeline PRD).
- Payment, expense, or stipend tracking.
- Multi-city ambassadors swapping cities mid-session (use the URL path).

## 6. User Stories

- As an **ambassador**, I open `/ambassador` and see five cards summarising
  my city's week.
- As an **ambassador**, I add a community from a poster I saw on campus in
  three taps; the system recognises it as a Stuttgart submission and pushes it
  to the fast-track queue.
- As an **ambassador**, I attend an event, tap "I attended", upload a photo;
  the event gains a verified-attendance signal and the photo lands in
  `MediaAsset` linked to the event.
- As **Y**, I open `/admin/ambassadors` (read-only list) and see each
  ambassador's weekly throughput, plus week-over-week change.

## 7. Acceptance Criteria (Gherkin)

```
Given an ambassador with cityScope=stuttgart opens /ambassador
Then only Stuttgart entities appear in every dashboard card

Given an ambassador submits a community via /ambassador/submit/community
Then a pipeline_item is created with submittedBy=ambassador.userId,
     metadata.submittedByRole='CITY_AMBASSADOR', cityId=stuttgart
And that item appears at the top of the admin pipeline queue

Given an ambassador checks in on an upcoming Stuttgart event
Then an ActivitySignal of type EVENT_VERIFIED_ATTENDED is created
And the event's lastActivityAt is updated

Given an ambassador opens /ambassador/me
Then the scoreboard shows non-zero counts that match
    pipeline_items + ActivitySignals + ContentReports filtered to that user
```

## 8. UX

- Mobile-first responsive layout reusing existing tokens in
  `apps/web/src/app/globals.css`.
- Hero: city + week-of date + 4 KPIs.
- Quick-add FAB (Floating Action Button) on dashboard → bottom sheet for
  community / event / resource.
- Empty / loading / error / offline states per house style.
- Copy is friendly, not bureaucratic ("You logged 3 communities this week —
  nice.").

## 9. Risks & Open Questions

- Photo uploads from ambassadors carry consent/IP implications; v1 limits to
  events the ambassador attended and stores `uploadedBy` for takedown.
- We must not let a Munich ambassador edit Stuttgart data even if they hold
  _both_ assignments — scoping is per assignment row, not per session.
- Should ambassadors be able to mark a community **inactive**? v1 = no
  (suggest only via feedback); revisit after first cohort.
- Auto-fast-track threshold tuning will need 4 weeks of data before
  formalising.
