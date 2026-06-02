# TDD-0041: Engagement layer - follow, save, recall, and lightweight personalization

- **Status:** Draft
- **Linked BRD:** BRD-0041
- **Owner:** Founder / Product + Eng Lead
- **Created:** 2026-06-02
- **Related:** PRD/TDD-0002, PRD/TDD-0005, PRD/TDD-0006, EVENTS/notifications.md, EVENTS/analytics.md

## 1. Design intent

Build a robust engagement layer by extending existing IndLokal primitives instead of introducing a parallel engagement platform.

The key implementation decision is:

> Treat `SavedCommunity` as the persistence primitive for the **Follow community** UX, and treat `SavedEvent` as the persistence primitive for the **Save event** UX.

This avoids unnecessary schema churn while still allowing a future migration to richer follow models if notification levels, city/category follow, or recommendation experiments require it.

## 2. Current-state assumptions

The current codebase already contains:

- `SavedCommunity` and `SavedEvent` Prisma models.
- Server actions for toggling community/event saves.
- `/me` account surface showing saved communities and saved events.
- `NotificationPreference`, `NotificationOutbox`, `InboxItem`, `Device`, and `QuietHours` models.
- `NotificationTopic` values including `COMMUNITY_UPDATE`, `SAVED_EVENT_REMINDER`, `CITY_NEW_EVENT`, and `WEEKLY_DIGEST`.
- `UserInteraction` model supporting `VIEW`, `CLICK_ACCESS`, `SAVE`, `SHARE`, `REPORT`, and `SEARCH`.
- Community and event modules with detail/list queries.
- Mobile and web surfaces that already use shared contracts and `/api/v1` conventions.

The TDD assumes these are extended in place.

## 3. Architecture overview

```text
User action
  -> Web server action or /api/v1 route
  -> Existing Prisma model write
  -> Optional UserInteraction write
  -> Optional NotificationOutbox enqueue
  -> UI revalidation / client cache invalidation
  -> Later digest/feed scoring consumes saved/followed/interactions
```

### 3.1 Core flows

#### Community follow

```text
Community detail/card
  -> follow/unfollow action
  -> SavedCommunity upsert/delete
  -> UserInteraction SAVE row with entityType=COMMUNITY
  -> optional cache invalidation
  -> future community update notification eligibility
```

#### Event save

```text
Event detail/card
  -> save/unsave action
  -> SavedEvent upsert/delete
  -> UserInteraction SAVE row with entityType=EVENT
  -> schedule/cancel eligible SAVED_EVENT_REMINDER outbox rows
  -> cache invalidation
```

#### Followed-community notification

```text
Event published or materially updated
  -> identify communityId
  -> load users from SavedCommunity where communityId matches
  -> apply notification preferences / caps / quiet hours / score gate
  -> create NotificationOutbox rows with idempotency keys
```

#### Weekly digest

```text
Scheduled digest job
  -> for each eligible user
  -> derive candidate events from city, followed communities, categories, saved-event history
  -> score deterministically
  -> enqueue digest if quality threshold passes
```

## 4. Data model changes

### 4.1 MVP

No required schema change for MVP.

Reuse:

```prisma
model SavedCommunity {
  userId      String
  communityId String
  savedAt     DateTime
}

model SavedEvent {
  userId  String
  eventId String
  savedAt DateTime
}
```

### 4.2 Optional additive fields, only if needed

Do **not** add these unless implementation proves the need.

#### Option A - notification-level metadata

If per-community notification intensity is needed before a full migration:

```prisma
model SavedCommunity {
  userId      String
  communityId String
  savedAt     DateTime
  metadata    Json? // { notificationLevel: "ALL" | "DIGEST_ONLY" | "MUTED" }
}
```

This is not recommended as the first step because the current model has no metadata column and product validation is not complete.

#### Option B - future dedicated follow model

For Phase 2+:

```prisma
enum FollowNotificationLevel {
  ALL
  DIGEST_ONLY
  MUTED
}

enum FollowSource {
  DETAIL
  CARD
  ONBOARDING
  DIGEST
  IMPORT
}

model CommunityFollow {
  userId            String
  communityId       String
  followedAt        DateTime @default(now())
  notificationLevel FollowNotificationLevel @default(ALL)
  source            FollowSource?

  @@id([userId, communityId])
}
```

Migration to this model should only happen if:

- per-community notification controls are required,
- analytics needs source-level persistence beyond event logging,
- or `SavedCommunity` naming becomes a sustained developer confusion.

## 5. Module touchpoints

