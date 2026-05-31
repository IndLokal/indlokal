# TDD-0037: Event governance and approval model

- **Status:** Implemented
- **Linked PRD:** PRD-0037
- **Linked ADR:** ADR-0009
- **Owner:** Founders
- **Blueprint:** [docs/EVENTS_AND_LIFECYCLE.md](../../EVENTS_AND_LIFECYCLE.md) · **Audit:** [docs/EVENTS_AUDIT.md](../../EVENTS_AUDIT.md)

## 1. Architecture overview

Normalize event ingestion into two explicit governance lanes:

1. **Community trusted lane**
   - Producer: `/organizer/events/new` by `COMMUNITY_ADMIN` or `COLLABORATOR`.
   - Behavior: event is publicly visible immediately after create.
   - Authorization: `canEditCommunity(user, communityId)`.

2. **Platform review lane**
   - Producers: `/organizer/host/events/new`, public submit event, ambassador submit event.
   - Behavior: event remains hidden until platform-admin decision.
   - Decision surface: dedicated admin moderation queue and actions.

Primary components touched:

- `apps/web/prisma/schema.prisma`
- `apps/web/src/app/organizer/events/new/actions.ts`
- `apps/web/src/app/organizer/events/page.tsx`
- `apps/web/src/app/organizer/host/events/new/actions.ts`
- `apps/web/src/app/organizer/host/events/page.tsx`
- `apps/web/src/modules/event/queries.ts`
- `apps/web/src/app/admin/(dashboard)/data/events/page.tsx`
- `apps/web/src/app/admin/(dashboard)/actions.ts` or new `admin/(dashboard)/events-review/actions.ts`

## 2. Data model changes

Per ADR-0009, moderation is a first-class axis **orthogonal** to the existing `EventStatus`
lifecycle enum. The enum is intentionally three values (provenance — auto vs reviewed — is
derived from `source` + `ContentLog`, not a separate state).

- New enum `EventModerationState`:
  - `PUBLISHED`
  - `PENDING_REVIEW`
  - `REJECTED`

- New columns on `Event`:
  - `moderationState EventModerationState @default(PUBLISHED)`
  - `reviewedById String?` (FK -> `User.id`)
  - `reviewedAt DateTime?`
  - `reviewReason String?`
  - `createdByUserId String?` (FK -> `User.id`) — first-class accountable creator, mirroring
    `Community.createdByUserId`; replaces `metadata.hostUserId`.

`EventStatus { UPCOMING, ONGOING, PAST, CANCELLED }` is unchanged.

Indexes:

- `@@index([moderationState])`
- `@@index([moderationState, startsAt])`
- `@@index([createdByUserId])`

Backfill strategy (single deterministic migration, dry-run first):

- All existing events -> `moderationState = PUBLISHED` (they are already publicly visible; do not
  retroactively hide live content).
- Copy `metadata.hostUserId` -> `createdByUserId` where present; leave `metadata` intact for one
  release, then drop the key in a follow-up.
- After cutover, **new** host/public/ambassador/pipeline events are created `PENDING_REVIEW`
  (forward behavior), while legacy rows stay `PUBLISHED`.

### 2.1 ER / future-organizer alignment

```
City      1 ──< Event                 (required cityId)
Community 0/1 ──< Event               (nullable communityId; community events)
User      0/1 ──< Event (createdBy)    (nullable createdByUserId; host events)
User      0/1 ──< Event (reviewedBy)   (nullable reviewedById; review record)
```

The single `createdByUserId` is the seed for a future `EventCollaborator` people list (one event
organizer + co-hosts) that would attach to `Event` exactly as `CommunityCollaborator` attaches to
`Community` (ADR-0008). Not built in this TDD; the shape simply must not block it.

## 3. API surface

Public API and server actions stay mostly stable, with moderation behavior updates.

| Method | Path                                    | Auth                                                 | Request             | Response                     |
| ------ | --------------------------------------- | ---------------------------------------------------- | ------------------- | ---------------------------- |
| POST   | organizer community event create action | organizer session + active community edit permission | event fields        | redirect/live event          |
| POST   | organizer host event create action      | event host or platform admin                         | event fields        | pending-review success state |
| POST   | `/admin/events/review/approve`          | `pipeline.approve` or dedicated `events.review`      | `eventId`           | success                      |
| POST   | `/admin/events/review/reject`           | `pipeline.reject` or dedicated `events.review`       | `eventId`, `reason` | success                      |

