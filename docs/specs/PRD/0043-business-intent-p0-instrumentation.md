# PRD-0043: Business Intent P0 Instrumentation

- **Status:** Implemented
- **Owner:** Product Head
- **Reviewers:** PM, Eng Lead
- **Linked:** TDD-0043, PRD-0020, PRD/TDD-0042, EVENTS/analytics.md

## 1. Problem

PRD-0020 established the staged business strategy: ship a Business and Careers
events lens now, but do not launch business listings, business search, business
owner profiles, or paid placements until demand and content quality are proven.

PRD/TDD-0042 establishes the central analytics strategy. This spec applies that
strategy to the first business-intent measurement slice.

The lens exists on web and mobile, but the product team needs a local, durable
way to answer:

- Are users opening the Business and Careers lens?
- Are lens users opening event details?
- Are lens users saving events or clicking registration links?
- Which cities have empty business-lens experiences?

Without this P0 instrumentation, the next business decision would be based on
anecdote instead of usage evidence.

## 2. Users & JTBD

- **Founder / Product:** "I need to know whether business intent exists before
  adding a new business directory surface."
- **Ops Lead / Partnerships Lead:** "I need to see which cities lack
  business-relevant supply."
- **Professional member:** "When I use Business and Careers, my downstream
  actions should count toward the same product funnel."

## 3. Success Metrics

Measured over a rolling 30-day window:

- Business lens views by city.
- Business lens empty-view rate by city.
- Detail-view rate from business-lens sessions.
- Business-lens event saves.
- Business-lens registration clicks.

Decision thresholds remain owned by PRD-0020. This P0 only makes the signals
observable.

## 4. Scope

- Track Business and Careers lens views on web and mobile with
  `lens_context = business_careers`.
- Capture result count on lens views so empty experiences are measurable.
- Preserve business lens context from event list to event detail.
- Attach business lens context to event detail views, saves, and registration
  clicks.
- Add a Business intent section inside the central admin analytics workspace at
  `/admin/analytics`, showing city-level adoption and conversion signals.
- Use PRD/TDD-0042 sink rules: PostHog for product funnels and
  `UserInteraction` for local operational readouts.

## 5. Out of Scope

- Business listing data model.
- Public business search or `/[city]/businesses`.
- Business owner console.
- Business claim flow.
- Paid/sponsored listings.
- Business leader/person profiles.
- New recommendation or ranking logic.
- New database migrations.
- A standalone business analytics workspace.

## 6. User Stories

- As Product, I can open `/admin/analytics` and see whether the business lens is
  being used by city without creating a standalone business console.
- As Product, I can see when a city has business-lens views but no matching
  event supply.
- As Product, I can compare lens views against event detail, save, and
  registration-click behavior.
- As a mobile user, when I open an event from the Business and Careers lens, my
  event actions retain that context.
- As a web user, when I open an event from `/business-events` or the business
  lens on `/events`, my event actions retain that context.

## 7. Acceptance Criteria (Gherkin)

```gherkin
Given a user opens /stuttgart/business-events
When the page renders
Then a business_lens_viewed event is recorded with lens_context = business_careers
And result_count reflects the number of rendered business events
```

```gherkin
Given a user opens /stuttgart/events?lens=business
When they click an event card
Then the event detail URL preserves lens=business
And the event_viewed signal includes lens_context = business_careers
```

```gherkin
Given a signed-in user saves an event reached from the business lens
When the save succeeds
Then the event save interaction includes lens_context = business_careers
```

```gherkin
Given a user clicks an event registration link from a business-lens event detail
When tracking succeeds
Then the registration click is recorded as an EVENT CLICK_ACCESS interaction
And the metadata includes lens_context = business_careers
```

```gherkin
Given admin business metrics exist for the last 30 days
When an admin opens /admin/analytics
Then they see lens views, empty rate, detail rate, saves, and clicks by city
```

## 8. UX

Admin-only analytics workspace section:

- Path: `/admin/analytics`.
- Section: Business intent.
- Purpose: compact product-signal readout, not a dashboard suite.
- Contents: Business intent headline stats and a city table.
- Empty state: show that no business-lens interactions have been recorded yet.

No public UX changes beyond preserving `?lens=business` while navigating from
business-lens event lists to event detail.

## 9. Risks & Open Questions

Risks:

- Local `user_interactions` is an operational analytics source, not a full
  attribution system. Counts may differ from PostHog session-level analysis.
- A single event detail URL query parameter is enough for P0, but future
  cross-session attribution would need a stronger model.
- Empty-rate depends on the rendered result count, not a separate server-side
  aggregate.

Open questions:

- What city-level business-event density should unlock future business search?
- Should PRD-0020's thresholds be revised after the first 30 days of data?
