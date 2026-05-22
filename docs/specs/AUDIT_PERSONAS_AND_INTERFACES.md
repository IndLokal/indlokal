# IndLokal — Personas, Interfaces & Gap Audit

- **Date:** 2026-05-11
- **Author:** Solution Architect / Full-Stack Eng Lead
- **Status:** Living document — update when team grid or surfaces change
- **Linked specs:** ADR-0005, PRD-0014 (RBAC), PRD-0015 (Ambassador console),
  PRD-0016 (Outreach CRM), PRD-0017 (Multi-community + Event Host),
  PRD-0018 (Audit log viewer)

This document maps every interface IndLokal currently ships, every persona who
will touch the platform across the next ~24 months (per the team-growth grid:
Founder, X — Strategic Partner, Y — Ops, City Ambassadors, Content support,
freelance engineering, AI ops, growth), and the concrete build gaps to support
them. The recommended next steps are captured as PRDs alongside this audit.

---

## 1. Surface map (what we currently ship)

Audited from `apps/web/src/app`, `apps/mobile/app`,
`apps/web/prisma/schema.prisma`, `docs/specs/PRD/*`.

| Interface        | Path / Channel                                                                                                    | Auth                          | Purpose                             | Status       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------- | ------------ |
| Public Web       | `apps/web/src/app/page.tsx`, `/[city]/...`, `/submit`, `/report`, `/me`                                           | Anonymous + magic-link user   | City discovery, submit, save        | Live         |
| Mobile App       | `apps/mobile/app` (Expo)                                                                                          | Magic-link + OAuth + push     | Discovery, inbox, save, submit      | Live         |
| Organizer Portal | `apps/web/src/app/organizer` (`/login`, `/edit`, `/events`, `/channels`, `/verify`)                               | Magic-link (PRD-0011)         | Claim + edit community, post events | Live (basic) |
| Admin Console    | `apps/web/src/app/admin/(dashboard)` — `submissions`, `claims`, `pipeline`, `scoring`, `data`, `merge`, `reports` | Magic-link → `PLATFORM_ADMIN` | Moderation + ops                    | Live         |
| Public REST API  | `apps/web/src/app/api/v1`                                                                                         | JWT (TDD-0001)                | Mobile + 3rd-party                  | Live         |
| Cron / Pipeline  | `apps/web/src/app/api/cron`                                                                                       | Vercel cron secret            | Discovery, scoring, digests         | Live         |
| Tracking         | `/api/track`                                                                                                      | None (anon sessionId)         | Behavioural signals                 | Live         |

**Roles in DB today** (`apps/web/prisma/schema.prisma`): `USER`,
`COMMUNITY_ADMIN`, `PLATFORM_ADMIN`. Three roles, no scoping. This is the
central gap.

---

## 2. Personas & access model (Product-lead view)

### A. External / market-side personas

| #   | Persona                                                               | Primary surface                         | Login                       | Core tasks                                                                                   | Needs platform login?        |
| --- | --------------------------------------------------------------------- | --------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------- |
| E1  | **Anonymous Visitor** (SEO, first touch)                              | Public web                              | None                        | Browse city pages, view event/community, submit a tip, file a report                         | No                           |
| E2  | **End User / Newcomer** (student, family, professional)               | Mobile app (primary), web `/me`         | Magic-link / Google / Apple | Save community/event, follow city, manage notification prefs, RSVP intent, submit suggestion | Yes (lightweight)            |
| E3  | **Community Organizer** (claims a community)                          | Organizer portal + mobile               | Magic-link                  | Claim + edit community page, create/edit events, manage access channels, see basic stats     | Yes                          |
| E4  | **Event Host** (one-off, may not own a community)                     | Organizer portal `events/new` lite flow | Magic-link                  | Submit & manage own event without community ownership                                        | **Partially missing**        |
| E5  | **Partner Org** (Consulate, GTAI, university Indian Society, chamber) | Organizer portal + bulk import          | Magic-link + sub-accounts   | Maintain resource pages, push event feeds, request verified badge                            | **Missing**                  |
| E6  | **Sponsor / Advertiser** (post-traction)                              | Sponsor portal                          | OAuth + billing             | Buy city placement, view impression analytics                                                | Not built (out of MVP scope) |
| E7  | **Press / Researcher**                                                | Public web + read-only API key          | API key                     | Pull anonymised aggregates, ecosystem reports                                                | **Missing**                  |

