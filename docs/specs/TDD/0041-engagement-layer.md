# TDD-0041: Engagement layer

- **Status:** Draft
- **Owner:** Eng Lead
- **Linked:** PRD-0041, PRD/TDD-0002, PRD/TDD-0005, PRD/TDD-0006, [notifications.md](../EVENTS/notifications.md), [analytics.md](../EVENTS/analytics.md)
- **Created:** 2026-06-02

## 1. Architecture overview

The engagement layer extends existing save, notification, analytics, and discovery primitives.
No new engagement service is introduced.

| Capability        | Persistence / module reused                                                         | Backend change                                         |
| ----------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Follow community  | `SavedCommunity`                                                                    | semantic wrappers/copy, analytics, optional API parity |
| Save event        | `SavedEvent`                                                                        | reminder scheduling/cancel path where missing          |
| Recall surfaces   | existing `/me` and mobile saved/bookmarks                                           | rename community section to `Following`                |
| Notifications     | `NotificationPreference`, `NotificationOutbox`, `InboxItem`, `Device`, `QuietHours` | enqueue community updates and saved-event reminders    |
| Personalization   | profile fields, event/community metadata, `UserInteraction`                         | deterministic scoring helper                           |
| Organizer signals | aggregate queries over saves/interactions                                           | read-only metric cards where surfaces exist            |

Core flow:

```text
user action -> server action or /api/v1 route -> Prisma write -> UserInteraction / analytics
  -> optional NotificationOutbox enqueue -> UI revalidation or client cache invalidation
```

## 2. Data model changes

No required Prisma migration for MVP.

Reuse `SavedCommunity(userId, communityId, savedAt)` for community follow and
`SavedEvent(userId, eventId, savedAt)` for event save. Keep table/model names unchanged even
though user-facing copy changes.

Do not add `CommunityFollow`, city/category follow tables, notification-level metadata, or
database-configured ranking weights in MVP. Revisit only if per-community notification levels
or richer follow analytics become product requirements.

## 3. API and action surface

Reuse existing save actions/routes when present. If mobile parity needs explicit endpoints, add
or confirm:

| Method   | Path                               | Auth     | Purpose                                     |
| -------- | ---------------------------------- | -------- | ------------------------------------------- |
| `POST`   | `/api/v1/communities/:slug/follow` | required | follow community                            |
| `DELETE` | `/api/v1/communities/:slug/follow` | required | unfollow community                          |
| `POST`   | `/api/v1/events/:slug/save`        | required | save event                                  |
| `DELETE` | `/api/v1/events/:slug/save`        | required | unsave event                                |
| `GET`    | `/api/v1/me/engagement`            | required | following, saved events, preference summary |

Equivalent existing routes should be updated in place, not duplicated. Shared contracts should
return stable `isFollowing` / `isSaved` state and optional timestamps.

## 4. Module touchpoints

- `apps/web/src/app/actions/saves.ts` - keep existing exports compatible; add semantic wrappers
  such as `toggleFollowCommunity` only if it makes call sites clearer.
- Community queries - include current-user follow state on detail and follower counts for
  authorized organizer/admin aggregate surfaces.
- Event queries - include current-user save state on detail and save counts for authorized
  organizer/admin aggregate surfaces.
- Notification helpers - enqueue `COMMUNITY_UPDATE` for followers and schedule/suppress
  `SAVED_EVENT_REMINDER` rows using the existing outbox/preference path.
- Discovery/feed module - add deterministic scoring for digest or `for you` ordering using
  followed communities, saved-event categories, city, persona/category, language, trending, and
  quality signals.
- Mobile client - invalidate community detail, event detail, discovery lists, and me/bookmarks
  queries after follow/save mutations.

## 5. Notification behavior

- **COMMUNITY_UPDATE:** triggered by a new published event for a followed community, and only by
  material community updates if the notification spec already supports them. Recipient set is
  `SavedCommunity` users for the community.
