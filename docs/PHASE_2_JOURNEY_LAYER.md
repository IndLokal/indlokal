# IndLokal — Phase 2: Journey Layer (Product Document)

**Status: Designed / Not yet built.** This is the forward-looking product document for Phase 2 of the [IndLokal product strategy](PRODUCT_DOCUMENT.md). Where the [Phase 1 document](PHASE_1_DISCOVERY_FOUNDATION.md) describes what was _built_, this describes what we _intend to build_ and — critically — _why it is cheap and non-disruptive given what already exists_.

> **The one-sentence thesis:** Phase 2 turns IndLokal from **content discovery** ("here are the communities/events/resources in your city") into **journey discovery** ("here's how to navigate _your_ transition — student, family, professional, founder — in this city"), by **composing data the platform already collects**, without re-architecting Phase 1 and without disrupting the live product.

> **This is a strategy/PRD-precursor document, not an implementation spec.** Concrete capabilities are specified as PRD/TDD pairs (and an ADR for the journey-composition model) under [docs/specs/](specs/README.md): [ADR-0011](specs/ADR/0011-journey-composition-model.md) (composition model), [PRD-0052](specs/PRD/0052-journey-layer-composition-and-first-journey.md)/[TDD-0052](specs/TDD/0052-journey-layer-composition-and-first-journey.md) (engine + first journey), and [PRD-0053](specs/PRD/0053-journey-tag-coverage-and-tagging-ops.md)/[TDD-0053](specs/TDD/0053-journey-tag-coverage-and-tagging-ops.md) (tag coverage & tagging ops, the P0 blocking dependency). This document defines the product intent, scope, gates, and sequencing those specs honor.

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

1. **Journey entry points** — a persona/stage selector ("I'm a student / family / professional / founder / skilled worker / business") on the landing and city surfaces.
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

Each maps directly onto existing `ResourceAudience` values, so **no new audience enum is required for v1**.

| Journey                               | Maps to audience(s)       | Core questions it answers                                                                   | Components assembled                                                                                      |
| ------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Student**                           | `STUDENT`, `STUDENT_VISA` | Which city? Accommodation? Student communities? Student events? Working-student/visa rules? | University-linked communities, student events, `CITY_REGISTRATION` + `HOUSING` + `JOBS_CAREERS` resources |
| **Early-Career Professional**         | `EMPLOYEE`                | Salary norms? Housing? Career growth? Networking?                                           | `PROFESSIONAL_NETWORK` communities, networking events, `HOUSING` + `TAX_FINANCE` + `JOBS_CAREERS`         |
| **Young Family**                      | `FAMILY`                  | Cost of living? Kita/Kindergarten? Schools? Family communities? Family events?              | Family communities, family events, `FAMILY_CHILDREN` + `HOUSING` + `HEALTH_DOCTORS` + `CITY_REGISTRATION` |
| **Skilled Worker**                    | `NEWCOMER`, `EMPLOYEE`    | Relocation? Certification/recognition? Community support? First-90-days checklist?          | Stage-ordered settling-in resources, regional communities, consular services                              |
| **Entrepreneur / Founder**            | `FOUNDER`                 | Startup ecosystem? Co-founders/partners? Networking? Business setup?                        | `BUSINESS_SETUP` + `TAX_FINANCE`, founder/professional communities, ecosystem orgs (when Phase 4 lands)   |
| **Business Expansion (India→Europe)** | `FOUNDER` (org-level)     | Market entry? Local representation? Business communities? Partners?                         | Institutional orgs, chambers, `BUSINESS_SETUP`, relationship graph, Connect (Phase 6)                     |

**Launch priority:** start with **Young Family**, **Student**, and **Early-Career Professional** — the densest data and the clearest Stuttgart demand. Skilled Worker, Entrepreneur, and Business Expansion follow as tag coverage and ecosystem data fill in.

---

## 6. The Journey Composition Model

### 6.1 The function

