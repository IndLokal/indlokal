# TDD-0020: Business Events Lens and Business Discovery Scope

- **Status:** Draft
- **Linked PRD:** PRD-0020
- **Owner:** Product Engineering

## 1. Architecture overview

Goal: ship a business-intent discovery lens with minimal disruption to existing city/event flows.

Phase A (fast path):

- Reuse existing event/category model.
- Add UI preset lens mapping to existing category slugs (`professional`, `networking-social`).
- Add SEO route for business events by city.

Phase B (hardening):

- Extend discovery events query to accept multiple categories.
- Move cost/type filters to API query layer to avoid client-side post-filter drift.

No new service boundary required; remains modular monolith within current event/discovery modules.

## 2. Data model changes

Phase A:

- No Prisma migration required.

Phase B optional:

- No table changes required if multi-category filter is implemented as query semantics over existing `event_categories` join table.

Phase C prep (not implemented in this TDD):

- Candidate design docs for organization directory can be drafted separately (likely `BusinessEntity`, `BusinessVerification`, `BusinessCategory`, `BusinessLocation`).

## 3. API surface

### Existing

- `GET /api/v1/discovery/{citySlug}/events`
  supports `categorySlug` as a single value today.

### Proposed additive query contract (Phase B)

Option A (recommended):

- Add `categorySlugs` (comma-separated or repeated params), preserve `categorySlug` for backward compatibility.

Semantics:

- If only `categorySlug` present, existing behavior.
- If `categorySlugs` present, treat as OR filter across provided slugs.
- If both provided, `categorySlugs` wins and `categorySlug` is ignored with warning log.

Additional query optimization:

- Add `cost` and `type` (online/in-person) at API level for consistent pagination.

| Method | Path                                | Auth   | Request                                                   | Response   |
| ------ | ----------------------------------- | ------ | --------------------------------------------------------- | ---------- |
| GET    | /api/v1/discovery/{citySlug}/events | Public | from,to,cursor,limit,categorySlug,categorySlugs,cost,type | EventsPage |

Contract updates required in:

- `packages/shared/src/contracts/discovery.ts`
- OpenAPI generation via shared scripts

## 4. Web surfaces

Files to update:

- Events listing page and filter bar for preset Business and Careers lens.
- City feed quick links/chips to business lens.
- New route: `apps/web/src/app/[city]/business-events/page.tsx`.
- Sitemap: include business-events route per active city.

Behavior:

- Business lens query maps to categories `professional` + `networking-social`.
- Empty state should point to all-events and communities.
- Metadata title/description optimized for business-intent local search.

## 5. Mobile surfaces

Files to update:

- Discover tab screen with business lens UI (chip or toggle under existing tab architecture).
- Discovery events fetch should support lens context in query params.

Behavior:

- One-tap lens switching.
- Preserve existing tabs and fallback to all-events when no lens is selected.

## 6. Analytics

Add lens context instrumentation:

- `lens_viewed` or equivalent event for business lens entry.
- Existing event interactions include property: `lens_context = business_careers | all`.

Instrumentation touchpoints:

- Web events page interactions.
- Mobile discover and event detail flows.

Dashboard additions:

- Session share by lens.
- Detail-view and conversion rates segmented by lens.

## 7. AI pipeline and content ingestion

Pipeline changes:

- Expand search strategy keyword set for business-intent events.
- Maintain strict evidence policy; do not treat LinkedIn/social-only as qualifying source evidence.
- Strengthen extraction QA for professional/networking category assignment.

Operational controls:

- Continue human review for ambiguous category classification.
- Add category distribution metrics in pipeline reporting.

## 8. Seed strategy

Directory and events seed:

- Increase verified professional/networking community rows in launch/active cities.
- Add recurring business/networking event examples where evidence exists.
- Keep source-policy compliance for all new rows.

No change to three-tier seed architecture.

## 9. Runtime controls

No dedicated business-lens feature flags are required.

Guidelines:

- Keep business lens and multicategory query support enabled by default on web and mobile.
- Use standard deployment rollback procedures if a release issue is detected.

## 10. Observability

Logs:

- Warning logs when both `categorySlug` and `categorySlugs` are supplied.
- Lens query usage counters.

Metrics:

- Events API latency and cache hit rate by lens query type.
- Empty response rate for business lens by city.

Alerts:

- Trigger if business lens empty-rate exceeds threshold for major cities after rollout.

## 11. Failure modes and fallbacks

| Failure                             | Fallback                                                               |
| ----------------------------------- | ---------------------------------------------------------------------- |
| Client sends only `categorySlug`    | Preserve backward-compatible single-category query handling            |
| Sparse city data returns empty lens | Show empty-state CTA to all events/communities                         |
| Misclassification in pipeline       | Human review correction in queue; no auto-publish bypass               |
| SEO page low-quality in sparse city | Gate indexing via robots metadata or keep page linked but low priority |

## 12. Test plan

Unit:

- Query parsing for `categorySlugs`, `cost`, `type`.
- Event query builder OR semantics for multi-category filters.

Integration:

- Discovery events endpoint returns expected union for professional/networking filters.
- Existing `categorySlug` behavior remains unchanged.
- Sitemap includes business-events route.

Web E2E:

- Business lens entry shows filtered events.
- Empty state renders expected CTAs.

Mobile E2E:

- Discover lens toggle fetches and renders filtered events.
- Event detail open/save/register interactions retain lens context analytics.

Regression:

- Existing all-events behavior unaffected for web and mobile.

## 13. Rollout plan

1. Ship contract and backend support, then validate integration tests.
2. Ship web lens and business-events page to staging; validate analytics.
3. Ship mobile lens and validate parity.
4. Promote to production through normal release flow.

Success gate before 100%:

- Adoption and conversion metrics from PRD-0020 meet minimum threshold.

## 14. Backout plan

- Revert the lens UI and business-events route in a hotfix release.
- Keep additive API contract in place for compatibility.
- Revert sitemap business-events entries if index quality concerns arise.