Query behavior updates:

- All public selectors in `apps/web/src/modules/event/queries.ts` (detail, city feed, search,
  related) must add `moderationState: 'PUBLISHED'` alongside the existing `status != CANCELLED`
  predicate. Organizer/host/admin reads use their own scoped predicates (e.g. host lists filter
  by `createdByUserId = user.id` across all moderation states).
- The host anti-flood cap counts `moderationState = PENDING_REVIEW` (not `status = UPCOMING`).

## 4. Mobile screens & navigation

Web-first implementation; mobile parity is follow-up.

Required web behavior changes:

- Organizer community events pages show truthful publication status (not trust-signal-derived "Pending review").
- Host pages show moderation state chips and clear review messaging.
- Admin gets a first-class event review queue for platform-review lane.

Deferred mobile follow-up:

- Align any mobile event create/manage screens to moderation status semantics.

## 5. Push / Email / Inbox triggers

Add event moderation notifications for host/public lane:

- `HOST_EVENT_REVIEW_APPROVED` (email + inbox)
- `HOST_EVENT_REVIEW_REJECTED` (email + inbox with reason)

Reference update required in:

- `docs/specs/EVENTS/notifications.md`

No notification needed for community trusted lane create beyond existing feed visibility.

## 6. Feature flags

- `event_governance_v1` (default off in first deploy)
- `event_moderation_queue_v1` (can be toggled independently for admin UI)

Kill-switch behavior:

- If disabled, retain current behavior and UI copy.

## 7. Observability

Analytics events to emit:

- `organizer_event_created` with `{ role, communityId, moderationLane: 'COMMUNITY_TRUSTED' }`
- `host_event_submitted_for_review` with `{ cityId, eventId }`
- `platform_event_review_decision` with `{ eventId, decision, source }`
- `host_event_reviewed` with `{ eventId, decision, durationMs }`

Server logs/Sentry tags:

- `surface=events`
- `moderationState`
- `eventSource`

Audit:

- Write `ContentLog` action entries for moderation decisions (`UPDATED`) with metadata `{ moderationDecision, reason }`.

## 8. Failure modes & fallbacks

- Moderation queue unavailable: host submission still accepted but marked pending; retry admin action later.
- Missing reviewer identity in admin action: reject action with explicit auth error.
- Backfill ambiguity for legacy host events: choose one policy and run deterministic migration script with dry-run report.
- Copy drift risk: enforce status-chip rendering from moderation fields only.

## 9. Test plan

### 9.0 Seed data

Update `apps/web/prisma/` seeds so both lanes are represented (PRD-0037 §10.1):

- one community event: claimed community, `moderationState = PUBLISHED`, `source = COMMUNITY_SUBMITTED`;
- one host event: `communityId = null`, `createdByUserId` set, `moderationState = PENDING_REVIEW`,
  `source = USER_SUGGESTED`.

This gives the public feed, organizer/host lists, and admin review queue realistic fixtures and
keeps local/test parity with production governance.

- Unit:
  - moderation-state transition helpers
  - role-to-lane resolver (community trusted vs platform review)
- Integration:
  - organizer/collaborator create -> live visibility
  - host create -> hidden from public queries until approve
  - admin approve/reject transitions + metadata writes
  - admin reject reason persistence
- Contract:
  - any new admin review endpoints and response contracts
- E2E (Playwright web):
  - collaborator creates community event and sees it live
  - host creates event and sees pending status
  - admin approves host event and host/public pages reflect update

## 10. Rollout plan

1. Ship schema + backfill migration behind flags.
2. Update read queries to respect moderation status.
3. Ship organizer/host UI status copy alignment.
4. Ship admin moderation queue and actions.
5. Enable in staged rollout: internal -> 10% -> 50% -> 100%.

## 11. Backout plan

- Disable feature flags to return to pre-moderation behavior.
- Keep new columns (forward-compatible); do not drop in rollback.
- Preserve audit rows and decisions for postmortem and replay.
