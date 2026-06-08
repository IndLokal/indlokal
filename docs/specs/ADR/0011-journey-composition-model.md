# ADR-0011: Journeys are a composition layer over existing data, not a new content type

- **Status:** Accepted
- **Date:** 2026-06-05
- **Linked:** PRD/TDD-0052 (journey engine + first journey), PRD/TDD-0053 (journey tagging ops),
  ADR-0007 (resource scope & resolution), ADR-0010 (discovery as a unified graph),
  [`docs/PHASE_2_JOURNEY_LAYER.md`](../../PHASE_2_JOURNEY_LAYER.md),
  [`docs/PRODUCT_DOCUMENT.md`](../../PRODUCT_DOCUMENT.md) §6, §8, §14 (Phase 2)
- **Builds on:** PRD/TDD-0030 (`resources/journey` stage-grouping seam)

## Context

Phase 1 organizes the product around **what we store** — Communities, Events, Resources — each its own
vertical with its own canonical, SEO-critical URL space (`/[city]/communities/…`, `/[city]/events/…`,
`/[city]/resources/`). But users do not arrive with a "community problem"; they arrive mid-**transition**:
"I'm moving to Stuttgart as a young family — what do I do, and in what order?" Phase 1 has the answers,
but scattered across three content types, leaving the user to translate their life question into our
storage taxonomy and stitch the pieces together themselves (full rationale:
[`docs/PHASE_2_JOURNEY_LAYER.md`](../../PHASE_2_JOURNEY_LAYER.md) §1–§2).

Three facts in the codebase shape this decision:

1. **The journey primitives already exist as tags.** `Resource.audiences[]` (`ResourceAudience`),
   `Resource.lifecycleStage[]` (`ResourceStage`), `Community.personaSegments[]`, `Community.languages[]`,
   `Community.organizationType`, and `User.personaSegments[]` are all shipped (ADR-0007, ADR-0010,
   PRD/TDD-0051). The scope resolver, metro rollup, and trust/moderation gates are live.
2. **A partial journey seam already ships.** `GET /api/v1/cities/:slug/resources/journey`
   ([route](../../../apps/web/src/app/api/v1/cities/[slug]/resources/journey/route.ts), PRD/TDD-0030)
   groups **essentials-only resources by lifecycle stage** in canonical order. It is resources-only,
   not persona-aware, not action-ending, and has no surface.
3. **The resolver already accepts a persona filter.** `ResolverOptions` in
   [`modules/resources/resolver.ts`](../../../apps/web/src/modules/resources/resolver.ts) already
   supports `{ audience, stage, essentialsOnly }`; the journey route simply does not pass them. The
   delta to make resources persona-aware is a query-layer change, not a schema change.

The risk we are guarding against: letting a "journeys" feature metastasize into a parallel content
store / playbook CMS / authoring workflow — duplicating the ingestion, trust, and freshness machinery
Phase 1 already owns, and rotting the moment its hand-authored copy goes stale.

## Decision

1. **A Journey is a composition rule over existing tagged data, not a stored content type.** A journey is
   `f(persona, lifecycle stage, city, language) → ordered bundle of { resources, communities, events,
ecosystem orgs, actions }`, assembled live from the entities Phase 1 already stores and moderates.
   We **compose, we do not author**.

2. **A new `modules/journeys` module owns composition; it reuses existing query layers.** Its entry point
   is `composeJourney({ persona, citySlug, stage?, language? }) → JourneyView`. It calls the existing
   resource resolver (`getResourcesForCity` with `audience`/`stage`), `modules/community`
   (filtered by `personaSegments`/`languages`), and `modules/event` — it does **not** introduce a
   parallel data-access path or its own tables.

3. **Composition is deterministic and rule-based in Phase 2. No ML ranking.** The rules are fixed and
   explainable: canonical stage ordering (`PRE_ARRIVAL → FIRST_30_DAYS → FIRST_90_DAYS → SETTLED →
ANYTIME`), inherited scope stacking, inherited trust gating (only `PUBLISHED`/non-hidden/verified
   content), essentials-lead ordering, and **action-or-drop** (a block with no resolvable action is
   dropped). Personalized ranking and inference are explicitly Phase 3.

4. **Journeys are persona-_selected_, not persona-_inferred_, in Phase 2.** The user picks a persona;
   the system does not predict it. (A signed-in member's `personaSegments` may pre-select the choice, but
   it remains user-overridable.) Inference/recommendation is Phase 3.

5. **Journeys are an IA overlay; Phase 1 URLs are canonical and unchanged.** Journeys live at new routes
   (`/journeys/`, `/[city]/journeys/[persona]/`, `/api/v1/cities/[slug]/journey`) that **link into** the
   canonical content-type detail pages. No Phase-1 route, ranking, or SEO surface changes. Journey pages
   canonicalize cleanly and never cannibalize the pages they link into (ADR-0010 discovery graph stays
   the substrate).

6. **No new content tables in v1.** v1 requires no schema migration: it composes over existing tags.
   The only additive change we anticipate is making the journey **API/route** pass the persona filter the
   resolver already supports. A thin, additive, nullable materialized `Journey` record (pinned order +
   editorial intro) is permitted **only later, only for proven-dense cities**, as an optimization — never
   a prerequisite, never a CMS.

7. **Journeys default to dynamic.** Composed live (cached) so a journey cannot rot — its components are
   the live, moderated, freshness-scored entities. Materialization is opt-in per dense city.

## Consequences

- **Positive:** a category shift (content discovery → journey discovery) at a fraction of Phase 1's cost,
  because the tags, resolver, scope stacking, and a stage-grouping seam already exist; journeys can't go
  stale (dynamic over live data); zero Phase-1 regression risk (overlay-only IA); journeys become the
  spine Phase 3 (personalization), Phase 4 (ecosystem), Phase 5/6 (business/connect), and Phase 7
  (intelligence) hang on.
- **Negative / cost:** journeys are only as good as tag coverage, so coverage becomes a first-class,
  blocking operational dependency (PRD/TDD-0053); the `resources/journey` route must be generalized
  (kept back-compatible or superseded cleanly); composition adds a new module + presentation surfaces.
- **Neutral:** ranking stays deterministic (debuggable, but not "smart") until Phase 3; the
  Entrepreneur/Business journeys ship as composed guides only — no business product, sponsor matching, or
  introductions (gated, strategy §12).

## Alternatives considered

- **Author journeys as a new content type in a journey/playbook CMS.** Rejected: duplicates Phase 1's
  ingestion/trust/freshness machinery, rots on stale copy, scales O(cities × personas) in editorial
  labor, and is exactly the "Resources-as-blog" failure mode the strategy calls out (strategy §8). The
  whole point is composition over authoring.
- **Add ML ranking / personalization now.** Rejected: premature. There is not yet enough per-persona
  behavioral signal to justify or train it, and it would make journeys non-deterministic and hard to
  trust on day one. Deterministic rules first; inference is Phase 3 once journey data density exists
  (Phase 2 exit criteria).
- **Replace the content-type IA with a journey-first IA.** Rejected: Phase 1's city-first content-type
  URLs are canonical and SEO-critical; replacing them risks the discovery North Star for an unproven
  surface. Overlay-and-link-into is reversible and additive.
- **Build journeys as a generic recommendation feed.** Rejected: a feed informs without guiding;
  journeys must be stage-ordered and action-ending (action-or-drop), which a ranked feed is not.
