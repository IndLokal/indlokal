# Analytics Event Catalog

Central catalog for analytics-bearing events. PRD/TDD-0042 is the parent strategy. Web and mobile code should use the canonical events below.

## Source Of Truth

1. `docs/specs/EVENTS/analytics.md` - canonical catalog and property contracts.
2. `apps/web/src/lib/analytics/events.ts` - canonical code constants.
3. `apps/mobile/lib/analytics/events.ts` - legacy wire names that may be mapped at the API boundary.

## Sink Ownership

- PostHog: product funnels and lightweight operational telemetry.
- UserInteraction: entity-bound engagement signals used for scoring and local readouts.
- Domain tables and logs: pipeline reliability, cost, and review forensics.

## Conventions

- Use snake_case event names and snake_case property keys.
- Do not send PII, free-form contact details, raw tokens, or names when a stable ID or slug is enough.
- Prefer primitive property values: strings, numbers, booleans, enums.
- Use `entity_id`, `entity_type`, `city`, `city_slug`, `lens_context`, `source_surface`, and `original_event` for cross-surface attribution.

## Canonical Events

### Lifecycle

| Event            | Required properties | Sink    | Notes                                                                |
| ---------------- | ------------------- | ------- | -------------------------------------------------------------------- |
| `user_signed_up` | none                | PostHog | New account creation or first successful auth that counts as signup. |
| `user_logged_in` | none                | PostHog | Successful verify/auth flows.                                        |

### Engagement

| Event                      | Required properties                     | Sink                      | Notes                                                               |
| -------------------------- | --------------------------------------- | ------------------------- | ------------------------------------------------------------------- |
| `search_performed`         | `query`, `has_results`, `results_count` | PostHog                   | Search funnel entry.                                                |
| `community_viewed`         | `entity_id`                             | PostHog + UserInteraction | Community detail view. Add `entity_slug` and `city` when available. |
| `event_viewed`             | `entity_id`                             | PostHog + UserInteraction | Event detail view. Add `entity_slug` and `city` when available.     |
| `community_access_clicked` | `community_id`                          | PostHog + UserInteraction | Access-channel click from community surfaces.                       |
| `community_followed`       | `community_id`                          | PostHog + UserInteraction | Follow/save community.                                              |
| `community_unfollowed`     | `community_id`                          | PostHog + UserInteraction | Unfollow/unsave community.                                          |
| `community_saved`          | `community_id`                          | PostHog + UserInteraction | Saved community funnel event.                                       |
| `community_unsaved`        | `community_id`                          | PostHog + UserInteraction | Unsaved community funnel event.                                     |
| `event_saved`              | `event_id`                              | PostHog + UserInteraction | Saved event funnel event.                                           |
| `event_unsaved`            | `event_id`                              | PostHog + UserInteraction | Unsaved event funnel event.                                         |
| `business_lens_viewed`     | `city`, `surface`, `lens_context`       | PostHog + UserInteraction | Business-discovery lens entry.                                      |

### Journeys (PRD/TDD-0052)

| Event                    | Required properties                                | Sink                      | Notes                                                             |
| ------------------------ | -------------------------------------------------- | ------------------------- | ----------------------------------------------------------------- |
| `journey_entry_click`    | `city`, `persona_slug`, `surface`                  | PostHog + UserInteraction | Click on a journey entry point (home strip, hub, landing promo).  |
| `journey_view`           | `city`, `persona`, `persona_slug`                  | PostHog + UserInteraction | A composed journey page was viewed (fired on mount).              |
| `journey_stage_view`     | `city`, `persona_slug`, `stage`                    | PostHog + UserInteraction | A lifecycle stage scrolled into view (IntersectionObserver).      |
| `journey_block_action`   | `city`, `persona_slug`, `entity_kind`, `entity_id` | PostHog + UserInteraction | Click on a block's action (the action-or-drop next step).         |
| `journey_save`           | `city`, `persona`, `persona_slug`                  | PostHog + UserInteraction | "Save this journey" bookmark (localStorage, no account required). |
| `journey_persona_switch` | `city`, `from_persona_slug`, `to_persona_slug`     | PostHog + UserInteraction | Persona switcher change on a journey page.                        |

### Conversion

| Event                 | Required properties | Sink    | Notes                  |
| --------------------- | ------------------- | ------- | ---------------------- |
| `community_submitted` | `type`              | PostHog | Submission conversion. |
| `claim_submitted`     | none                | PostHog | Claim conversion.      |

### Governance

| Event                             | Required properties                                      | Sink           | Notes                             |
| --------------------------------- | -------------------------------------------------------- | -------------- | --------------------------------- |
| `community_role_changed`          | `community_id`, `target_user_id`, `from_role`, `to_role` | PostHog + logs | Organizer authority changes.      |
| `host_event_submitted_for_review` | `event_id`, `city`                                       | PostHog + logs | Host workspace review submission. |
| `event_review_decision`           | `event_id`, `decision`, `reviewer_id`                    | PostHog + logs | Admin approval or rejection.      |
| `host_profile_updated`            | `city`, `has_links`                                      | PostHog + logs | Host profile edit path.           |

### Ops

| Event                      | Required properties                                                                        | Sink           | Notes                         |
| -------------------------- | ------------------------------------------------------------------------------------------ | -------------- | ----------------------------- |
| `pipeline_shard_completed` | `region_ids`, `city_slugs`, `items_fetched`, `items_queued`, `errors_count`, `duration_ms` | PostHog + logs | Cron shard observability.     |
| `pipeline_dispatched`      | `regions_total`, `regions_dispatched`, `regions_failed`, `concurrency`                     | PostHog + logs | Dispatcher fan-out telemetry. |

## Property Examples

- `community_viewed`: `entity_id`, `entity_slug`, `city`, `source_surface`
- `event_viewed`: `entity_id`, `entity_slug`, `city`, `source_surface`
- `business_lens_viewed`: `city`, `surface`, `lens_context`
- `pipeline_shard_completed`: `region_ids`, `city_slugs`, `items_fetched`, `items_queued`, `errors_count`, `duration_ms`

## Admin Workspace

`/admin/analytics` is the general operational analytics workspace. It should read local database signals and domain tables, not replace PostHog dashboards.

Default sections should start with business-intent readouts and then expand into other decision areas as new PRDs add them.