A new `modules/journeys` module composes a journey for a given `(persona, stage?, citySlug, language?)`:

```
composeJourney({ persona, citySlug, stage?, language? }) → JourneyView
```

It reuses existing query layers rather than introducing parallel data access:

- **Resources** → extend the resolver (`getResourcesForCity`) to filter by `audiences` (persona) in addition to scope + `lifecycleStage`. The `resources/journey` route is the seam to generalize.
- **Communities** → `modules/community` filtered by `personaSegments` (+ optional `languages`, `organizationType`).
- **Events** → `modules/event` filtered by persona-relevant categories, `PUBLISHED` only (moderation gate inherited).
- **Ecosystem orgs** → optional block, empty until Phase 4 populates partner orgs / relationship edges.

### 6.2 The output shape (conceptual)

```
JourneyView {
  persona, city, language?
  stages: [
    { stage: PRE_ARRIVAL,   blocks: [ ResourceBlock, ChecklistBlock, ... ] },
    { stage: FIRST_30_DAYS, blocks: [ ResourceBlock, CommunityBlock, EventBlock, ... ] },
    { stage: FIRST_90_DAYS, blocks: [ ... ] },
    { stage: SETTLED,       blocks: [ ... ] },
  ]
  // every block resolves to an ACTION: join channel / save / open official link / checklist step
}
```

### 6.3 Composition rules

