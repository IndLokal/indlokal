# TDD-0042: Analytics Strategy and Workspace

- **Status:** Draft
- **Linked PRD:** PRD-0042
- **Owner:** Product Engineering

## 1. Architecture overview

Analytics is a cross-surface platform capability, not a per-feature side effect.

The architecture has three sinks:

1. **PostHog** for product funnels and lightweight operational telemetry.
2. **`UserInteraction`** for durable local engagement signals used by scoring,
   saves/follows, and admin operational readouts.
3. **Domain observability tables/logs** for pipeline cost, reliability, and
   review forensics.

The admin analytics workspace (`/admin/analytics`) reads local database signals
for lightweight operational questions. It does not replace PostHog.

```text
web client ─┐
            ├─ canonical event constants ── PostHog
server ─────┘

mobile client ── /api/v1/track ── canonical mapping ── PostHog
                                    │
                                    └── UserInteraction when entity-bound

web ViewTracker ── /api/track ── UserInteraction

domain actions ── engagement module ── UserInteraction + PostHog

admin /analytics ── local DB queries over UserInteraction/domain tables
```

## 2. Data model changes

No immediate Prisma migration.

Existing local signal table:

- `UserInteraction`
  - `entityType`
  - `entityId`
  - `interactionType`
  - `cityId`
  - `metadata`
  - `createdAt`

Rules:

- `UserInteraction` is for entity-bound engagement and local operational
  readouts.
- It is not a full product analytics event log.
- Feature-specific metadata must stay small, non-PII, and queryable.
- Scoring code must not depend on feature-only metadata unless a TDD explicitly
  says so.

## 3. API surface

No new endpoint is required for the strategy.

Existing endpoints:

| Method | Path            | Auth     | Purpose                                               |
| ------ | --------------- | -------- | ----------------------------------------------------- |
| POST   | `/api/track`    | Optional | Web local entity view tracking into `UserInteraction` |
| POST   | `/api/v1/track` | Optional | Mobile/shared event tracking and canonical event map  |

Expected hardening after catalog cleanup:

- Make `/api/v1/track` validate known event names with a shared Zod enum.
- Keep compatibility mappings for older mobile dot-style event names until
  mobile clients are migrated.
- Document every accepted event in `docs/specs/EVENTS/analytics.md`.

## 4. Mobile screens & navigation

Mobile emits events through `apps/mobile/lib/analytics/events.ts` and
`track.expo.ts`.

Rules:

- Prefer canonical snake_case names for new events.
- Existing dot-style events may remain only when `/api/v1/track` maps them to
  canonical names.
- Cross-surface context must use shared property names, for example:
  - `city`
  - `citySlug` at the API boundary
  - `entity_id`
  - `lens_context`
  - `source_surface`

## 5. Push / Email / Inbox triggers

None.

Notification analytics remain documented in `docs/specs/EVENTS/notifications.md`
and may emit analytics events only if listed in the central analytics catalog.

## 6. Feature flags

No global analytics flag.

Analytics behavior:

- Missing PostHog keys cause no-op PostHog emission.
- Local `UserInteraction` writes remain best-effort and must not block user
  flows.
- Admin analytics sections should render empty states when no local data exists.

## 7. Observability

Canonical sources:

- Event names: `apps/web/src/lib/analytics/events.ts`
- Catalog and property contracts: `docs/specs/EVENTS/analytics.md`
- Implementation guide: `docs/ANALYTICS.md`
- Admin workspace: `/admin/analytics`

Sink ownership:

| Question                                    | Sink                          |
| ------------------------------------------- | ----------------------------- |
| Product funnel across sessions/surfaces     | PostHog                       |
| Local city/entity engagement readout        | `UserInteraction`             |
| Community/event scoring inputs              | `UserInteraction` + domain DB |
| Pipeline run/cost/reliability observability | Pipeline tables/logs/PostHog  |
| Admin operational slice                     | `/admin/analytics`            |

Property rules:

- Use snake_case inside PostHog properties.
- Use non-PII internal IDs, slugs, enums, and booleans.
- Do not send email, phone, names, raw URLs with tokens, or free-form contact
  details.
- Use `lens_context` for query/lens attribution.
- Use `source_surface` for web/mobile/admin/system source attribution.

## 8. Failure modes & fallbacks

| Failure                           | Fallback                                                    |
| --------------------------------- | ----------------------------------------------------------- |
| PostHog key missing               | Product still works; PostHog calls no-op                    |
| `/api/v1/track` receives old name | Map to canonical event when documented                      |
| Local interaction write fails     | Swallow error; never block the user action                  |
| Admin analytics query has no data | Render empty state                                          |
| Catalog drift                     | Block future analytics-bearing PRs until catalog is updated |

## 9. Test plan

For central strategy implementation:

- Typecheck:
  - `pnpm -F web typecheck`
  - `pnpm -F mobile typecheck`
- Lint:
  - `pnpm -F web lint`
- Mobile pure analytics/cache tests:
  - `pnpm -F mobile test`

Future hardening tests:

- Unit tests for `/api/v1/track` canonical mapping.
- Contract test ensuring code event constants are listed in
  `docs/specs/EVENTS/analytics.md`.
- Admin analytics page render test once the workspace grows beyond one section.

## 10. Rollout plan

1. Adopt this spec as the analytics parent for new measurement work.
2. Move current business-intent instrumentation to PRD/TDD-0043.
3. Update `docs/ANALYTICS.md` to point to PRD/TDD-0042 as the strategy source.
4. Clean up `docs/specs/EVENTS/analytics.md` in a follow-up so it matches the
   actual canonical code events.
5. Route future lightweight admin readouts through `/admin/analytics` unless a
   PRD explicitly justifies a standalone surface.

## 11. Backout plan

This is a strategy/spec alignment. Backout means reverting the spec files and
returning feature-level analytics ownership to each individual PRD/TDD. That is
not recommended.