### B. Internal / company-side personas (from team grid)

| #   | Persona                                                                           | Hire stage (per grid)        | Interface                                                                        | Login                                       | Core tasks                                                                                                         | Access scope                             |
| --- | --------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| I1  | **Founder / Product (JP)**                                                        | Q2'26 → FT 2028              | Admin console + DB + ops scripts                                                 | `PLATFORM_ADMIN` magic-link + `OWNER` flag  | Strategic edits, schema migrations, prod ops, root impersonation                                                   | Global                                   |
| I2  | **X — Partnerships & Community** (Strategic Partner / Cofounder)                  | Q2'26 → Strategic 2028       | Admin: `claims`, `pipeline` (org curation), bulk import; organizer impersonation | New role `PARTNERSHIPS_LEAD`                | Approve community claims, run org outreach pipeline, verified-org badging, manage Resource directory               | Global, no destructive ops               |
| I3  | **Y — Ops & Community Growth** (the JD: "Founding Team — Community Growth & Ops") | Q2'26 PT → FT 2028           | Admin console + Outreach CRM + Social composer                                   | New role `OPS_LEAD`                         | Onboard communities, run outreach pipeline, schedule social posts, manage trackers, run digests                    | Global, content-write, no schema/billing |
| I4  | **City Ambassador** (the second JD)                                               | 2-3 in Q3'26 → 15-20 by 2028 | **City-scoped Ambassador console** + mobile                                      | New role `CITY_AMBASSADOR` (+ `cityScopes`) | Discover communities/events in their city, queue submissions, attend & log events, capture photos, ground feedback | **Scoped to assigned city/cities**       |
| I5  | **Content & Social Support** (PT intern from Q3'26)                               | PT                           | Social composer + asset library                                                  | New role `CONTENT_EDITOR`                   | Draft posts, schedule reels, attach community/event highlights                                                     | Content namespace only                   |
| I6  | **Freelance Engineer / AI Support**                                               | Adhoc → 2-3 lean by 2028     | GitHub + Vercel + DB readonly                                                    | OAuth via GitHub, no platform UI role       | Code, deploy, observe                                                                                              | Out-of-band (infra)                      |
| I7  | **AI Workflow Operator** (founder-driven → AI ops layer)                          | Internal                     | Admin `pipeline` + `keyword_suggestions` + LLM cost dashboard                    | `OPS_LEAD` or `PLATFORM_ADMIN`              | Tune prompts, approve auto-rules, review confidence thresholds                                                     | Pipeline namespace                       |
| I8  | **Growth & Partnerships Support**                                                 | 2027 PT → 1-2 hires 2028     | Admin `analytics` + Outreach CRM                                                 | `OPS_LEAD` (extension)                      | Track ecosystem KPIs, run outbound, partner-deck export                                                            | Read-most, write outreach                |

### C. System / non-human "personas"

| #   | Persona                           | Auth                 | Tasks                                                  |
| --- | --------------------------------- | -------------------- | ------------------------------------------------------ |
| S1  | Discovery Pipeline (LLM scrapers) | Internal cron secret | Insert `pipeline_items`, dedupe, propose merges        |
| S2  | Scoring Job                       | Cron secret          | Refresh `activity_score`, `trust_score`, `is_trending` |
| S3  | Notification Worker               | Cron secret          | Drain `notification_outbox` to push/email/inbox        |
| S4  | Partner Webhook (future)          | Signed HMAC          | Receive event feeds from Eventbrite/Meetup partners    |

---

## 3. Recommended role / permission model (see ADR-0005)

Replace the current `UserRole` enum with a role + scope model:

```prisma
enum UserRole {
  USER                // E2
  COMMUNITY_ADMIN     // E3 organizer (1..N claimed communities)
  EVENT_HOST          // E4 — owns events but no community
  PARTNER_ORG_ADMIN   // E5 — owns multiple communities/resources under an Org
  CITY_AMBASSADOR     // I4 — city-scoped internal
  CONTENT_EDITOR      // I5
  OPS_LEAD            // I3 / I8
  PARTNERSHIPS_LEAD   // I2
  PLATFORM_ADMIN      // I1
}

model RoleAssignment {
  id        String   @id @default(cuid())
  userId    String
  role      UserRole
  cityId    String?  // for CITY_AMBASSADOR
  orgId     String?  // for PARTNER_ORG_ADMIN
  grantedBy String
  grantedAt DateTime @default(now())
  revokedAt DateTime?
}
```

This unlocks per-city scoping (ambassadors), org grouping (consulates,
universities), and clean audit (`grantedBy`, `revokedAt`).

---

## 4. Interface inventory — what exists vs what to build

### 4.1 Public web — **Mostly complete**

- Done: city discovery, community/event detail, submit, report, `/me` —
  PRD-0003/0005/0006/0007/0009/0010.
- Gap: anonymous "claim this is my community" CTA already routes to organizer
  login; needs a Partner Org claim track (E5) — distinct from single-organizer
  claim.

### 4.2 Mobile app — **Mostly complete for E2**

- Done: auth, discover, inbox, save, push prefs, submit
  (TDD-0002, 0008, 0009).
- Gap: `CITY_AMBASSADOR` field-mode in mobile — quick "log this event I
  attended", attach photo, mark community as still-active. Currently
  ambassadors would have to use the web submit form.

### 4.3 Organizer portal — **Live but thin**

- Done: login, edit community, events list, channels, verify (PRD-0011).
- Gaps:
  1. **Multi-community ownership UI** — schema supports it
     (`User.claimedCommunities[]`) but UI assumes one. → PRD-0017
  2. **Event-only host flow (E4)** — no "I host events but don't run a
     community" path. → PRD-0017
  3. **Partner Org parent account (E5)** — no concept of an Organization that
     owns N communities + resources. (Deferred PRD)
  4. **Organizer analytics** — no impressions/saves dashboard. Data is in
     `UserInteraction` but unsurfaced. (Deferred PRD)
  5. **Verified badge request** — no workflow; today admin sets `TrustSignal`
     manually. (Deferred — extend PRD-0011)

### 4.4 Admin console — **Strong foundation, needs role-aware UX**

- Done: `submissions`, `claims`, `pipeline`, `scoring`, `data`, `merge`,
  `reports` (PRD-0012, 0013).
- Gaps:
  1. **Single role gate** — everything currently requires `PLATFORM_ADMIN`.
     Needs per-section RBAC so X (`PARTNERSHIPS_LEAD`) and Y (`OPS_LEAD`) can
     do their jobs without DB-superuser power. → PRD-0014
  2. **Audit log surface** — `ContentLog` exists but no admin page to view
     "who changed what." → PRD-0018
  3. **Bulk operations** — no CSV import for ambassadors' weekly community
     lists; no bulk verify/merge UI. (Deferred)
  4. **Outreach CRM** — no first-class object. Today community contact lives
     in `metadata` JSON. Y needs a pipeline of (Lead → Contacted → Demo →
     Onboarded) per community/organizer. → PRD-0016
  5. **Social composer** — no integration. Y/I5 work in Buffer/Notion today,
     disconnected from real community data. (Deferred PRD)

### 4.5 NEW: City Ambassador console — **Does not exist** → PRD-0015

Required scope (city-restricted via `RoleAssignment.cityId`):

- Dashboard: "your city this week" (new submissions, unverified communities,
  upcoming events).
- Quick-add wizard (mobile-first) for community/event/resource that lands in
  `pipeline_items` with `submittedBy = ambassador.id` and is auto-fast-tracked
  (lower confidence threshold).
- Event check-in + photo upload → bumps `activitySignals` + posts to
  `MediaAsset`.
- Personal scoreboard (success metrics from JD: communities identified,
  outreach contribution, social/content). Maps to a new `AmbassadorActivity`
  table or derived from `ContentLog` + `pipeline_items`.

### 4.6 NEW: Outreach / CRM module — **Does not exist** → PRD-0016

For Y (Ops) and X (Partnerships). Minimum viable:

```
OutreachLead { id, communityId?, suggestedName, cityId, ownerUserId, stage, nextActionAt, notes[] }
OutreachNote { id, leadId, authorId, body, createdAt }
OutreachStage enum { NEW, RESEARCHING, CONTACTED, IN_CONVERSATION, ONBOARDED, DECLINED, DORMANT }
```

Surface as `/admin/outreach` with kanban + per-ambassador filter.

### 4.7 NEW: Partner Org account — **Does not exist** (Deferred PRD)

```
Organization { id, name, type (CONSULATE|UNIVERSITY|CHAMBER|NPO|MEDIA), verified, contactUserId }
OrganizationMembership { orgId, userId, role }
Community.organizationId (nullable)
Resource.organizationId (nullable)
```

Lets a consulate manage many resources, lets a university Indian Students
Association onboard once and post events under that umbrella.

### 4.8 NEW: Social/Content module — **Does not exist** (Deferred PRD)

Y's JD explicitly covers LinkedIn/Instagram/Facebook growth. Realistic MVP: a
"highlight queue" inside admin that exports image+caption packs from existing
community/event data. Don't build a posting integration yet — keep humans in
the loop, save them composition time.

### 4.9 NEW: Partner / Read-only API — **Not built** (Deferred PRD)

For E7 (press/research), and to feed sponsor pitches. Add `ApiKey` model with
scope (`read:public`, `read:aggregates`) and rate-limit middleware.

---

## 5. Gap matrix — prioritized

| Priority           | Capability                                                      | Personas served | Effort | Spec                    |
| ------------------ | --------------------------------------------------------------- | --------------- | ------ | ----------------------- |
| **P0** (next 4-6w) | Expand `UserRole` + add `RoleAssignment` (city/org scope)       | I2, I3, I4, I5  | M      | ADR-0005 + PRD-0014     |
| **P0**             | RBAC middleware on admin routes (per-section)                   | I2, I3, I4      | S      | PRD-0014                |
| **P0**             | City Ambassador console v1 (dashboard + quick-add + scoreboard) | I4              | M-L    | PRD-0015                |
| **P1**             | Outreach CRM module (`OutreachLead`)                            | I2, I3, I8      | M      | PRD-0016                |
| **P1**             | Multi-community ownership UI in organizer portal                | E3              | S      | PRD-0017                |
| **P1**             | Event-only Host flow                                            | E4              | S      | PRD-0017                |
| **P1**             | Audit log viewer (`ContentLog` browser)                         | I1, I2          | S      | PRD-0018                |
| **P2**             | Partner Org accounts (`Organization` + memberships)             | E5              | M-L    | Deferred PRD            |
| **P2**             | Organizer analytics dashboard                                   | E3, E5          | M      | Deferred PRD            |
| **P2**             | Verified badge request workflow                                 | E3, E5          | S      | Deferred (extend 0011)  |
| **P2**             | Highlight/social asset export queue                             | I3, I5          | S-M    | Deferred PRD            |
| **P3**             | Read-only Partner API + `ApiKey` model                          | E7              | M      | Deferred PRD            |
| **P3**             | Sponsor portal                                                  | E6              | L      | Defer — post-traction   |
| **P3**             | Mobile ambassador field-mode                                    | I4              | M      | After ambassador web v1 |

---

## 6. Recommended next concrete steps

1. **Land ADR-0005 + PRD-0014** (role model + RBAC) — unblocks every internal
   hire after JP.
2. **Land PRD-0015** (City Ambassador console) — highest-leverage build for
   the first ambassador wave (Q3'26 per the team grid).
3. **Land PRD-0016** (Outreach CRM) — without this, Y will track communities
   in spreadsheets disconnected from production data, and we lose the
   strongest training signal for the AI pipeline.
4. **Defer**: sponsor portal, partner read-only API, multi-tenant org
   accounts — until traction justifies (per the simplicity guideline in
   `docs/deployment/`).