### 5.1 Web actions

Existing file:

- `apps/web/src/app/actions/saves.ts`

Required changes:

- Keep function names for compatibility if already used.
- Add semantic wrapper exports if helpful:
  - `toggleFollowCommunity(communityId)` -> delegates to existing save logic.
  - `toggleSaveEvent(eventId)` -> existing behavior.
- Add `UserInteraction` writes after successful action.
- For events, call reminder scheduling helper after create and cancellation/suppression helper after delete.

Recommended service split:

```text
apps/web/src/modules/engagement/
  community-follow.ts
  event-save.ts
  interactions.ts
  reminder-scheduler.ts
  digest-scoring.ts
  organizer-metrics.ts
```

Do not move all existing logic at once. Start with small service helpers and gradually refactor actions/routes to call them.

### 5.2 Community module

Existing:

- `apps/web/src/modules/community/queries.ts`

Required changes:

- Add optional current-user follow state to detail query where session is available.
- Add follower count select/aggregation for organizer/admin surfaces.
- Do not add follower count to public cards unless product approves public social proof.

Suggested helper:

```ts
getCommunityEngagementState(userId: string | null, communityId: string): Promise<{
  isFollowing: boolean;
  followerCount?: number; // private/admin/organizer use first
}>;
```

### 5.3 Event module

Required changes:

- Add optional current-user save state to detail query where session is available.
- Add saved count aggregation for organizer metrics.
- Ensure cancelled/past event handling does not schedule invalid reminders.

Suggested helper:

```ts
getEventEngagementState(userId: string | null, eventId: string): Promise<{
  isSaved: boolean;
  saveCount?: number;
}>;
```

### 5.4 Notification module

Existing likely locations:

- `apps/web/src/modules/notifications/outbox.ts`
- `apps/web/src/lib/notifications/preferences.ts`
- notification specs under `docs/specs/EVENTS/notifications.md`

Required helpers:

```ts
enqueueCommunityUpdateForFollowers(args: {
  communityId: string;
  eventId?: string;
  updateId: string;
  title: string;
  body: string;
  deepLink: string;
  scoreAtEnqueue?: number;
}): Promise<{ enqueued: number; suppressed: number }>;
```

```ts
scheduleSavedEventReminders(args: {
  userId: string;
  eventId: string;
  startsAt: Date;
  title: string;
  venueLabel?: string | null;
  deepLink: string;
}): Promise<void>;
```

```ts
cancelOrSuppressSavedEventReminders(args: {
  userId: string;
  eventId: string;
}): Promise<void>;
```

Do not implement a new notification engine. These helpers should use existing outbox write and preference-check behavior.

### 5.5 Discovery/feed module

Add deterministic scoring helper for `This week for you` / digest candidate ordering.

Suggested location:

```text
apps/web/src/modules/discovery/engagement-scoring.ts
```

Input signals:

- user city / metro city IDs,
- followed community IDs,
- saved event categories,
- user persona segments,
- preferred languages,
- community activity/trust scores,
- event startsAt,
- trending flags.

Output:

```ts
type EngagementScoreBreakdown = {
  followedCommunity: number;
  cityMatch: number;
  categoryMatch: number;
  languageMatch: number;
  trending: number;
  quality: number;
  recency: number;
  total: number;
};
```

Keep weights as constants in code:

```ts
const ENGAGEMENT_SCORE_WEIGHTS = {
  followedCommunity: 40,
  savedRelatedCategory: 20,
  cityMatch: 20,
  personaCategoryMatch: 15,
  languageMatch: 10,
  trending: 10,
  quality: 10,
} as const;
```

Do not put weights in the database for MVP.

### 5.6 Organizer metrics

Suggested location:

```text
apps/web/src/modules/organizer/engagement-metrics.ts
```

Metrics:

- follower count by community,
- event save count by upcoming event,
- access-channel click count by channel type,
- profile views over last 7/30 days,
- share count if interaction rows exist.

All metrics should be aggregate-only.

## 6. API surface

### 6.1 Existing or target endpoints

