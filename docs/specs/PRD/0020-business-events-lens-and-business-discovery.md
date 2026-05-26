# PRD-0020: Business Events Lens and Business Discovery Scope

- **Status:** Draft
- **Owner:** Product Head (JP)
- **Reviewers:** CEO, PM, Eng Lead, Ops Lead
- **Linked:** TDD-0020, PRD-0003, PRD-0010, PRD-0013, PRD-0014, ADR-0003, ADR-0005

## 1. Problem

Two asks are currently competing for scope:

1. Should we add a dedicated Business events section, or are top filters enough?
2. Should we add an Indian businesses in Germany directory (or Indian business leaders)?

Current state:

- Events are discoverable, but business-intent users must know how to use category filters and infer that Professional + Networking captures the intent.
- Mobile Discover has tabs (Events, Communities, For you) but no business-intent quick lens.
- Resources already include Business Setup guides, but this is not a business directory.

Product risk if we do nothing: high-intent professional users have a slower path to value.
Product risk if we over-build now: we dilute the activity-led thesis into a low-trust, high-moderation business directory too early.

## 2. Users and JTBD

- **Settled Explorer (Professional):** "Show me business-relevant events quickly without sifting through all cultural events."
- **Newcomer (Professional):** "Help me find career and networking opportunities in my city this week."
- **Community Organizer (professional networks):** "I want my business/networking events to be found by the right audience."
- **Ops/Content team:** "I need a clear policy for what business content we surface now vs later."

## 3. Success Metrics

Primary:

- Business lens adoption: share of event sessions opened via Business lens target 15%+ by month 2.
- Business lens detail-view rate: 40%+ of Business lens sessions open at least one event detail.
- Business lens access-click conversion: 12%+ session-level conversion (registration or community access click).

Secondary:

- 7-day return of business-lens users at or above baseline event return rate.
- Zero material increase in stale or low-trust listings from business-focused ingestion.

Guardrails:

- Do not degrade "All events" engagement.
- No launch of public business-leader profile pages in this phase.

## 4. Scope

### In scope (Phase A)

- Add a **Business and Careers lens** for events across web and mobile.
- Implement as a **preset query over existing categories** (`professional`, `networking-social`) and optional resource cross-links.
- Add city-level SEO entry page for business events (programmatic style, same model as existing events pages).
- Add business-lens analytics events and dashboards.

### In scope (Phase B, contingent on A metrics)

- Add API support for multi-category event filtering (instead of single `categorySlug`).
- Move cost/type filtering server-side for consistency with pagination.

### In scope (Phase C discovery prep, no public launch)

- Define candidate model and governance for future Indian businesses directory (organization-first, not person-first).
- Expand business network seed quality and pipeline source planning for business-relevant events.

## 5. Out of Scope

- Public directory of Indian business leaders in Germany.
- Public people profiles (founder/executive ranking pages).
- Full B2B business listing marketplace with ads/sponsorship inventory.
- New standalone app area outside city-first navigation.

## 6. Product Decisions

1. **Yes, add Business events section now** as a lens entry point.
2. **No, do not launch business leaders section now** (verification, legal, and moderation risk).
3. **Do not launch full businesses directory now**; run a staged path: business events lens first, then evaluate supply and trust readiness.

Rationale:

- Aligns with activity-led core (events-first) and current taxonomy.
- Low implementation complexity and low migration risk.
- Keeps trust bar aligned with existing source-evidence policy.

## 7. User Stories

- As a professional user, I can open a Business and Careers view and immediately see relevant upcoming events.
- As a mobile user, I can access business-relevant events in one tap from Discover.
- As an organizer of a networking event, my event can be surfaced in the business lens if correctly categorized.
- As Ops, I can report business-lens performance separately from all-events performance.

## 8. Acceptance Criteria (Gherkin)

```
Given a city has upcoming events tagged with category slugs professional or networking-social
When a user opens the Business and Careers lens
Then only events matching that business lens definition are shown
And the list is ordered chronologically

Given a user is on mobile Discover
When they switch to Business and Careers lens
Then the feed updates without requiring manual category filtering

Given business lens analytics is enabled
When a user views, clicks, saves, or registers from this lens
Then events are tracked with lens context = "business_careers"

Given the business events SEO page exists
When sitemap is generated
Then each active city includes a business-events page URL

Given a request to create Indian business leader profile pages
When this release is evaluated
Then no leader profile surface is exposed publicly
```

## 9. UX

Web:

- Add a Business and Careers quick chip at top of events filters and city feed quick links.
- Add dedicated city page (for example, `/[city]/business-events/`) with copy and card rail consistent with events pages.

Mobile:

- Add a Discover lens chip or tab-level toggle named Business and Careers.
- Preserve existing Events/Communities/For you behavior.

States:

- Empty state copy should suggest broader Events and Communities if no business events exist.
- Loading/error patterns should follow current Discover and Events patterns.

## 10. Backend and API

- Continue supporting current single-category route behavior.
- Introduce additive query support for multi-category filter in discovery events endpoint.
- Keep existing contracts backward-compatible; web/mobile can progressively adopt.

## 11. AI Pipeline and Content

- Expand source planning and extraction prompts for business-event intent, while retaining strict evidence policy.
- Do not lower acceptance quality for business content.
- Ensure category assignment quality for professional/networking-related events through review queue checks.

## 12. Seed and Taxonomy

- Preserve current taxonomy in Phase A; no mandatory new category required.
- Improve city seed density for professional/networking communities and recurring events.
- If needed in Phase B+, evaluate adding explicit `business-careers` category only after impact analysis.

## 13. Testing and Validation

- Add API integration tests for business-lens query behavior.
- Add web and mobile tests for lens visibility and routing.
- Add analytics assertions for lens-context event emission.
- Add sitemap test coverage for business-events URLs.

## 14. Rollout Plan

Phase A:

- Feature-flagged UI lens and SEO page.
- Internal QA on Stuttgart, then canary to production.

Phase B:

- API multi-category support and server-side filtering optimization.

Phase C decision gate:

- Reassess businesses directory only if lens adoption, content density, and trust metrics pass thresholds for 8-12 weeks.

## 15. Risks and Open Questions

Risks:

- Sparse business events in some cities may create empty experiences.
- Overlap ambiguity between professional/networking and other categories.
- Pressure to prematurely launch leader profiles.

Open questions:

- Should business lens include jobs/career workshop events tagged as student/professional hybrid?
- What minimum city-level business-event density should gate SEO indexing for business-events pages?
- Which analytics event names and properties should be standardized in EVENTS catalog updates?
