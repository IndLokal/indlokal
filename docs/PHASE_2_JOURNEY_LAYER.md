# IndLokal — Phase 2: Journey Layer (Product Document)

**Status: Implemented / Shipped (behind a feature flag).** This is the product document for Phase 2 of the [IndLokal product strategy](PRODUCT_DOCUMENT.md). Where the [Phase 1 document](PHASE_1_DISCOVERY_FOUNDATION.md) describes the shipped foundation, this describes the Journey Layer **as designed _and_ as built** — the composition engine, web surfaces, gating, analytics, and tag-coverage operations are live in `apps/web`, gated by the `JOURNEY_LAYER_ENABLED` flag plus a city×persona allowlist (default: Stuttgart × Young Family). Rollout to additional cities/personas is a content-density decision (flip the allowlist), not new engineering.

> **The one-sentence thesis:** Phase 2 turns IndLokal from **content discovery** ("here are the communities/events/resources in your city") into **journey discovery** ("here's how to navigate _your_ transition — student, family, professional, founder — in this city"), by **composing data the platform already collects**, without re-architecting Phase 1 and without disrupting the live product.

> **Built to spec.** The capabilities below shipped as PRD/TDD pairs (plus an ADR for the journey-composition model) under [docs/specs/](specs/README.md): [ADR-0011](specs/ADR/0011-journey-composition-model.md) (composition model), [PRD-0052](specs/PRD/0052-journey-layer-composition-and-first-journey.md)/[TDD-0052](specs/TDD/0052-journey-layer-composition-and-first-journey.md) (engine + first journey), and [PRD-0053](specs/PRD/0053-journey-tag-coverage-and-tagging-ops.md)/[TDD-0053](specs/TDD/0053-journey-tag-coverage-and-tagging-ops.md) (tag coverage & tagging ops). This document records the product intent the specs delivered; **"As built" call-outs mark where the shipped implementation differs from the original design.**

---

## Table of Contents

