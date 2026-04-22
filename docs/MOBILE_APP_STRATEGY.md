# IndLokal Mobile App Strategy & Spec-Driven Development Plan

> Owner: Engineering + Product (acting as Engineer & Product Head)
> Status: Draft v1 — 22 April 2026
> Scope: Native mobile apps (iOS + Android) for IndLokal. **PWA is explicitly out of scope** as a primary delivery channel.

---

## 0. Why a Native App (and not a PWA)

A PWA would be the cheapest path, but for IndLokal's retention thesis it is the wrong primitive:

- **Push on iOS is second-class** — Web Push on iOS requires "Add to Home Screen", has lower opt-in, no rich media, no Live Activities, no critical alerts.
- **No App Store / Play Store presence** — we lose the dominant discovery surface for "Indian events {city}", "Desi community {city}", "Diwali near me".
- **No deep OS integrations** — share sheet, contacts, calendar, widgets, Siri/Assistant, Live Activities, Geofencing are limited or unavailable.
- **Branding & trust** — diaspora users (especially 35+ family decision-makers) trust an installed app icon more than a browser bookmark.
- **Background work** — reliable background sync for "events near me today" is not feasible on PWA.

**Decision:** Build native apps for iOS and Android using **Expo (React Native) + EAS**, reusing the existing Next.js backend. Web stays as our SEO/long-tail surface and admin/organizer console.

---

## 1. Strategic Goals & Success Metrics

| Goal             | Metric                               | Target (6 months post-launch) |
| ---------------- | ------------------------------------ | ----------------------------- |
| Daily engagement | DAU/MAU                              | ≥ 0.25                        |
| Push opt-in      | % of installs granting push          | ≥ 60%                         |
| Retention        | D30 / D90                            | ≥ 25% / ≥ 15%                 |
| Conversion       | RSVP / community follow per session  | 3× web baseline               |
| Contribution     | New submissions originating from app | ≥ 30%                         |
| Quality          | Crash-free sessions                  | ≥ 99.5%                       |
| Performance      | Cold start (P75, mid-tier Android)   | < 2.0s to interactive         |

Primary jobs-to-be-done on mobile:

1. **Discover** Indian events/communities near me, _now / this weekend_.
2. **Get notified** when something relevant drops.
3. **Save & share** with family/friends via WhatsApp/Telegram.
4. **Contribute** as organizer/community admin on the go.

---

## 2. Technology Choice

**Stack:** Expo SDK (latest stable) + React Native + TypeScript + EAS (Build, Submit, Update).

| Option                  | Verdict                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| PWA only                | ❌ Rejected — see §0                                                                      |
| Native Swift + Kotlin   | ❌ Premature; doubles cost, splits a small team                                           |
| Flutter                 | ❌ Team is TS/React; high ramp, no shared types with web                                  |
| **Expo / React Native** | ✅ Shares TS + Zod schemas with `src/modules/*`; OTA via EAS Update; mature push pipeline |

Supporting choices:

- **Navigation:** Expo Router (file-based, mirrors Next.js mental model).
- **Data:** TanStack Query + Zod-validated API client generated from OpenAPI.
- **State:** Zustand for UI state; server state lives in TanStack Query.
- **Storage:** Expo SecureStore (tokens), MMKV (cache), React Query persist (offline feed).
- **Auth:** Sign in with Apple (mandatory if Google is offered), Google Sign-In, Email magic link (reuses `src/lib/email.ts`).
- **Push:** Expo Push Service → APNs + FCM.
- **Crash & analytics:** Sentry + PostHog.
- **Forms:** React Hook Form + Zod (shared schemas).
- **CI/CD:** GitHub Actions → EAS Build → EAS Submit → staged rollout.

**Repository layout (monorepo via pnpm workspaces or Turborepo):**

```
apps/
  web/        # current Next.js app
  mobile/     # new Expo app
packages/
  shared/     # Zod schemas, types lifted from src/modules/*/types.ts, API client, analytics events
  ui-tokens/  # design tokens from docs/brand/DESIGN_GUIDELINES.md
```

---

## 3. Spec-Driven Development Approach