For mobile/API parity, expose or confirm these routes:

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/v1/communities/:slug/follow` | required | Follow community |
| DELETE | `/api/v1/communities/:slug/follow` | required | Unfollow community |
| POST | `/api/v1/events/:slug/save` | required | Save event |
| DELETE | `/api/v1/events/:slug/save` | required | Unsave event |
| GET | `/api/v1/me/engagement` | required | Fetch following, saved events, and preference summary |

If equivalent endpoints already exist, do not duplicate. Update contracts and handlers in place.

### 6.2 Response shapes

Use shared Zod contracts in `packages/shared`.

#### Follow state

```ts
export const FollowStateSchema = z.object({
  communityId: z.string(),
  isFollowing: z.boolean(),
  followedAt: z.string().datetime().nullable().optional(),
});
```

#### Save state

```ts
export const SaveStateSchema = z.object({
  eventId: z.string(),
  isSaved: z.boolean(),
  savedAt: z.string().datetime().nullable().optional(),
  remindersScheduled: z.number().int().min(0).optional(),
});
```

#### Engagement summary

```ts
export const EngagementSummarySchema = z.object({
  followingCommunities: z.array(CommunitySummarySchema),
  savedEvents: z.array(EventSummarySchema),
  notificationPreferences: z.array(NotificationPreferenceSchema).optional(),
});
```

## 7. UI implementation notes

### 7.1 Web community surfaces

- Replace user-facing `Saved Community` copy with `Following` / `Follow`.
- Existing `/me` section should become `Following`.
- Keep route and model names unchanged unless broader refactor is needed.
- Add a compact follow CTA to community detail first.
- Add card-level follow only after detail-level behavior is stable.

### 7.2 Web event surfaces

- Keep `Saved Events` wording.
- Event detail should expose Save, Share, Add to Calendar, Register/Open link.
- Event cards may support compact save if the UI is not crowded.

### 7.3 Mobile surfaces

- Use existing mobile API client and shared contracts.
- Ensure React Query invalidates:
  - community detail after follow/unfollow,
  - discovery lists if follow state appears there,
  - me/bookmarks screen,
  - event detail after save/unsave.

### 7.4 Copy rules

Use these terms consistently:

| Concept | Use | Avoid |
| --- | --- | --- |
| Community intent | Follow / Following | Save community, Join, Member |
| Event intent | Save / Saved | Follow event, RSVP unless actually implemented |
| External handoff | Open WhatsApp / Open website / Register | Message in IndLokal |
| Organizer metrics | Followers on IndLokal | Members |

## 8. Notification design

### 8.1 COMMUNITY_UPDATE

Trigger:

- New event is published for a community.
- Material community profile update happens, e.g. primary access channel changed or verified.

Recipient set:

- Users with `SavedCommunity(userId, communityId)`.

Rules:

- Respect `NotificationPreference(COMMUNITY_UPDATE, channel)`.
- Respect quiet hours for push.
- Respect cap: max 3/day/community unless notification spec changes.
- Use idempotency key:

```text
user:{uid}:community:{cid}:update:{updateId}
```

Deep link:

- Event update -> `/{citySlug}/events/{eventSlug}`
- Community update -> `/{citySlug}/communities/{communitySlug}`

### 8.2 SAVED_EVENT_REMINDER

Trigger:

- User saves upcoming event.
- Reminder windows are still in the future.

Default schedule:

- T-24h if event starts more than 24h from now.
- T-2h if event starts more than 2h from now.

If current implementation uses only one reminder, do not rewrite the system immediately. Add the second reminder in a small, tested change.

Idempotency key:

```text
user:{uid}:event:{eventId}:reminder:{offset}
```

Unsave behavior:

- Prefer marking pending reminder outbox rows as `SUPPRESSED` if direct deletion is not desirable.
- Do not attempt to recall already sent notifications.

### 8.3 WEEKLY_DIGEST

Trigger:

- Scheduled job, e.g. Friday 10:00 user timezone.

Candidate ordering:

1. Upcoming events from followed communities.
2. Upcoming events matching saved-event categories.
3. Upcoming events matching user city/metro.
4. Trending/high-score events.
5. High-priority resources as fallback if event density is low.

Suppress when:

- user has disabled digest channel,
- no valid channel target,
- fewer than configured minimum quality items,
- weekly idempotency key already exists.

## 9. Interaction tracking

Use `UserInteraction` for server-side persistence where useful.

### 9.1 Mapping

| User action | UserInteraction |
| --- | --- |
| community detail view | `VIEW`, `COMMUNITY` |
| event detail view | `VIEW`, `EVENT` |
| follow community | `SAVE`, `COMMUNITY`, metadata `{ semantic: "FOLLOW" }` |
| unfollow community | optional metadata event or analytics-only |
| save event | `SAVE`, `EVENT` |
| tap access channel | `CLICK_ACCESS`, `COMMUNITY`, metadata `{ channelType, channelId }` |
| share event/community | `SHARE`, matching entity type |
| report content | `REPORT`, matching entity type |
| search | `SEARCH`, `RESOURCE` or metadata-only depending current convention |

If `UserInteraction` does not currently distinguish un-save/unfollow, do not contort the enum. Track unfollow/unsave in analytics provider and keep DB interaction as positive-signal history only.

### 9.2 Metadata rules

- Do not store PII.
- Store stable IDs and low-cardinality descriptors.
- Avoid full URLs where not needed.
- Store `sessionId` where available for anonymous conversion analysis.

## 10. Authorization and privacy

- Follow/save requires authenticated user.
- Viewing public counts, if exposed, does not require auth.
- Organizer aggregate metrics require organizer/community authority.
- Admin aggregate metrics require admin/operator authority.
- Never expose individual followers/savers to organizers in MVP.
- Do not infer community membership from follow state.

## 11. Failure modes and fallbacks

| Failure | Behavior |
| --- | --- |
| User not logged in | Return `requiresAuth` or 401; UI prompts sign-in and returns user after auth where possible |
| Duplicate follow/save | Treat as idempotent success |
| Unfollow/unsave missing row | Treat as idempotent success |
| Notification enqueue fails after save/follow succeeds | Keep save/follow success; log enqueue error; retry if outbox path supports it |
| Event starts too soon for reminders | Save succeeds; remindersScheduled = 0 or only valid future windows |
| Invalid channel URL | Do not block follow/save; log/report channel issue separately |
| Digest has too few items | Suppress or fallback to high-confidence city content |
| Analytics provider disabled | Persist critical server-side interactions where already supported; do not fail UX |

## 12. Observability

### 12.1 Logs

Log structured events for:

- follow create/delete failures,
- save create/delete failures,
- notification enqueue counts,
- notification suppression reasons,
- digest generation counts,
- reminder scheduling counts.

### 12.2 Metrics

Minimum metrics:

- follow attempts/success/failure,
- save attempts/success/failure,
- reminder rows scheduled/suppressed,
- community-update notifications enqueued/suppressed,
- digest users eligible/enqueued/suppressed,
- organizer metric query latency if cards are added.

### 12.3 Analytics events

Mirror BRD event list in the analytics catalog before implementation is considered done.

## 13. Testing strategy

### 13.1 Unit tests

- `toggleFollowCommunity` creates and deletes `SavedCommunity`.
- Duplicate follow/unfollow is idempotent if implemented through API routes.
- `toggleSaveEvent` creates and deletes `SavedEvent`.
- Reminder scheduler skips invalid past windows.
- Engagement scoring returns deterministic order and breakdown.
- Digest candidate scoring prioritizes followed-community events.
- Notification eligibility applies preference disabled, quiet hours, caps, and idempotency.

### 13.2 Integration tests

- POST/DELETE follow endpoints with auth.
- POST/DELETE save endpoints with auth.
- `/me` or `/api/v1/me/engagement` returns followed communities and saved events.
- New published community event enqueues `COMMUNITY_UPDATE` for followers.
- Saving event enqueues valid reminders.
- Unsaving event suppresses pending reminders if supported.

### 13.3 UI tests

- Community detail Follow -> Following state.
- Logged-out Follow prompts sign-in.
- `/me` shows `Following`, not `Saved Communities`.
- Event detail Save -> Saved state.
- Saved event appears in account/mobile saved surface.
- Share/register/channel buttons still work after follow/save changes.

### 13.4 Regression tests

- Existing save actions remain backward compatible.
- Existing community/event detail pages render for logged-out users.
- Existing notification preferences screen remains functional.
- Existing mobile discovery feed does not require auth.
- Existing organizer/admin permissions are unchanged.

## 14. Implementation sequence

### Step 1 - copy and semantic alignment

- Rename user-facing community save labels to follow/following.
- Keep database and existing action names if changing them has high blast radius.
- Add semantic wrapper functions only where useful.

### Step 2 - interaction tracking

- Add small helper for `UserInteraction` writes.
- Wire positive actions first: follow, save, channel tap, share.
- Avoid blocking UX on interaction-write failure.

### Step 3 - API/mobile parity

- Confirm follow/save `/api/v1` endpoints.
- Add shared Zod response schemas where missing.
- Ensure mobile can consume follow/save state and mutate it.

### Step 4 - reminder scheduling

- Standardize saved-event reminder scheduling through `NotificationOutbox`.
- Support T-24h and T-2h only if not already too late.
- Add idempotency keys.

### Step 5 - community-update enqueue

- On event publish or event moderation transition to published, identify followers.
- Enqueue `COMMUNITY_UPDATE` rows subject to preference/cap/quiet-hour logic.
- Start with push/inbox; email can remain digest-first if channel adapters are partial.

### Step 6 - weekly digest prioritization

- Implement deterministic candidate scoring.
- Prioritize followed-community events.
- Suppress low-quality digest.
- Add metrics and logs.

### Step 7 - organizer aggregate cards

- Add aggregate read-only metrics to existing organizer dashboard.
- Do not expose user identities.
- Keep cards optional behind a feature flag if needed.

## 15. Feature flags

Recommended flags:

| Flag | Default | Purpose |
| --- | --- | --- |
| `engagement.communityFollow.enabled` | true after staging validation | Enables Follow CTA mutations |
| `engagement.eventReminder.enabled` | true if outbox ready | Enables reminder scheduling on save |
| `engagement.communityUpdate.enabled` | false until enqueue tested | Enables follower notifications |
| `engagement.weeklyDigest.enabled` | false until digest quality validated | Enables digest enqueue |
| `engagement.organizerMetrics.enabled` | false | Enables aggregate organizer cards |

If the existing project avoids runtime feature flags for small changes, use env/config constants or staged deployment instead. Do not introduce a full flagging platform.

## 16. Rollout plan

### Stage 1 - staging

- Verify follow/save UX labels.
- Verify authenticated and logged-out flows.
- Verify DB rows and interaction rows.
- Verify notification outbox idempotency.

### Stage 2 - internal production

- Enable follow/save UX and tracking.
- Keep push notification enqueue disabled if adapters are not fully validated.
- Monitor action failure rates.

### Stage 3 - notification pilot

- Enable saved-event reminders.
- Enable community update notifications for a small city/user cohort if feature flags exist.
- Monitor suppressions, duplicate sends, opt-outs.

### Stage 4 - digest pilot

- Generate digest candidates in dry-run mode.
- Review quality for Stuttgart.
- Enable actual delivery once content quality is acceptable.

### Stage 5 - organizer metrics

- Add aggregate cards to organizer dashboard after action data accumulates.

## 17. Backout plan

- Disable notification enqueue flags first.
- Keep follow/save data intact; these are user-owned preferences.
- Revert copy changes only if user confusion appears.
- If reminder scheduling misbehaves, suppress pending reminders by topic/idempotency pattern.
- If digest quality is low, disable digest enqueue and continue dry-run scoring.
- Additive code should be removable without database rollback because MVP requires no schema migration.

## 18. Security and compliance notes

- All mutation endpoints require authenticated user.
- Server must derive `userId` from session/JWT, never from request body.
- Do not expose follower/saver identities.
- Ensure email unsubscribe and push preferences are respected.
- Avoid PII in push payloads and analytics metadata.
- Aggregate organizer metrics should use counts only.

## 19. Performance considerations

- Add or confirm indexes already exist on composite IDs for `SavedCommunity` and `SavedEvent`.
- For follower notification fan-out, batch users and outbox inserts.
- Do not synchronously send notifications inside the user-facing event publish request if it risks latency; enqueue outbox rows and let worker process delivery.
- For organizer metrics, use bounded time windows and aggregate queries; avoid per-event N+1 queries.
- For digest, process in batches and use idempotency keys.

## 20. Definition of done

- BRD-0041 and TDD-0041 merged.
- Shared contracts updated if API response shapes change.
- User-facing labels standardized: Follow communities, Save events.
- Follow/unfollow works on web and mobile target surfaces.
- Save/unsave works on web and mobile target surfaces.
- `/me` and mobile account/saved surfaces show Following and Saved Events correctly.
- Server-side interaction tracking is wired for core actions.
- Saved-event reminders are scheduled through outbox where enabled.
- Followed-community update enqueue is implemented or explicitly flag-disabled with dry-run logs.
- Weekly digest scoring is implemented or dry-run ready.
- Organizer aggregate metrics are implemented or flagged for Phase 2.
- Unit and integration tests cover follow/save/notification paths.
- No public follower lists or social features are introduced.

## 21. Open engineering questions

1. Which existing API routes already implement follow/save, and which still rely only on server actions?
2. Does the current outbox worker support suppressing pending reminders, or should unsave leave already scheduled rows but mark them suppressed?
3. Are notification frequency caps implemented in code or only documented in the catalog?
4. Should digest generation be a new cron route or part of an existing notification worker?
5. Is PostHog enabled in production, or should server-side `UserInteraction` be considered the launch baseline?