- **SAVED_EVENT_REMINDER:** triggered when a user saves an upcoming event and reminder windows
  remain in the future. Unsaving should suppress or cancel pending reminder rows where supported;
  already-sent notifications are not recalled.
- **WEEKLY_DIGEST:** scheduled digest prioritizes followed-community events, saved-event
  categories, city/metro matches, and high-quality trending events. Suppress low-quality or empty
  digests.

All notification paths must respect channel availability, preferences, quiet hours, frequency
caps, score gates where applicable, and idempotency keys.

## 6. Interaction tracking and analytics

Persist `UserInteraction` rows where server-side history is useful:

| Action                | Suggested interaction                                  |
| --------------------- | ------------------------------------------------------ |
| community detail view | `VIEW`, `COMMUNITY`                                    |
| follow community      | `SAVE`, `COMMUNITY`, metadata `{ semantic: "FOLLOW" }` |
| event detail view     | `VIEW`, `EVENT`                                        |
| save event            | `SAVE`, `EVENT`                                        |
| access-channel tap    | `CLICK_ACCESS`, `COMMUNITY`                            |
| share                 | `SHARE`, matching entity type                          |
| report                | `REPORT`, matching entity type                         |

Track unfollow/unsave and digest click/open events through the analytics provider if
`UserInteraction` does not have a clean enum for negative actions. Metadata should avoid PII,
full external URLs, and high-cardinality free text.

## 7. Authorization and privacy

- Follow/save mutations require an authenticated user.
- Duplicate follow/save and missing-row unfollow/unsave are idempotent successes.
- Organizer engagement metrics require organizer/community authority.
- Admin aggregate metrics require admin/operator authority.
- Individual followers, savers, and notification recipients are never exposed to organizers in
  MVP.

## 8. Failure modes & fallbacks

- **Logged-out mutation:** return 401 or `requiresAuth`; UI prompts sign-in and preserves return
  target where possible.
- **Notification enqueue failure:** keep follow/save success, log the enqueue failure, and rely
  on existing retry paths if available.
- **Event too soon or past:** save succeeds; schedule only valid future reminders.
- **Analytics disabled:** never block the user action.
- **Digest underfilled:** suppress or fall back to high-confidence city content.
- **Invalid community channel URL:** do not block follow/save; report through existing quality
  diagnostics if available.

## 9. Feature flags

No new feature flag is required unless implementation needs a staged rollout. If a flag is added,
prefer a single engagement-layer flag around notification/digest side effects; follow/save UI can
ship as additive copy and recall work.

## 10. Observability

- Log follow/save mutation failures, reminder scheduling counts, community-update enqueue and
  suppression counts, and digest eligible/enqueued/suppressed counts.
- Record follow/save attempts, successes, and failures if the analytics/event catalog supports
  operational metrics.
- Mirror PRD analytics event names in the analytics catalog before launch.

## 11. Test plan

- **Unit:** community follow creates/deletes `SavedCommunity`; event save creates/deletes
  `SavedEvent`; duplicate mutations are idempotent; reminder scheduler skips invalid windows;
  scoring prioritizes followed-community events deterministically.
- **Integration:** authenticated follow/save API or action flows; `/me` or
  `/api/v1/me/engagement` returns following and saved events; followed-community new event
  enqueues eligible `COMMUNITY_UPDATE`; saved event enqueues eligible reminders; unsave
  suppresses pending reminders where supported.
- **UI:** community detail Follow -> Following; logged-out Follow/Save prompts sign-in; account
  surface says `Following` for communities and `Saved Events` for events; event detail Save ->
  Saved; saved events render in web and mobile recall surfaces.
- **Regression:** existing community/event detail pages render for logged-out users; existing
  saved-event behavior remains backward compatible; share/register/channel actions still work.

## 12. Rollout and backout

Ship in small increments: terminology and recall surfaces first, mutation/analytics wiring next,
then notification side effects, digest scoring, and organizer aggregate cards.

Backout is additive: disable notification/digest side effects first, then hide new UI affordances
if needed. Existing `SavedCommunity` and `SavedEvent` rows can remain because they are reused
models.
