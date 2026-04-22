# TDD-0006: Community detail

- **Status:** Draft
- **Linked PRD:** PRD-0006
- **Depends on:** TDD-0001, TDD-0002, TDD-0003

## 1. Architecture overview

- Mobile screen `app/(tabs)/discover/communities/[slug].tsx`.
- Server reuses `src/modules/community/queries.ts`. Follow uses `SavedCommunity` table.

## 2. Data model changes

- Add `CommunityFollow` semantics is already covered by `SavedCommunity`; rename UX label to "Follow" but keep model for now.

## 3. API surface

| Method | Path                                      | Auth     | Request | Response             |
| ------ | ----------------------------------------- | -------- | ------- | -------------------- |
| GET    | `/api/v1/communities/:slug`               | optional | —       | `CommunityDetail`    |
| POST   | `/api/v1/communities/:slug/follow`        | access   | —       | `FollowState`        |
| DELETE | `/api/v1/communities/:slug/follow`        | access   | —       | `FollowState`        |
| GET    | `/api/v1/communities/:slug/events?cursor` | optional | —       | `EventsPage`         |
| GET    | `/api/v1/communities/:slug/related`       | optional | —       | `CommunitySummary[]` |

## 4. Mobile screens & navigation

Channel taps open `Linking.openURL(channel.url)`; deep links to WhatsApp/Telegram preferred over web.

## 5. Push / Email / Inbox triggers

- On follow: subscribe user to `COMMUNITY_UPDATE` for that community in a `community_follows` join with NotificationPreference (cap 3/day/community).

## 6. Feature flags

- `community.related.enabled`

## 7. Observability

- `community.detail.viewed`, `community.followed`, `community.unfollowed`, `community.channel.tapped{type}`.

## 8. Failure modes & fallbacks

- Channel URL invalid → silent fallback to website channel if available; capture trust signal.

## 9. Test plan

- Unit, Contract, E2E follow + notification enqueue path.

## 10. Rollout plan

GA with v1.0.

## 11. Backout plan

Disable related rail.
