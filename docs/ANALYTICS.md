# Analytics Guide - PostHog Implementation

> Last updated: 2026-05  
> Stage: MVP+  
> Owner: Engineering team

## Purpose

PostHog is used for product analytics and lightweight operational telemetry.

- Product journeys: discovery, search, community detail views, conversion clicks
- Conversion rails: submit + claim
- Pipeline observability: cron shard completion metrics (Berlin/BW/Bavaria/Hesse)

We do not use PostHog for:

- Infrastructure error monitoring
- Deep backend tracing/APM
- Ad attribution modeling

## Current Architecture

Client:

- Provider + identify components initialize posthog-js and user identity
- Feature components fire explicit events through useTrackEvent

Server:

- API routes/server actions use captureServerEvent
- `/api/v1/track` maps selected mobile events (for example `event.detail.viewed`) into canonical PostHog events
- Tracking no-ops when no PostHog key is configured

## Key Files

| File                                                | Purpose                                |
| --------------------------------------------------- | -------------------------------------- |
| apps/web/src/lib/analytics/events.ts                | Canonical event names                  |
| apps/web/src/lib/analytics/hooks.ts                 | useTrackEvent client hook              |
| apps/web/src/lib/analytics/server.ts                | captureServerEvent for server contexts |
| apps/web/src/lib/analytics/index.ts                 | Client-safe barrel exports             |
| apps/web/src/components/analytics/ViewTracker.tsx   | community_viewed / event_viewed        |
| apps/web/src/components/analytics/SearchTracker.tsx | search_performed                       |
| apps/web/src/app/api/cron/pipeline/route.ts         | pipeline_shard_completed telemetry     |

## Environment Variables

| Variable                 | Required    | Description                                          |
| ------------------------ | ----------- | ---------------------------------------------------- |
| POSTHOG_KEY              | Recommended | Server-side PostHog key (preferred on server)        |
| POSTHOG_HOST             | No          | Server-side host override (default eu.i.posthog.com) |
| NEXT_PUBLIC_POSTHOG_KEY  | Yes (prod)  | Browser API key (also used as server fallback)       |
| NEXT_PUBLIC_POSTHOG_HOST | No          | Browser host (default eu.i.posthog.com)              |

If both `POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_KEY` are missing, analytics silently no-op.

## Canonical Event List

Source of truth: apps/web/src/lib/analytics/events.ts

Lifecycle:

- user_signed_up
- user_logged_in

Engagement:

- search_performed
- community_viewed
- event_viewed
- community_access_clicked
- community_saved
- community_unsaved
- business_lens_viewed

Conversion:

- community_submitted
- claim_submitted

Ops observability:

- pipeline_shard_completed
- pipeline_dispatched

Governance / organizer:

- community_role_changed
- host_event_submitted_for_review
- event_review_decision
- host_profile_updated

## Event Property Guidelines

- Use snake_case keys
- No PII (no email/name/phone)
- Keep property values primitive and queryable

Examples:

- search_performed: query, city, results_count, has_results
- community_viewed: entity_id, entity_slug, city
- pipeline_shard_completed: region_ids, city_slugs, items_fetched, items_queued, errors_count, duration_ms

## Identity Rules

- Use stable internal user ID as distinctId for authenticated events
- For unauthenticated flows, use non-PII system IDs (for example anonymous-submitter, system-cron)
- On logout, client identity should reset to avoid cross-user contamination on shared devices

Lifecycle emission coverage:

- `user_signed_up`: host sign-up (`/organizer/host/start`) and Apple first-time auth (`/api/v1/auth/apple`)
- `user_logged_in`: organizer/admin magic-link verify and API v1 auth verify flows

## Dashboards To Keep

Product funnels:

- pageview -> search_performed -> community_viewed -> community_access_clicked
- pageview(/submit) -> community_submitted
- community_viewed -> claim_submitted

Berlin rollout / shard health:

- Trend: pipeline_shard_completed by region_ids
- Breakdown: items_queued, errors_count, duration_ms by shard
- Alerting heuristic: errors_count > 0 for same shard 2+ consecutive runs

## Adding New Events

1. Add name to apps/web/src/lib/analytics/events.ts
2. Emit via useTrackEvent (client) or captureServerEvent (server)
3. Document properties in this file
4. Validate in PostHog Live Events

## Privacy Rules

1. Never send contact details as event properties
2. Never use email as distinctId
3. Keep analytics optional in dev/CI

## Troubleshooting

Events missing:

1. Verify `NEXT_PUBLIC_POSTHOG_KEY` (client) and/or `POSTHOG_KEY` (server)
2. Check network requests to /ingest
3. Check Live Events in PostHog

Identity mismatch:

1. Verify identify/reset lifecycle is mounted globally
2. Ensure server-side distinctId matches user.id for authenticated events
