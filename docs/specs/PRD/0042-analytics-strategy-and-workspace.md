# PRD-0042: Analytics Strategy and Workspace

- **Status:** Draft
- **Owner:** Product Head
- **Reviewers:** PM, Eng Lead, Ops Lead
- **Linked:** TDD-0042, EVENTS/analytics.md, docs/ANALYTICS.md

## 1. Problem

IndLokal has analytics building blocks, but not yet a single analytics strategy.

Current state:

- PostHog is documented in `docs/ANALYTICS.md` and used for product analytics.
- `apps/web/src/lib/analytics/events.ts` is the actual canonical web event list.
- `apps/mobile/lib/analytics/events.ts` uses mobile-friendly event names that are
  mapped through `/api/v1/track`.
- `docs/specs/EVENTS/analytics.md` is intended as the shared catalog, but it is
  stale and does not match the code consistently.
- `UserInteraction` is used for engagement scoring, saved/followed behavior,
  and some local operational analytics.
- Admin readouts exist or are emerging per feature area rather than from a
  governed analytics workspace.

This creates a product risk: every new feature can invent one-off event names,
properties, local queries, and admin dashboards. That makes funnels hard to
compare across web/mobile and makes decisions feel anecdotal.

## 2. Users & JTBD

- **Founder / Product:** "I need one trusted metric stack for activation,
  conversion, supply quality, and feature probes."
- **Engineering:** "I need a clear rule for when to emit PostHog events, when to
  write `UserInteraction`, and how mobile/web event names map."
- **Ops Lead / Partnerships Lead:** "I need lightweight admin readouts for city
  and supply decisions without creating separate dashboards per feature."
- **Future Organizer / Partner surfaces:** "When analytics are exposed later,
  they should use the same governed event model, not ad hoc counters."

## 3. Success Metrics

Governance:

- 100% of new analytics events are listed in the central catalog before code is
  merged.
- 100% of web/mobile shared funnels use canonical event names or documented
  compatibility mappings.
- No new feature-specific admin analytics route unless it is explicitly
  justified by a PRD; default is a section inside `/admin/analytics`.

Product:

- Core activation funnel can be read from PostHog:
  discovery → detail view → save/follow/access click.
- Local admin analytics can answer city-level operational questions from
  existing database signals.
- Scoring inputs remain separable from product analytics semantics.

## 4. Scope

- Define the analytics source-of-truth hierarchy:
  1. `docs/specs/EVENTS/analytics.md` for event catalog and properties.
  2. `apps/web/src/lib/analytics/events.ts` for canonical code constants.
  3. Mobile event names may differ only when mapped in `/api/v1/track`.
- Define sink ownership:
  - PostHog: product funnels and lightweight operational telemetry.
  - `UserInteraction`: local engagement/scoring signals and admin operational
    readouts.
  - Structured logs / pipeline tables: pipeline reliability, cost, and run
    forensics.
- Define `/admin/analytics` as the general admin analytics workspace.
- Establish property conventions for lens/source attribution.
- Establish privacy and PII rules.
- Establish migration expectations for stale dot-style mobile events.
- Make feature-specific analytics specs, such as PRD/TDD-0043, depend on this
  strategy.

## 5. Out of Scope

- Full analytics warehouse.
- BI vendor integration beyond PostHog.
- Deep attribution modeling, ad attribution, or campaign spend reporting.
- Real-time alerting beyond existing pipeline telemetry.
- Organizer-facing analytics dashboard.
- Public analytics pages.
- Changing the scoring model itself.

## 6. User Stories

- As Product, I can read one analytics strategy before approving a feature that
  emits new events.
- As Engineering, I know whether a user action should be PostHog-only,
  `UserInteraction`, or both.
- As Engineering, I can map mobile events to canonical events without guessing.
- As Ops, I can open `/admin/analytics` for operational metric slices instead of
  searching feature-specific admin pages.
- As Product, I can compare web and mobile funnels using the same canonical
  vocabulary.

## 7. Acceptance Criteria (Gherkin)

```gherkin
Given a new feature proposes analytics events
When the PRD/TDD is reviewed
Then each event is added to docs/specs/EVENTS/analytics.md
And each event has required properties, optional properties, and sink ownership
```

```gherkin
Given a web client emits a product event
When the event is implemented
Then it uses apps/web/src/lib/analytics/events.ts
And it follows snake_case property conventions
```

```gherkin
Given a mobile event uses a legacy dot-style name
When it reaches /api/v1/track
Then the endpoint maps it to a documented canonical event
And passes through non-PII metadata
```

```gherkin
Given an admin needs a lightweight operational analytics readout
When the readout is implemented
Then it is added as a section of /admin/analytics by default
And it documents whether it reads PostHog, UserInteraction, or domain tables
```

```gherkin
Given an event property might contain PII
When analytics code is reviewed
Then the property is rejected or replaced with a non-PII identifier
```

## 8. UX

Admin analytics workspace:

- Path: `/admin/analytics`.
- Purpose: lightweight operational product readouts, not a replacement for
  PostHog dashboards.
- Default structure: sections by decision area, starting with business intent in
  PRD/TDD-0043.
- Required section anatomy:
  - short title
  - decision-oriented description
  - compact headline metrics
  - table or list only when it supports an operational decision
  - empty state that explains no data has been recorded yet

No public UX change.

## 9. Risks & Open Questions

Risks:

- `UserInteraction` can become overloaded if used as a general analytics event
  table instead of a local engagement signal table.
- PostHog and `UserInteraction` counts will differ because they answer different
  questions.
- Stale docs may continue drifting unless catalog updates are part of the PR
  checklist.

Open questions:

- Should mobile dot-style events be fully renamed to canonical snake_case, or
  kept as compatibility names at the client boundary?
- Should `/api/v1/track` accept a stricter Zod union of event names once the
  catalog is cleaned up?
- What is the minimum admin analytics workspace that is useful without becoming
  a BI product?