1. [Why Phase 2, and Why Now](#1-why-phase-2-and-why-now)
2. [What a Journey Is (Precise Definition)](#2-what-a-journey-is-precise-definition)
3. [The Foundation Already in Place](#3-the-foundation-already-in-place)
4. [Scope: In / Out](#4-scope-in--out)
5. [The Six Launch Journeys](#5-the-six-launch-journeys)
6. [The Journey Composition Model](#6-the-journey-composition-model)
7. [User Experience & Surfaces](#7-user-experience--surfaces)
8. [Information Architecture (Overlay, Not Replacement)](#8-information-architecture-overlay-not-replacement)
9. [Data & Schema Plan](#9-data--schema-plan)
10. [Content & Tagging Operations](#10-content--tagging-operations)
11. [Dynamic vs Materialized Journeys](#11-dynamic-vs-materialized-journeys)
12. [SEO Strategy](#12-seo-strategy)
13. [Sparsity & Quality Guardrails](#13-sparsity--quality-guardrails)
14. [Success Metrics](#14-success-metrics)
15. [Sequenced Build Plan](#15-sequenced-build-plan)
16. [Risks & Mitigations](#16-risks--mitigations)
17. [Explicitly Out of Scope (Deferred to Phase 3+)](#17-explicitly-out-of-scope-deferred-to-phase-3)
18. [Exit Criteria → Phase 3](#18-exit-criteria--phase-3)

---

## 1. Why Phase 2, and Why Now

Phase 1 proved that a structured, activity-led city experience beats fragmented Facebook groups and blog portals for **finding** Indian community life. But it organizes everything around **what we store** (communities / events / resources), not around **why users come**. Users do not arrive with a "community problem." They arrive mid-**transition**:

> _"I'm moving to Stuttgart as a young family — what do I do, and in what order?"_
> _"I'm a student starting at Uni Stuttgart — where do I live and who are my people?"_
> _"I just got a Blue Card offer at Bosch — housing, taxes, networking?"_

Phase 1 has the answers to all of these scattered across three content types. The user is asked to do the integration work themselves — translate their life question into our storage taxonomy, then stitch the pieces together. **Phase 2 does that stitching for them.**

**Why now (and not later):**

1. **The thesis ceiling.** A content-type directory is the most copyable thing on the internet and is being commoditized by AI answers in real time. "List Indian communities in Stuttgart" is a free LLM prompt. Journeys — verified, city-specific, stage-ordered, action-linked — are not (strategy §11, §18).
2. **The data is already there.** The journey scaffolding exists in the schema as underused tags (§3). Phase 2 is mostly composition, so the cost/risk is low and the payoff is a genuine category shift.
3. **It compounds into every later phase.** Personalization (Phase 3) reranks journeys; ecosystem orgs (Phase 4) slot into journeys; Business/Connect (Phase 5/6) are demand-sensed through journeys; Intelligence (Phase 7) reports on journey completion. Journeys are the spine the upper layers hang on.

---

## 2. What a Journey Is (Precise Definition)

A **Journey** is a composed, guided experience for a person navigating a specific transition. Formally:

```
Journey = f(audience/persona, lifecycle stage, city, language)
        → ordered bundle of { resources, communities, events, ecosystem orgs, actions }
```

**A journey IS:**

- A **composition rule** over existing tagged data (resources by `audiences`×`lifecycleStage`, communities by `personaSegments`/`languages`, events, later ecosystem orgs).
- **Stage-aware** — the same family needs different things `PRE_ARRIVAL` vs `FIRST_90_DAYS`.
- **Action-ending** — every block resolves to a verified access channel, a saved item, an official link, or a checklist step.
- **An overlay** — an additional entry point that links _into_ Phase 1 pages, never replacing them.

**A journey is NOT:**

- A new content type or a hand-authored article CMS (we compose, we don't author).
- A blog (the old "Resources" failure mode — strategy §8).
- A social feed, a chat, or a marketplace (permanent non-goals, strategy §5.2).
- A static page that only informs — if it doesn't drive an action, it failed.

---

## 3. The Foundation Already in Place

This is the single most important section for understanding why Phase 2 is low-risk. **The journey primitives already exist and are partially wired.**

### 3.1 Tags that already carry journey meaning

| Journey dimension  | Backing field (shipped in Phase 1)                                                                      | Where                               |
| ------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Audience / persona | `Resource.audiences[]` — `NEWCOMER, FAMILY, FOUNDER, EMPLOYEE, STUDENT, STUDENT_VISA, SENIOR, RETURNEE` | `schema.prisma`, `ResourceAudience` |
| Audience / persona | `Community.personaSegments[]`, `User.personaSegments[]`                                                 | `schema.prisma`                     |
| Lifecycle stage    | `Resource.lifecycleStage[]` — `PRE_ARRIVAL, FIRST_30_DAYS, FIRST_90_DAYS, SETTLED, ANYTIME`             | `ResourceStage`                     |
| City / geography   | `Resource.scope`+`scopeRegion`, `Community.cityId`, `Event.cityId`, metro rollup                        | resolver in `modules/resources`     |
| Language / culture | `Community.languages[]`, `User.preferredLanguages[]`                                                    | `schema.prisma`                     |
| Organization type  | `Community.organizationType` (9-value enum)                                                             | `OrganizationType`                  |
| Relationships      | `RelationshipEdge` (typed edges + strength)                                                             | `schema.prisma`                     |

### 3.2 An existing journey seam (honest starting point)

There is **already** a partial journey API: `GET /api/v1/cities/:slug/resources/journey` ([route](../apps/web/src/app/api/v1/cities/[slug]/resources/journey/route.ts), PRD/TDD-0030) returns **essentials-only resources grouped by lifecycle stage** (`PRE_ARRIVAL → … → ANYTIME`), backed by `getResourcesForCity(slug, { essentialsOnly: true })`.

**What this proves:** the stage-grouping primitive and the scope resolver work today.

**What it is missing (the Phase-2 delta):** it is (a) **resources-only** — no communities, events, or ecosystem orgs; (b) **not persona-aware** — it groups by stage but doesn't filter by audience; (c) **not action-oriented** — it returns items, not a guided "do this next" experience; (d) **API-only** — no web surface, no entry point. Phase 2 extends this seam from "stage-grouped resource list" into "persona × stage, multi-entity, action-ending journey."

### 3.3 What this means for cost

Because the tags, the resolver, scope stacking, the metro rollup, the trust/moderation gating, member persona prefs, and a stage-grouping seam all exist, **Phase 2 adds composition logic and presentation surfaces — not new storage or a new ingestion path.** This is the core reason Phase 2 is a category shift at a fraction of Phase 1's cost.

---

## 4. Scope: In / Out

### 4.1 In scope (Phase 2)

1. **Journey entry points** — a persona selector ("I'm a student / family / professional / founder / skilled worker / business") on the national + city journeys hubs and a strip on the city feed.
2. **The six launch journeys** (§5), composed dynamically from existing tags.
3. **The journey composition engine** (§6) — a `modules/journeys` module that assembles resources + communities + events (+ ecosystem orgs when available) for `(persona, stage, city, language)`.
4. **Journey surfaces** (§7) — web journey hub + city×persona journey pages; mobile journey entry; member "save this journey."
5. **Flagship journey assets** — e.g. "Moving to Stuttgart as a Young Family," each block ending in an action.
6. **Tag-coverage operations** (§10) — audit + backfill so journeys are dense enough to be good.
7. **Optional thin materialization** for proven-dense cities (§11) — pinned ordering + editorial intro, not a CMS.
8. **Journey analytics** — progression, save, and journey→access-channel conversion.

### 4.2 Out of scope (Phase 2 — deferred)

- **Personalization / recommendations / concierge** → Phase 3. Phase-2 journeys are persona-_selected_ (the user picks), not persona-_inferred_ (the system predicts).
- **Ecosystem orgs / partner orgs / sponsors as journey blocks** → wired as an _optional_ block that's empty until Phase 4 populates it; no partner-org product built here.
- **Business / Connect journeys as products** → the Entrepreneur and Business-Expansion _journeys_ ship (composed from existing resources/communities), but no business product, sponsor matching UI, or introductions (gated, strategy §12).
- **A journey authoring CMS** → explicitly not built; compose dynamically.
- **Multi-language journey UI** → English only in Phase 2 (matches Phase 1); German/Hindi UI is Phase 3.

---

## 5. The Six Launch Journeys

The shipped persona registry ([modules/journeys/personas.ts](../apps/web/src/modules/journeys/personas.ts)) defines **six personas**, each a `JourneyPersona` enum value with a URL slug and a deterministic mapping onto existing `ResourceAudience` values + community `personaSegments[]` — so **no new audience enum was required**.

| Journey (persona)  | Enum / slug                         | Maps to audience(s)       | Core questions it answers                                                                   | Components assembled                                                                                      |
| ------------------ | ----------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Young Family**   | `FAMILY` / `young-family`           | `FAMILY`                  | Cost of living? Kita/Kindergarten? Schools? Family communities? Family events?              | Family communities, family events, `FAMILY_CHILDREN` + `HOUSING` + `HEALTH_DOCTORS` + `CITY_REGISTRATION` |
| **Student**        | `STUDENT` / `student`               | `STUDENT`, `STUDENT_VISA` | Which city? Accommodation? Student communities? Student events? Working-student/visa rules? | University-linked communities, student events, `CITY_REGISTRATION` + `HOUSING` + `JOBS_CAREERS` resources |
| **Professional**   | `PROFESSIONAL` / `professional`     | `EMPLOYEE`                | Salary norms? Housing? Career growth? Networking?                                           | `PROFESSIONAL_NETWORK` communities, networking events, `HOUSING` + `TAX_FINANCE` + `JOBS_CAREERS`         |
| **Skilled Worker** | `SKILLED_WORKER` / `skilled-worker` | `NEWCOMER`, `EMPLOYEE`    | Relocation? Certification/recognition? Community support? First-90-days checklist?          | Stage-ordered settling-in resources, regional communities, consular services                              |
| **Founder**        | `FOUNDER` / `founder`               | `FOUNDER`                 | Startup ecosystem? Co-founders/partners? Networking? Business setup?                        | `BUSINESS_SETUP` + `TAX_FINANCE`, founder/professional communities, ecosystem orgs (when Phase 4 lands)   |
| **Business**       | `BUSINESS` / `business`             | `FOUNDER` (org-level)     | Market entry? Local representation? Business communities? Partners?                         | Institutional orgs, chambers, `BUSINESS_SETUP`, relationship graph, Connect (Phase 6)                     |

**As built — launch gating.** All six personas are implemented and selectable in code, but **which** city×persona journeys are _live_ is controlled by the `JOURNEY_CITY_PERSONA_ALLOWLIST` env (comma-separated `city:persona` pairs, default `stuttgart:young-family`, `*` = all), checked by `isJourneyAllowed()`. Promoting a journey to a new city/persona is a content-density + allowlist decision, not a code change. The original "start with Young Family, Student, Professional" priority holds: **Stuttgart × Young Family is the default-live flagship**, with the rest enabled per-pair as tag coverage clears the density gate (§13).

---

## 6. The Journey Composition Model

### 6.1 The function

The shipped `modules/journeys` module ([compose.ts](../apps/web/src/modules/journeys/compose.ts)) composes a journey deterministically for a given `(persona, citySlug, cityName, stage?, language?)`:

```
composeJourney({ persona, citySlug, cityName, stage?, language? }) → Promise<JourneyView>
```

It reuses existing query layers rather than introducing parallel data access:

- **Resources** → the resolver (`getResourcesForCity`) filtered by `audiences` (persona) in addition to scope + `lifecycleStage`; capped at 24.
- **Communities** → `modules/community` filtered by `personaSegments`; capped at 8. Only communities with ≥1 verified join channel survive (action-or-drop, §6.3.5).
- **Events** → `modules/event`, `PUBLISHED` only (moderation gate inherited); capped at 6.
- **Ecosystem orgs** → reserved in the type contract (`JourneyEntityKind = 'ecosystem'`) but **not composed yet** — the block stays empty until Phase 4 populates partner orgs / relationship edges.

### 6.2 The output shape (as built)

The shared contract ([packages/shared/src/contracts/journeys.ts](../packages/shared/src/contracts/journeys.ts)) defines `JourneyView`:

```
JourneyView {
  persona, personaSlug, citySlug, cityName, language
  promoted: boolean        // cleared the density gate?
  blockCount: number
  stages: [
    { stage, stageIndex, blocks: [ JourneyBlock, ... ] },  // canonical order; empty stages collapsed
    ...
  ]
}

JourneyBlock {
  entityKind: 'resource' | 'community' | 'event'   // 'checklist' | 'ecosystem' reserved, not yet composed
  entityId, title, summary, badge, resolvedScope
  action: { kind, label, href, external }          // ALWAYS present (action-or-drop invariant)
}
```

### 6.3 Composition rules

1. **Stage ordering is canonical** — `PRE_ARRIVAL → FIRST_30_DAYS → FIRST_90_DAYS → SETTLED → ANYTIME` (`STAGE_ORDER` in [stages.ts](../apps/web/src/modules/journeys/stages.ts)).
2. **Scope stacking is inherited** — city → metro → state → country → global, most-specific first (resolver behavior, unchanged).
3. **Trust gating is inherited** — only `PUBLISHED` events, non-hidden valid resources, and (for prominence) verified/claimed communities. Journeys never expose un-moderated content.
4. **Essentials lead** — `isEssential` + `priority` order within a stage.
5. **Every block ends in an action** — `actions.ts` resolves an action (join channel / open link / save / calendar) or the block is **dropped**. Communities with no verified join channel are dropped; resources and events are always actionable. No inert blocks.
6. **Deterministic, explainable** — composition is rule-based and reproducible. No ML ranking yet (that's Phase 3). This keeps journeys debuggable and trustworthy.
7. **Density-gated promotion** — `meetsDensityGate()` ([density.ts](../apps/web/src/modules/journeys/density.ts)) sets `promoted`: a journey is advertised only when every non-empty stage has ≥2 blocks, the journey has ≥6 total blocks, and both `PRE_ARRIVAL` and `FIRST_30_DAYS` are present (§13). Sparse journeys still render if reached directly, but are never promoted as entry points.

---

## 7. User Experience & Surfaces

### 7.1 Entry points (as built)

- **National journeys hub** — [`/journeys`](../apps/web/src/app/journeys/page.tsx) lists every live city×persona journey via `JourneyEntryCard`s.
- **City journeys hub** — [`/[city]/journeys`](../apps/web/src/app/[city]/journeys/page.tsx) shows the personas allowlisted for that city.
- **City feed strip** — `JourneyFeedStrip` on `/[city]/` renders the allowlisted persona entry cards + a `ContinueJourneyChip` ("continue where you left off"). It is inert (renders null) when the flag is off or no personas are live for the city.
- **Resources** — `/[city]/resources/` remains the "browse all" fallback; the journey is the hero path.
- **Mobile** — _Not yet on the Phase-2 layer._ The mobile app still ships the Phase-1 essentials-only "Newcomer Journey" ([apps/mobile/app/resources/journey.tsx](../apps/mobile/app/resources/journey.tsx)) backed by the older `resources/journey` API; porting the persona journey layer to mobile is deferred (§15).

### 7.2 The journey page (as built)

The city × persona page [`/[city]/journeys/[persona]`](../apps/web/src/app/[city]/journeys/[persona]/page.tsx) renders the composed `JourneyView` as stage-ordered sections of action-ending blocks. Each block's CTA is a `JourneyBlockLink` (internal route or external new-tab) that fires `journey_block_action` before navigating. The page also carries a `PersonaSwitcher` pill row, a `JourneySaveButton`, per-block `JourneyBlockDone` checkboxes, and a `JourneyViewTracker`. It links into canonical community/event/resource detail pages for depth.

### 7.3 Member integration (as built)

- **Save a journey** — `JourneySaveButton`, persisted in **localStorage** (`journey:saved:{city}:{persona}`); no account required. Server-side saved-journey storage is deferred (§9).
- **Per-block progress** — `JourneyBlockDone` checkboxes, localStorage (`journey:done:{city}:{persona}`), mirroring the Phase-1 resource-checklist pattern.
- **Resume** — `recordLastJourney()` writes `journey:last`; `ContinueJourneyChip` surfaces it on the feed.
- **Persona prefill / digest targeting** — _designed, not yet wired._ Signed-in persona prefill and digest/reminder targeting by saved journey remain a Phase-3 retention hook (the rails exist; the binding does not).

---

## 8. Information Architecture (Overlay, Not Replacement)

**Hard rule:** Phase 1's city-first, content-type URLs are canonical and SEO-critical. Journeys **overlay and link into** them. Nothing in Phase 1's IA changes.

```
Existing (unchanged, canonical)
  /[city]/                          City feed
  /[city]/communities/[slug]/       Community detail
  /[city]/events/[slug]/            Event detail
  /[city]/resources/                Resources directory ("browse all" fallback)

New (overlay, composition layer — as built, flag + allowlist gated)
  /journeys/                        National journeys hub
  /[city]/journeys/                 City journeys hub (allowlisted personas)
  /[city]/journeys/[persona]/       Composed journey for a city × persona
     e.g. /stuttgart/journeys/young-family/
  /api/v1/cities/[slug]/journey     Journey composition API (?persona=&stage=&lang=)
  /admin/data/journeys              Coverage-audit dashboard (ops, §10)
```

All journey routes 404 when `JOURNEY_LAYER_ENABLED` is off, and a city×persona pair renders only if `isJourneyAllowed()` passes — so the overlay is provably inert until switched on. The legacy `resources/journey` API still exists and is unchanged; the new `journey` API is the persona-aware, multi-entity generalization of that seam.

---

## 9. Data & Schema Plan

**Guiding constraint:** prefer composition over new storage. **As built, Phase 2 added _no_ new content or journey tables** — it composes entirely over existing models.

### 9.1 What needs no schema change

Personas, lifecycle stages, languages, organization types, scope resolution, relationship edges, and member prefs all exist. Journeys compose over `Resource` (`audiences[]`, `lifecycleStage[]`, `priority`, `isEssential`), `Community` (`personaSegments[]`, `AccessChannel[]`), and `Event` — no additions.

### 9.2 Additive changes (status)

| Candidate                                                           | Status (as built)                                                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Persona filter on the resources resolver/API                        | **Shipped** — a query-layer filter (`audiences`) alongside existing scope/stage logic; no schema change      |
| `Checklist` / `JourneyStep` light model                             | **Not built** — progress + saves persist client-side in `localStorage` (`journey:saved/done/last:*` keys)    |
| Thin materialized `Journey` record (pinned order + editorial intro) | **Not built** — journeys are 100% dynamic/cached today (§11); materialization remains an optional future opt |

**Anti-goal (held):** no heavyweight journey/playbook CMS, no parallel content store, no new ingestion path. Save/progress/resume state is deliberately client-side for now; server-side journey persistence is a Phase-3 personalization candidate, not a Phase-2 requirement.

---

## 10. Content & Tagging Operations

Journeys are only as good as the tag coverage underneath them, so coverage tooling shipped alongside the engine (PRD/TDD-0053).

1. **Coverage audit (shipped).** `computeCityCoverage()` ([coverage.ts](../apps/web/src/modules/journeys/coverage.ts)) runs the _same composition path_ as the engine — so "READY" means "promotable". Surfaced two ways: the **admin dashboard** at [`/admin/data/journeys`](<../apps/web/src/app/admin/(dashboard)/data/journeys/page.tsx>) (per-city persona×stage counts, READY/THIN verdict, gap detail, quick-links to tag resources/communities) and a **CLI** (`pnpm --filter web journey:coverage --city=<slug> [--persona=<PERSONA>] [--json]`, [scripts/journey-coverage.ts](../apps/web/scripts/journey-coverage.ts)).
2. **Backfill (ops, ongoing).** Backfill tags on existing rows — admin-assisted for high-value entries; humans approve, per the L0 trust gate.
3. **AI tag suggestions (flagged, not yet wired).** `JOURNEY_TAG_SUGGESTIONS_ENABLED` exists as a flag; the intent is to have the AI pipeline suggest audience/stage tags into the review queue, but the pipeline binding is **not built yet**. Today coverage is grown by admin tagging.
4. **Journey-aware supply prioritization (ongoing).** Use the coverage gaps + zero-result analytics to direct supply work at the blocks that break the most-trafficked journeys (not raw listing count — strategy §11/§17).

---

## 11. Dynamic vs Materialized Journeys

**As built: 100% dynamic.** Journeys are composed live from tags on every request (cached). This keeps them fresh automatically — a journey can't rot, because its components are the live, moderated, freshness-scored entities. No journey is materialized today.

**Materialize later, selectively.** Once a city's dynamic journeys are demonstrably good (measured by progression + qualitative review), optionally pin a curated order and add an editorial intro for the flagship journeys (e.g. "Moving to Stuttgart as a Young Family"). Materialization is a **quality optimization for dense cities**, never a prerequisite, and never a CMS — it remains deferred (§9.2). Sparse cities always stay dynamic.

This mirrors the Phase-1 discipline: ship the honest dynamic version first; invest in curation only where density justifies it.

---

## 12. SEO Strategy

Journeys are an SEO upgrade, not a thin-content risk:

- **Richer, more linkable pages.** A city × persona journey ("Moving to Stuttgart as a Young Family") is substantively richer than a flat resource list and links into many real, structured detail pages — the opposite of a doorway page.
- **Harder to commoditize.** It connects official information to _verified local communities and dated events_ — something an AI answer or a scraped directory cannot reproduce (strategy §11/§18).
- **Respect the existing SEO note.** Avoid spawning thin keyword doorway pages; journey pages must be genuinely rich and link-dense, and we strengthen authority pages rather than sprawl. Add `JSON-LD`/`HowTo`-style structured data where honestly applicable.
- **Canonical discipline.** Journey pages canonicalize cleanly and never compete with or cannibalize the canonical community/event/resource pages they link into.

---

## 13. Sparsity & Quality Guardrails

A journey must never feel broken. Inherited and extended from Phase 1's sparse-content discipline:

1. **Graceful degradation** — in a thin city, a journey shows the strongest available components plus national/state-scope resources (scope stacking already does this). It shows "what we have, honestly," never an empty stage.
2. **Minimum-density gate (as built)** — `meetsDensityGate()` sets `promoted`: a journey is advertised as an entry point only when **every non-empty stage has ≥2 blocks, the journey has ≥6 total blocks, and both `PRE_ARRIVAL` and `FIRST_30_DAYS` are present**. Below the bar it still renders if reached directly, but is never promoted.
3. **Stage skipping** — empty stages collapse rather than render blank.
4. **Action-or-drop** — a block with no resolvable action is dropped (§6.3 rule 5); communities without a verified join channel never appear.
5. **Trust-first** — verified/claimed communities and essential resources lead; un-moderated content never appears.

---

## 14. Success Metrics

**North Star for Phase 2:** **Journey Progressions** — sessions that advance through ≥2 stages of a journey or save a journey. This proves users are _navigating transitions_, not just browsing content.

| Metric                                                 | What it proves                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| Journey progression rate (≥2 stages advanced)          | Journeys work as navigation, not lists                                   |
| Journey save rate                                      | Journeys are worth returning to                                          |
| **Journey → access-channel conversion**                | Journeys end in action (not blog) — ties to the Phase-1 conversion event |
| Journey-asset organic traffic vs flat resource pages   | Journeys are an SEO upgrade                                              |
| Tag coverage % per launch city (resources/communities) | The supply substrate is healthy                                          |
| Journey entry-point CTR (persona selector)             | The reframed entry resonates                                             |
| Per-journey completion funnel (per persona)            | Which journeys are strong/weak; where to invest supply                   |

These compose with the Phase-1 funnel — a journey progression is a richer form of a discovery session, and a journey access-channel click is the same conversion event Phase 1 optimizes.

**Instrumentation (as built).** Six PostHog events are wired ([lib/analytics/events.ts](../apps/web/src/lib/analytics/events.ts), fired via `/api/v1/track`): `journey_entry_click`, `journey_view`, `journey_stage_view` (IntersectionObserver, the progression signal), `journey_block_action` (the access-channel conversion), `journey_save`, and `journey_persona_switch`. Save/progress state is client-side (localStorage), so save-rate is measured from the `journey_save` event rather than a server record.

---

## 15. Sequenced Build Plan

| Step                                    | Work                                                                                                                                                                                                                                                       | Status                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **0. Tag-coverage audit**               | Coverage tooling: `computeCityCoverage()` + admin dashboard + CLI (§10)                                                                                                                                                                                    | **Done**                                                       |
| **1. ADR + PRD/TDD**                    | [ADR-0011](specs/ADR/0011-journey-composition-model.md); [PRD/TDD-0052](specs/PRD/0052-journey-layer-composition-and-first-journey.md) (engine + first journey); [PRD/TDD-0053](specs/PRD/0053-journey-tag-coverage-and-tagging-ops.md) (tag coverage ops) | **Done**                                                       |
| **2. Composition engine**               | `modules/journeys.composeJourney()` over resources + communities + events; action-or-drop; density gate; journey API                                                                                                                                       | **Done** (unit + integration tests)                            |
| **3. First journey surface**            | `/[city]/journeys/[persona]` + hubs + city-feed strip; dynamic, action-ending; Stuttgart × Young Family live                                                                                                                                               | **Done**                                                       |
| **4. Backfill + tagging-at-ingestion**  | Admin-assisted tag backfill (ongoing); AI-pipeline tag suggestion behind `JOURNEY_TAG_SUGGESTIONS_ENABLED`                                                                                                                                                 | **Partial** — flag exists; pipeline binding not yet wired      |
| **5. Roll out remaining journeys**      | Student, Professional, then Skilled Worker/Founder/Business as data clears the density gate                                                                                                                                                                | **Gated by allowlist** — flip `JOURNEY_CITY_PERSONA_ALLOWLIST` |
| **6. Mobile + member integration**      | Persona journey entry on mobile; server-side save-a-journey; signed-in persona prefill                                                                                                                                                                     | **Deferred** — web-only; client-side save today                |
| **7. (Optional) Materialize flagships** | Pin order + editorial intro for proven-dense cities                                                                                                                                                                                                        | **Deferred** — not built; optional future opt                  |

---

## 16. Risks & Mitigations

| Risk                                               | Likelihood | Impact | Mitigation                                                                                                                                                                  |
| -------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Thin tag coverage → weak journeys**              | High       | High   | Coverage tooling shipped (dashboard + CLI, §10); density gate keeps thin journeys un-promoted (§13); admin-assisted backfill ongoing (AI suggestion flagged, not yet wired) |
| **Journeys become a blog (inform without action)** | Medium     | High   | Hard "action-or-drop" rule (§6.3); journey→access-channel conversion is a North-Star metric                                                                                 |
| **Disrupting Phase-1 SEO/IA**                      | Low        | High   | Overlay-only IA (§8); canonical discipline (§12); zero changes to canonical content-type URLs                                                                               |
| **Over-engineering (building a CMS)**              | Medium     | Medium | Composition-first, no new content tables in v1 (§9); materialization is optional and gated (§11)                                                                            |
| **Persona mismatch (user picks wrong journey)**    | Medium     | Low    | Selection (not inference) in Phase 2; easy switching; cross-links between journeys; inference deferred to Phase 3                                                           |
| **Sparse-city emptiness**                          | Medium     | Medium | Graceful degradation + minimum-density gate (§13); scope stacking fills with national/state resources                                                                       |

---

## 17. Explicitly Out of Scope (Deferred to Phase 3+)

- **Personalized recommendations & ranking** (Phase 3) — Phase 2 is persona-_selected_, not persona-_predicted_.
- **Journey Concierge** (Phase 3) — the constrained, retrieval-grounded assistant comes after journeys + corpus density exist.
- **Ecosystem-org journey blocks as a product** (Phase 4) — the block exists but is empty until partner orgs/relationship edges are populated.
- **Business / Connect products** (Phase 5/6) — the Entrepreneur/Business journeys ship as composed guides; no business product, sponsor matching, or introductions (gated, strategy §12).
- **Multi-language journey UI** (Phase 3) — English only in Phase 2.
- **IndLokal Plus monetization** — journeys are free in Phase 2; premium journey features (materialized playbooks, concierge, smart reminders) are a Phase 3 candidate (strategy §13).

---

## 18. Exit Criteria → Phase 3

The Journey Layer is **built**; the remaining gate to fully unlocking Phase 3 (Personalization) is _density + evidence_, not engineering:

1. **≥1 launch city has ≥3 healthy journeys** clearing the density gate (promoted), each with measurable progression and journey→access-channel conversion above an agreed floor. _As of now, Stuttgart × Young Family is the default-live flagship; remaining personas are allowlist-gated pending coverage._
2. **Tag coverage** on resources/communities in that city is high enough that dynamic composition is consistently good (no manual rescue needed) — tracked via the coverage dashboard/CLI (§10).
3. **Behavioral + journey data density** is sufficient to justify ranking and a retrieval-grounded concierge — i.e., enough signal (the six journey events, §14) about _what users in each persona × stage actually do_.
4. **No Phase-1 regression** — discovery North Star and SEO health are stable or improved; the flag/allowlist keep the overlay provably inert where not enabled.

Meeting these means we have the journey spine _and_ the data density that Phase 3 personalization and the constrained concierge require — see [Phase 3 — Personalization Layer](PHASE_3_PERSONALIZATION_LAYER.md) (designed, not yet built).

---

_This document records the Phase 2 Journey Layer as built. For the company-level thesis, the moat hierarchy, the AI line, the Business/Connect decision gates, and the full 7-phase roadmap, see the [IndLokal Product Strategy & Product Document](PRODUCT_DOCUMENT.md). For the shipped foundation Phase 2 builds on, see [Phase 1 — Discovery Foundation](PHASE_1_DISCOVERY_FOUNDATION.md); for what comes next, see [Phase 3 — Personalization Layer](PHASE_3_PERSONALIZATION_LAYER.md)._