1. **Stage ordering is canonical** — `PRE_ARRIVAL → FIRST_30_DAYS → FIRST_90_DAYS → SETTLED → ANYTIME` (already the convention in the existing route).
2. **Scope stacking is inherited** — city → metro → state → country → global, most-specific first (resolver behavior, unchanged).
3. **Trust gating is inherited** — only `PUBLISHED` events, non-hidden valid resources, and (for prominence) verified/claimed communities. Journeys never expose un-moderated content.
4. **Essentials lead** — `isEssential` + `priority` order within a stage (matches the existing journey route).
5. **Every block ends in an action** — composition attaches the action (access channel / save / link / checklist) or the block is dropped. No inert blocks.
6. **Deterministic, explainable** — Phase-2 composition is rule-based and reproducible. No ML ranking yet (that's Phase 3). This keeps journeys debuggable and trustworthy.

---

## 7. User Experience & Surfaces

### 7.1 Entry points

- **Landing (`/`)** — alongside the city picker, a "What brings you here?" persona selector (Student / Family / Professional / Skilled Worker / Founder / Business). Choosing one + a city routes into a journey.
- **City surfaces** — a journey strip on `/[city]/` ("Navigate your move: Family · Student · Professional…").
- **Resources** — the current `/[city]/resources/` becomes the "browse all" fallback; the journey is the hero path.
- **Mobile** — a journey entry on Discover; the existing `resources/journey` API generalizes to back it.

### 7.2 The journey page

A city × persona page that presents the composed `JourneyView`: a stage-ordered, scannable guide where each stage shows a few high-value, action-ending blocks (a resource that opens an official page, a verified community with a Join CTA, the next family-friendly event with a Save CTA, a checklist item to tick). It links into canonical community/event/resource detail pages for depth.

### 7.3 Member integration (reuses Phase 1)

- **Save a journey** — reuse the saved-items rails; a saved journey is a member's "home base" for their transition.
- **Persona prefilled** — if a signed-in member has `personaSegments`/`preferredLanguages`, the journey selector is pre-selected (still user-overridable — selection, not inference).
- **Retention hook** — the existing weekly-digest/reminder producers can later target a member's saved journey city/persona (mechanics exist; INBOX channel).

---

## 8. Information Architecture (Overlay, Not Replacement)

**Hard rule:** Phase 1's city-first, content-type URLs are canonical and SEO-critical. Journeys **overlay and link into** them. Nothing in Phase 1's IA changes.

```
Existing (unchanged, canonical)
  /[city]/                          City feed
  /[city]/communities/[slug]/       Community detail
  /[city]/events/[slug]/            Event detail
  /[city]/resources/                Resources directory (becomes "browse all" fallback)

New (overlay, composition layer)
  /journeys/                        Journey hub (persona/stage selector)
  /[city]/journeys/[persona]/       Composed journey for a city × persona
     e.g. /stuttgart/journeys/young-family/
  /api/v1/cities/[slug]/journey     Generalized journey API (extends the existing
                                    resources/journey seam to multi-entity + persona)
```

(Exact route names are fixed in the Phase-2 PRD; the principle — overlay, link-into, no Phase-1 disruption — is fixed here.)

---

## 9. Data & Schema Plan

**Guiding constraint:** prefer composition over new storage. v1 should require **no new content tables**.

### 9.1 What needs no schema change

Personas, lifecycle stages, languages, organization types, scope resolution, relationship edges, and member prefs all exist. v1 journeys compose over them.

### 9.2 Possible additive changes (only if measured need)

| Candidate                                                           | When                                                            | Notes                                                                                             |
| ------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Persona filter on the resources resolver/API                        | Phase 2 P0                                                      | Likely a query-layer change, not schema — filter `audiences` alongside existing scope/stage logic |
| `Checklist` / `JourneyStep` light model                             | Phase 2 P1, only if action-checklists need persistence per user | Keep minimal; reuse saved-items patterns first                                                    |
| Thin materialized `Journey` record (pinned order + editorial intro) | Phase 2 P2, only for proven-dense cities (§11)                  | Additive, nullable, optional — an optimization, not a prerequisite                                |

**Anti-goal:** do not introduce a heavyweight journey/playbook CMS, a parallel content store, or a new ingestion path. If a change isn't additive and composition-first, it belongs in a later phase or not at all.

---

## 10. Content & Tagging Operations

Journeys are only as good as the tag coverage underneath them. **The first Phase-2 task is a coverage audit**, not feature code.

1. **Coverage audit (P0, blocking).** Measure `audiences[]`, `lifecycleStage[]` coverage on resources and `personaSegments[]` on communities, per launch city. Identify the journeys that are too thin to ship.
2. **Backfill (P0).** Backfill tags on existing rows — admin-assisted for high-value entries, pipeline-assisted (the AI extraction can suggest audience/stage tags into the review queue) for scale. Humans approve, per the L0 trust gate.
3. **Tagging at ingestion (P1).** Extend organizer edit forms and the AI pipeline so new communities/resources are tagged with audience/persona/stage at creation, keeping coverage from decaying.
4. **Journey-aware supply prioritization (P1).** Use zero-result + journey-gap analytics to direct supply work at the blocks that break the most-trafficked journeys (not just raw listing count — strategy §11/§17).

---

## 11. Dynamic vs Materialized Journeys

**Default: dynamic.** v1 journeys are composed live from tags on every request (cached). This keeps them fresh automatically — a journey can't rot, because its components are the live, moderated, freshness-scored entities.

**Materialize later, selectively.** Once a city's dynamic journeys are demonstrably good (measured by progression + qualitative review), optionally pin a curated order and add an editorial intro for the flagship journeys (e.g. "Moving to Stuttgart as a Young Family"). Materialization is a **quality optimization for dense cities**, never a prerequisite, and never a CMS. Sparse cities always stay dynamic.

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
2. **Minimum-density gate** — a journey only appears as a promoted entry point for a city once it clears a minimum component count per stage; below that it stays discoverable but unadvertised.
3. **Stage skipping** — empty stages collapse rather than render blank.
4. **Action-or-drop** — a block with no resolvable action is dropped (§6.3 rule 5).
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

---

## 15. Sequenced Build Plan

| Step                                     | Work                                                                                                                                                                                                                                                                           | Gate to next                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| **0. Tag-coverage audit** (P0, blocking) | Measure audience/stage/persona coverage per launch city; pick the 1–2 journeys with sufficient density                                                                                                                                                                         | A journey is only built where data can make it good            |
| **1. ADR + PRD/TDD**                     | [ADR-0011](specs/ADR/0011-journey-composition-model.md) (composition model); [PRD/TDD-0052](specs/PRD/0052-journey-layer-composition-and-first-journey.md) (engine + first journey); [PRD/TDD-0053](specs/PRD/0053-journey-tag-coverage-and-tagging-ops.md) (tag coverage ops) | Spec-first discipline (repo convention)                        |
| **2. Composition engine**                | `modules/journeys.composeJourney()`; generalize the `resources/journey` seam to persona-aware + multi-entity                                                                                                                                                                   | Engine returns a good `JourneyView` for Stuttgart × Family     |
| **3. First journey surface**             | `/[city]/journeys/young-family/` + entry point; dynamic, action-ending                                                                                                                                                                                                         | Internal quality review passes (every block has an action)     |
| **4. Backfill + tagging-at-ingestion**   | Admin/pipeline-assisted tag backfill; organizer-form + pipeline tagging                                                                                                                                                                                                        | Coverage clears the minimum-density gate for the next journeys |
| **5. Roll out remaining journeys**       | Student, Professional, then Skilled Worker/Founder/Business as data allows                                                                                                                                                                                                     | Per-journey density gate                                       |
| **6. Mobile + member integration**       | Journey entry on mobile; save-a-journey; persona prefill                                                                                                                                                                                                                       | Parity with web journey UX                                     |
| **7. (Optional) Materialize flagships**  | Pin order + editorial intro for proven-dense cities                                                                                                                                                                                                                            | Only if dynamic quality + progression justify it               |

---

## 16. Risks & Mitigations

| Risk                                               | Likelihood | Impact | Mitigation                                                                                                                      |
| -------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Thin tag coverage → weak journeys**              | High       | High   | Coverage audit is the _first, blocking_ task (§10); build journeys only where density supports them; pipeline-assisted backfill |
| **Journeys become a blog (inform without action)** | Medium     | High   | Hard "action-or-drop" rule (§6.3); journey→access-channel conversion is a North-Star metric                                     |
| **Disrupting Phase-1 SEO/IA**                      | Low        | High   | Overlay-only IA (§8); canonical discipline (§12); zero changes to canonical content-type URLs                                   |
| **Over-engineering (building a CMS)**              | Medium     | Medium | Composition-first, no new content tables in v1 (§9); materialization is optional and gated (§11)                                |
| **Persona mismatch (user picks wrong journey)**    | Medium     | Low    | Selection (not inference) in Phase 2; easy switching; cross-links between journeys; inference deferred to Phase 3               |
| **Sparse-city emptiness**                          | Medium     | Medium | Graceful degradation + minimum-density gate (§13); scope stacking fills with national/state resources                           |

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

Phase 2 is "done enough" to unlock Phase 3 (Personalization) when:

1. **≥1 launch city has ≥3 healthy journeys** clearing the minimum-density gate, each with measurable progression and journey→access-channel conversion above an agreed floor.
2. **Tag coverage** on resources/communities in that city is high enough that dynamic composition is consistently good (no manual rescue needed).
3. **Behavioral + journey data density** is sufficient to train/justify ranking and a retrieval-grounded concierge — i.e., we have enough signal about _what users in each persona × stage actually do_.
4. **No Phase-1 regression** — discovery North Star and SEO health are stable or improved.

Meeting these means we have the journey spine and the data density that Phase 3 personalization and the constrained concierge require.

---

_This document defines Phase 2 intent. For the company-level thesis, the moat hierarchy, the AI line, the Business/Connect decision gates, and the full 7-phase roadmap, see the [IndLokal Product Strategy & Product Document](PRODUCT_DOCUMENT.md). For the shipped foundation Phase 2 builds on, see [Phase 1 — Discovery Foundation](PHASE_1_DISCOVERY_FOUNDATION.md)._