We adopt a **spec-first** workflow: no production code is written for a feature until its spec is reviewed and merged. This keeps web + mobile + backend aligned around a single contract.

### 3.1 Spec Hierarchy

```
docs/specs/
  PRD/                # Product Requirement Docs (the "why" + user stories + acceptance)
  TDD/                # Technical Design Docs (the "how" + architecture + tradeoffs)
  API/                # OpenAPI 3.1 (generated from Zod) — the contract
  EVENTS/             # Analytics & notification event catalog (typed)
  UX/                 # Figma links, flows, screen-by-screen acceptance
  ADR/                # Architecture Decision Records (immutable, numbered)
```

### 3.2 Feature Lifecycle (definition of "spec-driven")

For every feature (mobile or shared backend):

1. **PRD** — problem, users, JTBD, success metrics, scope/non-scope, acceptance criteria as Gherkin (`Given/When/Then`).
2. **UX spec** — Figma frames, empty/loading/error/offline states, a11y notes, copy.
3. **API spec** — Zod schemas in `packages/shared` → OpenAPI export → reviewed before any handler is written. Contract changes require a version bump under `/api/v1/*`.
4. **TDD** — data model deltas (Prisma migration draft), module boundaries, push/email triggers, failure modes, observability (logs, metrics, traces), rollout plan, feature flag name.
5. **Test plan** — unit, contract (Pact-style against OpenAPI), E2E (Detox for mobile, Playwright for web), load (k6 for any new endpoint).
6. **ADR** — only if a non-obvious architectural choice is made.
7. **Implementation** — gated by an approved spec; PRs reference the spec doc.
8. **Verification** — acceptance criteria checked off in the PR description; analytics events fire in staging; Sentry clean.
9. **Rollout** — behind a feature flag; staged 1% → 10% → 50% → 100%.
10. **Post-launch review** — metrics reviewed against PRD targets after 2 weeks; ADR amended if assumptions broke.

### 3.3 Spec Templates (lightweight)

**PRD template (`docs/specs/PRD/<id>-<slug>.md`):**

```markdown
# PRD-<id>: <Feature>

- Status: Draft | Approved | Shipped
- Owner: <name>
- Reviewers: PM, Eng Lead, Design
- Linked: TDD-<id>, API-<id>, UX-<id>

## Problem

## Users & JTBD

## Success Metrics (with targets + how measured)

## Scope

## Out of Scope

## User Stories

## Acceptance Criteria (Gherkin)

## Risks & Open Questions
```

**TDD template (`docs/specs/TDD/<id>-<slug>.md`):**

```markdown
# TDD-<id>: <Feature>

## Architecture overview (diagram)

## Data model changes (Prisma diff)

## API surface (link to OpenAPI)

## Mobile screens & navigation

## Push / Email / Inbox triggers

## Feature flag(s)

## Observability (events, metrics, traces, alerts)

## Failure modes & fallbacks

## Test plan (unit / contract / E2E / load)

## Rollout plan

## Backout plan
```

**ADR template (`docs/specs/ADR/<NNNN>-<slug>.md`):**

```markdown
# ADR-<NNNN>: <Decision>

- Date: YYYY-MM-DD
- Status: Proposed | Accepted | Superseded by ADR-<NNNN>

## Context

## Decision

## Consequences (positive, negative, neutral)

## Alternatives considered
```

### 3.4 Contract Source of Truth

- All API request/response shapes are **Zod schemas in `packages/shared`**.
- A CI job exports them to OpenAPI 3.1 and to a typed TS client used by both `apps/web` and `apps/mobile`.
- A contract test (Pact or schema-diff) **fails CI** if the implementation diverges from the spec.
- Breaking changes require a new version (`/api/v2/...`) and an ADR.

### 3.5 Definition of Done (per feature)

- [ ] PRD, UX, API, TDD merged
- [ ] Migrations + seed data shipped
- [ ] Contract tests green
- [ ] Unit coverage ≥ 80% on new code
- [ ] Detox E2E for the happy path on iOS + Android
- [ ] Analytics events verified in PostHog staging
- [ ] Sentry shows zero new error groups in 24h canary
- [ ] Accessibility checks (VoiceOver/TalkBack labels, dynamic type, contrast)
- [ ] Feature flag wired; rollout plan approved
- [ ] Docs updated (`README`, in-app help if user-visible)

