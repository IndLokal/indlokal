# ADR-0010: Discovery as a unified, need-first search graph

- **Status:** Accepted
- **Date:** 2026-06-03
- **Linked:** PRD/TDD-0048 (unified search + telemetry), PRD/TDD-0051 (unified taxonomy + organizationType),
  `docs/DISCOVERY_SEARCH_RETENTION_REVIEW.md`
- **Supersedes context of:** PRD/TDD-0007 (city-scoped search v1)

## Context

The strategy review (`docs/DISCOVERY_SEARCH_RETENTION_REVIEW.md`) found that IndLokal is built as four
parallel verticals (Feed / Events / Communities / Resources) with a **city-scoped** search that indexes
only communities + events. Diaspora users think **need → location** ("Telugu families near me",
"how do I register my address"), but the product forces **location → vertical → browse**.

Two structural facts in the codebase drive this decision:

1. `modules/search/queries.ts` requires a `citySlug` and returns `[]` without one — there is no global
   search, and resources/organizations are not indexed.
2. `Community` is overloaded: it represents informal groups, registered associations, temples,
   institutions, and (eventually) businesses with no way to distinguish them.

## Decision

1. **Discovery is one unified search surface, not four verticals.** Search spans Community + Event +
   Resource (Organization is modeled as a typed Community, see §3). A single result shape carries an
   `entityKind` discriminator.
2. **City is a filter/context, not a hard partition.** `citySlug` becomes optional across the search
   layer. Absence means "all Germany". The UI defaults to the user's city but keeps cross-city reachable.
3. **Ranking is blended**, not pure text relevance: `textRank × qualitySignal (trustScore / isEssential
/ recency) × (later) distance`. We keep Postgres FTS — **no external search engine or vector DB yet**.
4. **`organizationType` is added to `Community` as an additive taxonomy field** (enum) so the same node
   can represent associations, student groups, temples, cultural orgs, institutions, and businesses
   _without building any marketplace product_. Persona/audience/language vocabularies are centralized in
   `@indlokal/shared` to stop drift.
5. **Search is measured**: every executed search writes a query-telemetry signal (zero-result rate is a
   first-class metric) reusing the existing `UserInteraction(SEARCH)` + `search_performed` analytics.

## Consequences

- **Positive:** product aligns with real intent; resources become discoverable (acquisition + SEO);
  taxonomy unification unblocks faceting and a later AI concierge; we get the data to improve search.
- **Cost:** `searchAll` and its callers change signature (city optional); one additive migration
  (`organizationType`); search ranking becomes slightly more complex.
- **Explicitly deferred:** vector/semantic search, external search engine, AI concierge, and any
  marketplace (business/opportunity/investor/classifieds/rental). The unified-graph path reaches the
  long-term "OS for India–Europe" vision without them.

## Alternatives considered

- **Keep city-scoped search, add resources only.** Rejected: doesn't fix the intent mismatch.
- **Adopt a vector DB / external search now.** Rejected: premature; FTS + facets covers near-term needs
  at a fraction of the complexity (ADR principle: boring until usage justifies otherwise).
- **Add a separate `Organization` model.** Rejected for now: duplicates the rich `Community` lifecycle
  (claim/trust/collaborators); a typed `Community` is lower-risk and reversible.
