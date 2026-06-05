# IndLokal — Phase 1: Discovery Foundation (Product Document)

**Status: Shipped / Live.** This is the "as-built" product document for Phase 1 of the [IndLokal product strategy](PRODUCT_DOCUMENT.md). It describes what exists in production today — the surfaces, the behavior, the data model, and the operating model — so the team, grant officers, partners, and future contributors have one authoritative description of the foundation that Phases 2–7 build on.

> **Why document a shipped phase?** Three reasons. (1) **Onboarding** — a new engineer, ambassador, or partner can understand the whole product without reading the codebase. (2) **Grant reporting** — Phase 1 is the integration utility funders are paying for; this is the evidence of what was delivered. (3) **Baseline discipline** — every later phase is defined as a layer _over_ Phase 1; you cannot reason about the journey layer without a precise description of the discovery layer beneath it.

> **Relationship to specs.** This is the durable product narrative for Phase 1. The source of truth for any individual capability remains its PRD/TDD/ADR under [docs/specs/](specs/README.md). Where a capability has a spec, it is cited inline.

---

## Table of Contents

1. [Phase 1 in One Page](#1-phase-1-in-one-page)
2. [Scope & Objectives](#2-scope--objectives)
3. [Personas Served](#3-personas-served)
4. [The Visitor Surface](#4-the-visitor-surface)
5. [The Operator Surface](#5-the-operator-surface)
6. [Search](#6-search)
7. [The Trust & Data Layer (L0)](#7-the-trust--data-layer-l0)
8. [The AI Content Pipeline](#8-the-ai-content-pipeline)
9. [Member Accounts & Mobile](#9-member-accounts--mobile)
10. [Information Architecture & Routes](#10-information-architecture--routes)
11. [Data Model](#11-data-model)
12. [Governance, RBAC & Moderation](#12-governance-rbac--moderation)
13. [Analytics & Retention](#13-analytics--retention)
14. [Success Metrics](#14-success-metrics)
15. [Explicitly Out of Scope for Phase 1](#15-explicitly-out-of-scope-for-phase-1)
16. [Known Gaps That Feed Phase 2](#16-known-gaps-that-feed-phase-2)
17. [Tech & Operations Summary](#17-tech--operations-summary)

---

## 1. Phase 1 in One Page

**What it is:** an activity-led, city-first discovery platform for the Indian diaspora in Germany. A newcomer can go from "I know nothing about my city" to "I'm in the right WhatsApp group" in minutes — with no account, on web or mobile — and the information is human-verified and kept fresh.

**The job it does:** answers _"What's happening for Indians in my city, who's active, and how do I get involved?"_ and connects that answer to action (the access-channel click).

**Two surfaces, deliberately separated:**

- **Visitor surface** — frictionless, no login, SEO-optimized. City feeds, communities, events, resources, search.
- **Operator surface** — authenticated workspaces (magic-link). Admin console, organizer console, event-host flow, AI pipeline review, RBAC.

**The substrate (L0, cross-cutting):** verification, community claim, moderation, scoring, and a structured graph — the trust layer that everything else is gated by and that later phases inherit.

**What makes it sustainable:** an AI ingestion pipeline does the heavy lifting on supply (source monitoring → extraction → dedup); humans own the publish decision. This keeps freshness affordable for a small team — the precondition for the grants-first funding model.

**Live footprint:** active metros are **Stuttgart (launch), Berlin, Munich, Frankfurt, Karlsruhe, Mannheim**, with metro-satellite rollups configured. English-language MVP.

---

## 2. Scope & Objectives

### 2.1 Objectives

1. **Prove city-first discovery** — that a structured, activity-led city experience beats Facebook groups, blog portals, and generic expat platforms for finding Indian community life.
2. **Build the trust + operator substrate** — verification, claim, moderation, scoring, and RBAC that all later phases depend on.
3. **Establish sustainable supply** — an AI-assisted pipeline + operator network (claim flow, ambassadors, outreach) that keeps the graph fresh without linear headcount growth.
4. **Earn SEO + recall** — server-rendered city pages for search visibility; a native mobile app for installed presence and saved-item recall.

### 2.2 In scope (and shipped)

City selection · city feed · event listing + detail · community explorer + detail · scope-resolved resources directory · national + city search across all three content types · community self-submission · community claim + organizer console · event-host flow · admin data/submissions/pipeline consoles · RBAC + scoped roles · AI ingestion + human moderation pipeline · scoring (activity/trust/completeness) · member accounts + saved items + persona/language prefs · native mobile app at member parity · retention producers (digest + reminders, INBOX channel) · analytics.

### 2.3 Design principles enforced in Phase 1

- **Activity drives everything** — the default surface is "this week," not a static directory; sparse content gracefully widens (this week → this month).
- **City-first** — every experience is scoped to a city; satellites roll up into their metro.
- **Discovery, not engagement** — IndLokal is a gateway. The conversion event is the **access-channel click** (Join via WhatsApp/Telegram), not time-on-site.
- **Low friction, high trust** — no login to browse; trust comes from verification, claim badges, and freshness signals, not crowdsourced volume.
- **Two-sided discipline** — the visitor surface never acquires an account requirement; the operator surface is a real product, not a back office.
- **AI for supply, humans for trust** — nothing publishes to users without a human approval.

---

## 3. Personas Served

Phase 1 surfaces are designed for three demand-side personas and a set of operator personas. (The Student / Family / Professional / Founder personas exist as content-shaping tags in Phase 1 — `personaSegments`, `audiences` — and become first-class **journeys** in Phase 2.)

**Demand-side (Phase 1 first-class):**

- **The Newcomer** — 0–12 months in Germany; needs orientation and community access; high urgency, low network. Key need: "show me what exists and how to join."
- **The Settled Explorer** — 1–5+ years; the retention persona; saved events + reminders. Key need: "what's happening that I don't know about?"
- **The Community Organizer** — runs a community; claims and maintains the listing via the organizer console. Key need: "help more people find us without me building a website."

**Operator personas (first-class product users):** Founder/Product (`PLATFORM_ADMIN`), Partnerships Lead (`PARTNERSHIPS_LEAD`), Ops Lead (`OPS_LEAD`), City Ambassador (`CITY_AMBASSADOR`, city-scoped), Content support (`CONTENT_EDITOR`), Event Host (`EVENT_HOST`). Mapped to [ADR-0005](specs/ADR/0005-role-and-scoped-permission-model.md); full matrix in [`docs/specs/AUDIT_PERSONAS_AND_INTERFACES.md`](specs/AUDIT_PERSONAS_AND_INTERFACES.md).

---

## 4. The Visitor Surface

The public, no-login experience. Server-rendered for SEO; the same backend powers the mobile app.

### 4.1 City selection (landing)

- Landing page (`/`) shows supported cities (active + upcoming) with a city picker.
- Selecting a city scopes all subsequent content; the city persists in the URL.
- **Upcoming cities** redirect to a `/[city]/coming-soon` page (signals intent without showing an empty product).

### 4.2 City feed (`/[city]/`) — the primary discovery surface

Assembled by `modules/discovery` (`getCityFeed`). The feed is **activity-led**, with built-in sparse-content resilience. Composition (`CityFeedData`):

- **This Week** — upcoming events in the next 7 days. If sparse, automatically **expands to 30 days** (`expandedTo30Days` flag, surfaced honestly in the UI).
- **Active Communities** — top communities ranked by `activityScore`.
- **Recently happened** — recent past events, to prove the city is active even between upcoming events.
- **Browse by Category** — category grid with per-category community counts.
- **Counts** — communities, upcoming events, categories (for honest density signaling).

**Sparse-content behavior:** zero upcoming → show "this month" + recent past; low upcoming (≤3) → widen; never render an empty-looking feed.

### 4.3 Events — listing & detail

- **Listing** (`/[city]/events/`) — time-filtered, category/cost/type filters, default sort soonest-first. Recurring events show a recurrence badge with human-readable RRULE text.
- **Detail** (`/[city]/events/[slug]/`) — full event info, venue/online, hosting community (linked), access/registration links, recurrence info, share, "more from this community." JSON-LD Event schema for SEO.
- **Visibility gating:** only `moderationState = PUBLISHED` events are publicly readable (ADR-0009). Host-submitted events stay `PENDING_REVIEW` until an admin approves.

### 4.4 Communities — explorer & detail

- **Explorer** (`/[city]/communities/`) — filter by category, persona, language; sort by activity/alphabetical/recently-added/most-events. Cards show activity indicator, approximate member count, verified/claimed badge, upcoming-event count.
- **Detail** (`/[city]/communities/[slug]/`) — full profile, category/persona/language tags, **access channels** (WhatsApp/Telegram/website/Instagram each as a clear CTA — the conversion point), upcoming + past events, verified/claimed badge, "suggest an edit." JSON-LD Organization schema.
- **Canonical routing:** satellite-city community URLs canonicalize to their metro root (avoids bounce-to-metro-home bugs).

### 4.5 Resources (`/[city]/resources/`)

A **structured, scope-resolved directory** (not a blog), powered by `modules/resources`.

- **Scope stacking** (most-specific wins): `CITY → METRO → STATE → COUNTRY → GLOBAL`. A Stuttgart visitor sees city-specific resources plus BW-state, Germany-national, and global resources, layered by the resolver.
- **Consular jurisdiction filtering** — consular resources (Berlin Embassy, CGI Frankfurt, CGI Munich) only surface for cities under that post's jurisdiction.
- **Taxonomy** — 15 `ResourceType`s spanning consular/official, German bureaucracy (registration, driving, housing, health, family), work & money (jobs, tax, business setup), and everyday life (grocery/food).
- **Curation & freshness** — `isEssential`, `priority`, `validFrom`/`validUntil`, `lastReviewedAt` + `reviewCadenceDays` (default 180d).
- **Latent journey tags (key for Phase 2):** every resource also carries `audiences[]` (NEWCOMER/FAMILY/FOUNDER/EMPLOYEE/STUDENT/STUDENT_VISA/SENIOR/RETURNEE) and `lifecycleStage[]` (PRE_ARRIVAL/FIRST_30_DAYS/FIRST_90_DAYS/SETTLED/ANYTIME). In Phase 1 these are filter/resolution inputs; in Phase 2 they become the composition keys for journeys. (A resources `journey` API route already exists as an early seam.)

### 4.6 Community submission (`/submit/`)

The visitor-side supply rail. No account required. Persists as `Community { source: COMMUNITY_SUBMITTED, status: UNVERIFIED }` into the **admin Submissions queue**. Anti-abuse via per-IP rate-limit + honeypot. This is what makes the admin queue worth maintaining — organic supply without cold outreach.

### 4.7 Programmatic SEO pages

Auto-generated, structured (not thin) pages targeting long-tail queries: `/[city]/consular-services/`, `/[city]/indian-events-this-week/`, language/category variants. Each links into real structured data. (Per the SEO-strategy note, we avoid doorway-style thin keyword pages and strengthen authority pages instead.)

---

## 5. The Operator Surface

Authenticated workspaces — magic-link sign-in, 7-day sliding sessions, visible sign-out, cascade-safe writes. Treated as a product (the operator network is a core moat).

### 5.1 Authentication (shipped)

- **Magic-link, no passwords** at `/admin/login` and `/organizer/login`. Single-use, SHA-256-hashed, 24h-TTL tokens; verify uses 303 redirect so email scanners can't consume the token (2-min grace for races). [PRD-0011](specs/PRD/0011-magic-link-admin-organizer-auth.md).
- **7-day sliding sessions** — httpOnly, DB-backed (hashed), auto-extend on activity. [TDD-0011](specs/TDD/0011-magic-link-admin-organizer-auth.md).
- **Email transport** — Resend in production (`noreply@indlokal.com`), Mailpit in dev; send failures throw ([ADR-0004](specs/ADR/0004-email-transport-resend-throw-on-failure.md)).

### 5.2 Platform Admin console (`/admin/*`)

- **Data console** (`/admin/data`) — full CRUD for communities/events/cities/resources with city/type/search filters and transactional, cascade-safe deletes (deleting a community removes its channels/signals/claims/event refs; cities refuse deletion when referenced). Offset pagination (default 25, max 100). [PRD-0012](specs/PRD/0012-admin-data-management-console.md).
- **Submissions queue** (`/admin/submissions`) — source-scoped to user-submitted communities; approving promotes `UNVERIFIED → ACTIVE`.
- **AI Pipeline review queue** (`/admin/pipeline`) — items extracted by the pipeline; approval lands content as `UNVERIFIED` (still requires a verification pass), never auto-publish. [PRD-0013](specs/PRD/0013-pipeline-review-and-submissions-queue.md).
- **Events review queue** (`/admin/events`) — approve/reject host-submitted `PENDING_REVIEW` events; emails + analytics on decision (ADR-0009 / PRD-0037).
- **Verification & status** — mark verified; toggle Active/Inactive/Unverified.
- **Audit log viewer** (`/admin/audit`) — paginated, filterable view over `ContentLog` (entity/action/actor/date), with pretty diffs and role-grant entries. [PRD-0018](specs/PRD/0018-audit-log-viewer.md).
- **Bulk import** — communities/events from CSV/JSON.

### 5.3 Community Organizer console (`/organizer/*`)

- Sign in via magic link; **claim** an unclaimed listing (`claimState: UNCLAIMED → CLAIM_PENDING → CLAIMED`).
- Edit profile (incl. `organizationType`), manage access channels, add/edit events (community-lane events publish immediately via `canEditCommunity`).
- **Multi-community workspace switcher** for organizers running several communities (PRD-0017).
- **Collaborators** — invite/manage collaborators; two-role membership model (`COMMUNITY_ADMIN` owner + `COLLABORATOR`), transfer ownership with a last-owner guard (ADR-0008 / PRD-0036).
- **Reach panel** — read-only 30-day reach (views/access-clicks/saves) for the community and its events (PRD-0050).

### 5.4 Event Host workspace (`/organizer/host/*`)

A lightweight surface for independent hosts (concert promoters, freelance teachers) who run events but no community. Dashboard with live/in-review/declined/past stats, completeness meter, profile, and event creation (host-lane events are `PENDING_REVIEW` until admin approval, with an unverified-upcoming cap). PRD-0038.

### 5.5 City Ambassador & Outreach (operator network)

- **City Ambassador** role (`CITY_AMBASSADOR`, scoped via `RoleAssignment.cityId`) can fast-track pipeline approvals and record `EVENT_VERIFIED_ATTENDED` check-ins (deduped per ambassador+event). PRD-0015.
- **Outreach CRM** (`OutreachLead` + `OutreachNote`) — lead pipeline `NEW → RESEARCHING → CONTACTED → IN_CONVERSATION → ONBOARDED` (+ `DECLINED`/`DORMANT`), linking onboarded communities back to their lead. Data model shipped; richer UI is a Phase 2+ item. PRD-0016.

---

## 6. Search

Unified search across **all three content types**, powered by `modules/search` over PostgreSQL full-text search (tsvector/tsquery) with blended ranking.

- **National scope** — `/search?q=` searches all of Germany (no city default). The home search and the WebSite JSON-LD `SearchAction` target this.
- **City scope** — `/[city]/search?q=` scopes to the city + its satellites.
- **What it searches** — `searchCommunities`, `searchEvents`, and `searchResources` (incl. national `city_id IS NULL` rows, `is_hidden=false`, validity-window check, `isEssential` boost). `searchAll` returns a `COMMUNITY | EVENT | RESOURCE` union, grouped, cursor-paginated.
- **Ranking** — communities `ts_rank × (1 + trust/100 + activity/200)`; events get a recency boost; resources boost essentials. ILIKE partial-match fallback.
- **Telemetry** — `recordSearchInteraction()` writes a `UserInteraction(SEARCH)` row capturing query, scope, results count, and `hasResults`, so **zero-result queries** (content gaps) are measurable without a new event name. (PRD-0048.)

> **Strategic note:** search is already national and multi-type — it is _not_ a Phase-2 gap. It is the substrate for journey discovery later.

---

## 7. The Trust & Data Layer (L0)

The cross-cutting substrate that gates every surface and is the platform's primary moat. All of it is shipped.

- **Verification** — `TrustSignal` types: `ADMIN_VERIFIED`, `COMMUNITY_CLAIMED`, `USER_REPORTED_ACCURATE`, `USER_REPORTED_STALE`, `EDITORIAL_REVIEWED` (polymorphic over community/event).
- **Claim state** — `Community.claimState` (`UNCLAIMED → CLAIM_PENDING → CLAIMED`), distinct from lifecycle `status`. Claim is the human-vouching event that an AI answer cannot fabricate.
- **Activity signals** — `ActivitySignal` types: `EVENT_CREATED`, `PROFILE_UPDATED`, `MEMBER_COUNT_CHANGED`, `LINK_VERIFIED`, `EVENT_IMPORTED`, `EXTERNAL_MENTION`, `EVENT_VERIFIED_ATTENDED` (ambassador check-in).
- **Scoring** (`modules/scoring`) — composite **Pulse Score**: `activityScore`, `trustScore`, `completenessScore`, `scoreBreakdown` (JSON), `isTrending`. Updated by a scoring cron. Numeric scores are stored but **not publicly surfaced** in Phase 1 (qualitative labels only) until enough behavioral data exists.
- **Freshness ladder** — age-based downranking (0–30d active → 90d+ flagged) + "last updated" badges + link-health checks.
- **Relationship graph** — `RelationshipEdge` (typed edges: `RELATED_COMMUNITY`, `SISTER_CHAPTER`, `CO_HOSTED`, `PARENT_CHILD`, `SAME_ORGANIZER`, with strength). Model shipped; population/activation is Phase 4.
- **Provenance** — `ContentSource` (`ADMIN_SEED`, `COMMUNITY_SUBMITTED`, `IMPORTED`, `USER_SUGGESTED`) + `ContentLog` audit trail.

---

## 8. The AI Content Pipeline

`modules/pipeline` — the capability that makes ongoing freshness affordable for a small team. **AI does the research; humans approve the results.**

**Flow:** scheduled source monitoring (Facebook/Instagram/Eventbrite/Meetup/Google alerts/DB-pinned URLs/keyword searches/community suggestions — 15+ source types) → cheap LLM **filter** (keep/drop batch, fail-closed) → batch **extraction** with city assignment + confidence → **dedup** against existing entities → **admin review queue**. Nothing publishes without human approval; approved items land as `UNVERIFIED`.

**Reliability & cost discipline (all shipped):**

- **DB-driven config** — regions/strategies/keywords/pinned sources live in `pipeline_source_configs` with a JSON fallback; no hardcoded arrays.
- **Scoped runs** — CLI + cron accept `region`/`city` scope; pinned sources carry `scope` (CITY/REGION/GENERIC) + hints; per-region dispatcher fans out with bounded concurrency.
- **Cost guards** — per-run token budget (default 200k), LLM circuit breaker, advisory locks prevent concurrent runs.
- **Full audit** — every LLM call logged (`PipelineLlmCall`: stage/model/tokens/duration/ok), every run summarized (`PipelineRun`: counts, failures, budget/circuit flags). This audit trail is also the evidence shown to grant officers that the AI capability is real and human-supervised.
- **Production schedule** — region shards run nightly via GitHub Actions cron (Berlin, Baden-Württemberg, Bavaria, Hesse).

**Cost reality:** ~1–2 hrs/week of human queue review + ~$6–18/month LLM cost, vs 10+ hrs/week of fully-manual research.

---

## 9. Member Accounts & Mobile

### 9.1 Member accounts (web + mobile)

- **Auth** — passwordless magic link, plus Google/Apple OAuth on mobile.
- **Profile** — `displayName`, city preference, `personaSegments[]`, `preferredLanguages[]` (the data that powers Phase-3 personalization).
- **Saved items** — `SavedCommunity` (follow) + `SavedEvent` (save), persisted across sessions and devices.
- **`/me`** — saved lists, preference form, sign-out.

### 9.2 Native mobile app (Expo, iOS/Android)

Built for **recall** (installed presence, saved items, push-ready), not as a second social product. At member parity with web (PRD-0040).

- **Tabs** — Discover (Events / Communities / trending), Search, Bookmarks (saved + followed), Me.
- **Parity modules** — pure logic in `lib/**/<name>.ts` (node-testable) + Expo bindings in `<name>.expo.ts`: analytics, image upload, profile edit, persistent offline cache (discover feed hydrates from cache first), this-week discovery, consular resources, reporting.
- **Backend** — shares the web backend via a versioned `/api/v1/*` surface (auth, me, devices, discovery, communities, events, cities, resources incl. a `resources/journey` seam, search, submissions, reports, notifications inbox, track).

### 9.3 Retention loop (activated, INBOX channel)

First outbox producers are live: **weekly city digest** (`enqueueWeeklyDigest` — events next 7d for users who saved something in that city) and **saved-event reminders** (`enqueueSavedEventReminders` — events 24–48h out). Both write to the `InboxItem` channel today; PUSH/EMAIL transports are wired but deferred until credentials/usage justify them. Gated by `RETENTION_PRODUCERS_ENABLED`. (PRD-0049.)

---

## 10. Information Architecture & Routes

```
Visitor surface
  /                                   Landing → city selection
  /[city]/                            City feed (this week + active communities + categories)
  /[city]/events/                     Event listing  →  /[city]/events/[slug]/
  /[city]/communities/                Community explorer  →  /[city]/communities/[slug]/
  /[city]/resources/                  Scope-resolved resources directory
  /[city]/search/                     City-scoped search (communities + events + resources)
  /[city]/consular-services/          Programmatic SEO
  /[city]/indian-events-this-week/    Programmatic SEO (temporal)
  /[city]/coming-soon/                Upcoming-city placeholder
  /search?q=                          National search across Germany (all three types)
  /submit/                            Visitor community submission rail
  /about/                             About

Operator surface
  /organizer/(community)/*            Organizer console (claim, profile, events, channels, collaborators)
  /organizer/host/*                   Event-Host workspace
  /admin/*                            Admin (data, submissions, pipeline, events, audit, outreach)
  /ambassador/*                       City Ambassador console (city-scoped)

Member
  /me/                                Saved items + preferences
  /auth/*                             Magic-link / OAuth flows

Mobile API
  /api/v1/*                           Versioned backend for the Expo app
```

**URL discipline:** city-first URLs (`indlokal.com/stuttgart/communities/<slug>/`) are canonical and SEO-critical. The Phase-2 journey layer will overlay (`/[city]/journeys/[persona]/`) and link _into_ these — it will not replace them.

---

## 11. Data Model

Core entities (Prisma; see [apps/web/prisma/schema.prisma](../apps/web/prisma/schema.prisma)):

| Entity                                                                  | Role                                | Notable fields                                                                                                                                                                              |
| ----------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **City**                                                                | Primary partition for all discovery | `slug`, `state`, metro support (`isMetroPrimary`, `metroRegionId` self-join), `timezone`, `isActive`                                                                                        |
| **Community**                                                           | Central node                        | `claimState`, `status`, `personaSegments[]`, `languages[]`, `organizationType`, scores (`activity/trust/completeness`, `scoreBreakdown`, `isTrending`), `source`, merge fields              |
| **Event**                                                               | Retention driver                    | `moderationState` (PUBLISHED/PENDING_REVIEW/REJECTED), lifecycle `status`, `createdByUserId`, `reviewedById`, recurrence (`isRecurring`, `recurrenceRule`), online/venue, `registrationUrl` |
| **Resource**                                                            | Journey atom                        | `resourceType` (15), `scope`+`scopeRegion`, `audiences[]`, `lifecycleStage[]`, `isEssential`, `priority`, validity + review cadence                                                         |
| **AccessChannel**                                                       | Discovery→engagement bridge         | `channelType` (WhatsApp/Telegram/…), `url`, `isPrimary`, `isVerified`                                                                                                                       |
| **TrustSignal / ActivitySignal**                                        | L0 scoring inputs                   | typed signals, polymorphic where relevant                                                                                                                                                   |
| **RelationshipEdge**                                                    | Community graph                     | typed edges + strength                                                                                                                                                                      |
| **Category**                                                            | Taxonomy                            | hierarchical (`parentId`), `CATEGORY`/`PERSONA` types                                                                                                                                       |
| **User / RoleAssignment**                                               | Identity + RBAC                     | `role`, scoped `RoleAssignment` (cityId/orgId), persona/language prefs, OAuth ids                                                                                                           |
| **CommunityCollaborator**                                               | Authoritative membership            | `role` (COMMUNITY_ADMIN/COLLABORATOR), `status`, `source`                                                                                                                                   |
| **OutreachLead / OutreachNote**                                         | Operator CRM                        | stage workflow + audit notes                                                                                                                                                                |
| **PipelineItem / PipelineRun / PipelineLlmCall / PipelineSourceConfig** | AI pipeline                         | extraction, run audit, per-call audit, DB-driven config                                                                                                                                     |
| **UserInteraction**                                                     | Behavioral telemetry                | VIEW/CLICK_ACCESS/SAVE/SHARE/REPORT/SEARCH                                                                                                                                                  |
| **ContentReport / ContentLog**                                          | Moderation + audit                  | report types; full action log                                                                                                                                                               |
| **SavedCommunity / SavedEvent**                                         | Member saves                        | follow/save                                                                                                                                                                                 |
| **Notification\* / InboxItem / Device / QuietHours**                    | Retention rails                     | outbox, inbox, push devices                                                                                                                                                                 |

---

## 12. Governance, RBAC & Moderation

- **Platform RBAC** (ADR-0005 / PRD-0014) — `UserRole` enum (USER, COMMUNITY_ADMIN, EVENT_HOST, PARTNER_ORG_ADMIN, CITY_AMBASSADOR, CONTENT_EDITOR, OPS_LEAD, PARTNERSHIPS_LEAD, PLATFORM_ADMIN) + scoped `RoleAssignment`. Authorization flows through a central `can()` / `assertCan()` helper, not ad-hoc `isAdmin` checks.
- **Community RBAC v2** (ADR-0008 / PRD-0036, flag-free) — `CommunityCollaborator` is the authoritative membership; exactly one `COMMUNITY_ADMIN` (synced to `Community.claimedByUserId`), everyone else `COLLABORATOR`. Permissions via `lib/auth/community-permissions.ts` (EDIT roles = owner+collaborator; MANAGE = owner only). Ownership transfer demotes prior owner, with a last-owner guard; all changes write `ContentLog`.
- **Event moderation** (ADR-0009 / PRD-0037) — orthogonal axes: `EventModerationState` (publish gate) × `EventStatus` (lifecycle). Community-lane → PUBLISHED on create; host/public/pipeline lane → PENDING_REVIEW → admin approve/reject. All public reads gate on `PUBLISHED`.
- **Content moderation** — `ContentReport` (STALE_INFO/BROKEN_LINK/INCORRECT_DETAILS/SUGGEST_COMMUNITY/OTHER) into an admin queue; high-impact actions use a confirmation modal pattern.
- **Auditability** — `ContentLog` records CREATED/UPDATED/VERIFIED/ARCHIVED/SCORE_REFRESHED/ROLE_GRANTED/ROLE_REVOKED with actor + source; surfaced via the audit log viewer. Role-scoped delegation is only safe because it's reviewable.

---

## 13. Analytics & Retention

- **Behavioral telemetry** — `UserInteraction` captures VIEW / CLICK_ACCESS / SAVE / SHARE / REPORT / SEARCH per user/session/entity. The **access-channel click** is the headline conversion event.
- **Product analytics** — PostHog with canonical snake_case event names centralized in `lib/analytics/events.ts` (PRD-0042); emitted consistently from web and mobile; `/api/v1/track` is canonical-only. Lifecycle events (`USER_LOGGED_IN`, `USER_SIGNED_UP`) on real auth/signup flows. Server client is non-blocking.
- **Organizer/host reach** — read-only 30-day reach panels (PRD-0050).
- **Zero-result search analytics** — surfaces content gaps to prioritize supply.
- **Retention** — weekly digest + saved-event reminders (INBOX channel; PUSH/EMAIL deferred).

---

## 14. Success Metrics

**North Star:** Weekly Active Discovery Sessions per city — unique weekly sessions that view ≥1 community/event detail page.

**Activation funnel (first 3 months):** city landing pageviews → detail view (35–50%) → **access-channel click (12–20%, the conversion event)** → 7-day return (18–30%).

**Supply & quality:** comprehensive Stuttgart coverage; events for the next 30 days; complete-profile % (target 60%+); average events/community (2+); **zero-result search rate < 20%**; 5+ organizer relationships; claimed communities; visitor-submitted communities; programmatic SEO pages indexed (15+); organic search visits/week (100+); mobile preview installs + push opt-in.

**Leading indicators:** zero-result queries, access-CTR, city-feed bounce, events/week/city, time-to-first-access-click.

---

## 15. Explicitly Out of Scope for Phase 1

By design — these are later layers or deliberate non-goals (see the [main strategy](PRODUCT_DOCUMENT.md) §5.2 and roadmap):

- **No journey composition surface** — persona × stage tags exist on data, but there is no journey UI yet (that's Phase 2).
- **No personalization / recommendations / concierge** — the mobile "For you" is city trending, not personalized (Phase 3).
- **No Business or Connect products** — gated, not dated (strategy §12).
- **No public Pulse Score** — numeric scores stored but not shown until behavioral data is dense (Phase 3).
- **No PUSH/EMAIL retention transports live** — wired, deferred to INBOX until usage justifies.
- **No partner-org / sponsor / speaker products** — hooks exist (`PARTNER_ORG_ADMIN`, `RelationshipEdge`); activation is Phase 4.
- **Not a social network, classifieds platform, blog, or generic marketplace** — permanent non-goals.

---

## 16. Known Gaps That Feed Phase 2

The honest list of what Phase 1 does _not_ yet do, which Phase 2 (Journey Layer) addresses:

1. **Composition gap (the core one)** — the platform organizes around content types, not the user's transition. Data is tagged for journeys (`audiences` × `lifecycleStage`) but never assembled around the user.
2. **No journey entry point** — navigation is content-type-first; there's no "I'm a student / family / professional / founder" door.
3. **Trust is under-surfaced** — verification/claim/freshness exist but aren't presented to users as _the reason to choose IndLokal over an AI answer_.
4. **Tag-coverage debt** — journeys are only as good as `audiences`/`lifecycleStage`/`personaSegments` coverage; a coverage audit is the first Phase-2 task.
5. **Resources presented flat** — the directory is structured but shown as lists, not as action-ending journey assets.

None of these is an _infrastructure_ gap — they are composition/presentation gaps over data Phase 1 already collects. That is what makes Phase 2 cheap and non-disruptive.

---

## 17. Tech & Operations Summary

- **Stack** — Next.js (App Router) web + Expo (React Native) mobile + shared `@indlokal/shared` package; PostgreSQL via Prisma; PostgreSQL FTS for search; PostHog analytics; Resend email.
- **Deployment** — Vercel (web, root `apps/web`, `build:vercel` = `prisma generate && migrate deploy && next build`) + Neon Postgres + Expo EAS (mobile). Pipeline cron via GitHub Actions region shards.
- **Seeding** — three-tier: `bootstrap` (cities/categories/taxonomies) → `directory` (real researched communities/resources, evidence-gated) → `demo` (local/preview only, never production). [ADR-0003](specs/ADR/0003-three-tier-database-seeding.md).
- **Workflow** — spec-first (PRD/TDD or ADR under `docs/specs/` before non-trivial work); long-lived `main`/`develop` with real merge commits; linear-history protection on `main`.
- **Quality bar** — TypeScript strict; web vitest suite green; mobile pure-logic node tests; lint clean.

---

_This document describes Phase 1 as built. For the company-level thesis, the journey reframe, the moat hierarchy, the AI line, the decision gates for Business/Connect, and the full 7-phase roadmap, see the [IndLokal Product Strategy & Product Document](PRODUCT_DOCUMENT.md)._