---

## 4. MVP Scope (App v1.0)

Must-have, each with its own PRD/TDD/API/UX:

1. **City picker + Discover feed** — reuses `modules/discovery`.
2. **Event detail** — RSVP/Save, Add to Calendar, Share.
3. **Community detail + Follow.**
4. **Search** — `modules/search` with recent + trending.
5. **Auth** — Apple, Google, magic link; profile; bookmarks (`me/`).
6. **Push notifications** — granular per-city / per-community / per-category prefs.
7. **Submit event/community** — camera + gallery upload; reuses `submit/` flow.
8. **Universal Links / App Links** — `indlokal.com/[city]/...` opens in app.
9. **Offline cache** — last feed + saved items.
10. **Analytics + crash reporting.**

Explicitly out of v1: in-app chat, ticketing/payments, organizer analytics dashboards, social posts.

---

## 5. Notification Strategy (the retention engine)

Channels in priority order:

1. **Push** (Expo Push → APNs/FCM)
2. **Email newsletter** (extend `src/lib/email.ts`; React Email + Resend/Postmark)
3. **In-app inbox** (persisted; survives push denial)
4. **WhatsApp Business API** (Phase 2, opt-in)

Notification types:

| Type                                | Trigger                        | Default | Frequency cap                              |
| ----------------------------------- | ------------------------------ | ------- | ------------------------------------------ |
| New event in followed city/category | `Event.published`              | on      | 1/day digest, instant if score ≥ threshold |
| Followed community update           | community update               | on      | instant, ≤ 3/day/community                 |
| Saved event reminder                | T-24h, T-2h                    | on      | per-event                                  |
| Festival (Diwali, Holi, Onam, …)    | scheduled cron + cultural tags | on      | 1 per festival                             |
| Weekly digest                       | Friday 10:00 local             | on      | 1/week                                     |
| Organizer: submission status, RSVPs | state change                   | on      | instant                                    |
| Re-engagement                       | D3/D7/D30 inactive             | on      | strict cap                                 |

Rules (specced in `EVENTS/notifications.md`):

- Ask for push permission **after** first valuable action (saved event or followed community).
- Per-channel + per-topic toggles; one-tap unsubscribe in every email (CAN-SPAM/DPDP).
- Quiet hours 22:00–08:00 local by default.
- Use `modules/scoring` to gate sends; suppress low-score items.
- Idempotency keys on the outbox to prevent duplicates.

Newsletter:

- Personalized weekly "This weekend in {city}".
- Monthly festival edition.
- Onboarding drip (D0 welcome, D2 follow communities, D7 invite a friend).

---

## 6. Backend & Data Changes

Each item below ships behind its own TDD:

- Promote `/api/*` to versioned `/api/v1/*`; OpenAPI generated from Zod.
- `Device` table — userId, expoPushToken, platform, locale, timezone, appVersion, lastSeen.
- `NotificationPreference` table — per-user × per-topic × per-channel.
- `NotificationOutbox` table + worker (BullMQ or pg-boss on existing Postgres — no new infra).
- Extend `modules/scoring` with `notificationScore`.
- Event-bus hooks in `community`, `event`, `pipeline` modules to enqueue notifications.
- Image upload pipeline (S3/R2 + signed URLs) for camera submissions.
- Extend `src/lib/rate-limit.ts` to mobile auth endpoints.

---

## 7. Engagement & Growth Loops

- **Deep links + share sheet** with branded OG cards (server-rendered in Next.js) → WhatsApp/Telegram → deferred deep link install (Branch.io or AppsFlyer).
- **Referrals** — "Invite a friend to {city}" tracked via `modules/pipeline`.
- **Organizer loop** — push for RSVPs and approvals → daily opens → more content.
- **Calendar integration** — "Add to Calendar" auto-creates a reminder trigger.
- **Widgets (Phase 2)** — "Next event near you".
- **Live Activities (iOS) / Ongoing notifications (Android)** — event-day countdowns.

---

## 8. Quality, Security, Compliance

- DPDP Act (India) + GDPR — explicit consent for push/email/analytics; data export + delete in `me/`.
- Apple ATT prompt only if IDFA-based attribution is added.
- Tokens in SecureStore/Keychain/Keystore; refresh-token rotation.
- Certificate pinning for API calls.
- Crash-free sessions ≥ 99.5% (Sentry).
- Accessibility per `docs/brand/DESIGN_GUIDELINES.md` — dynamic type, VoiceOver/TalkBack, contrast.
- Content moderation policy + report/block (App Store requirement for UGC).

---

## 9. Release & Ops

- EAS Build + EAS Submit; OTA via EAS Update on `production` and `staging` channels.
- Native binary release cadence: every 2 weeks; OTA for JS-only fixes any time.
- Feature flags (PostHog/Statsig) for dark-launches.
- Staged rollout 1% → 10% → 50% → 100% with auto-halt on Sentry regression.
- ASO — localized listings (en, hi, ta, te first); keywords from `docs/COMPETITIVE_ANALYSIS_*`.

---

## 10. Phased Roadmap

- **Phase 0 — Foundations:** monorepo split, `/api/v1`, JWT auth, OpenAPI, push infra, outbox worker, Device/Pref tables, image uploads, spec templates merged into `docs/specs/`.
- **Phase 1 — App v1.0 MVP:** §4 scope. Closed beta via TestFlight + Play Internal in 2 lighthouse cities (Stuttgart + a Bengaluru-diaspora target — informed by existing competitive docs).
- **Phase 2:** widgets, Live Activities, WhatsApp channel, organizer surface in-app, in-app inbox, referrals.
- **Phase 3:** ticketing/RSVP + payments (Razorpay/Stripe), in-app chat per community, recommendations from `modules/scoring` + collaborative filtering, AI agent surface from `docs/AI_AGENT_*`.

---

## 11. Team Shape

- 1 Expo/RN engineer
- 1 backend engineer (existing team, on `/api/v1` + outbox)
- 0.5 designer
- 0.5 PM
- Shared QA + 1 part-time release manager

Run-rate adds: EAS, Resend, R2/S3, Sentry, PostHog, Branch/AppsFlyer. All have free tiers sufficient until traction.

---

## 12. Risks & Mitigations

| Risk                                       | Mitigation                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| Notification fatigue → uninstalls          | Scoring-gated sends, frequency caps, quiet hours, granular opt-outs            |
| App Store rejection (auth, UGC moderation) | Apple Sign-In, report/block, clear moderation policy                           |
| Splitting product focus from web           | Monorepo + shared packages; every feature ships from same domain modules       |
| Low India network quality                  | Offline cache, image CDN with AVIF/WebP, feed page < 150KB                     |
| Organizer churn                            | Dedicated organizer pushes + lightweight in-app admin                          |
| Spec overhead slows shipping               | Lightweight templates; specs sized to feature; ADRs only for non-obvious calls |

---

## 13. First Specs to Write (immediate next actions)

1. `ADR-0001` — Adopt Expo + monorepo; reject PWA.
2. `ADR-0002` — Zod-as-contract; OpenAPI generated, not hand-written.
3. `PRD-0001` / `TDD-0001` — `/api/v1` cutover + JWT auth.
4. `PRD-0002` / `TDD-0002` — Device + NotificationPreference + Outbox worker.
5. `PRD-0003` / `TDD-0003` — Mobile Discover feed (city picker + event/community list).
6. `PRD-0004` / `TDD-0004` — Push permission flow + topic preferences UI.
7. `EVENTS/analytics.md` — initial event catalog (typed).
8. `EVENTS/notifications.md` — full notification matrix with caps and copy.

---

**Bottom line:** Native via Expo, monorepo with a shared contract, and a spec-driven workflow where every feature starts as a PRD + API + TDD before code. Push and the weekly digest are treated as the core retention product — not features. Ship a tight v1.0 in two lighthouse cities, then scale.
