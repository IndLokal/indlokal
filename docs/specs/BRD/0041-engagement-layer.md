# BRD-0041: Engagement layer - follow, save, recall, and lightweight personalization

- **Status:** Draft
- **Owner:** Founder / Product
- **Reviewers:** PM, Eng Lead, Design
- **Linked:** TDD-0041, PRD/TDD-0002, PRD/TDD-0005, PRD/TDD-0006, EVENTS/notifications.md, EVENTS/analytics.md
- **Created:** 2026-06-02

## 1. Executive summary

IndLokal needs a simple but robust engagement layer that turns one-time discovery into repeat usage without becoming a social network, messaging product, or heavy RSVP platform.

The engagement layer will standardize three user intents:

1. **Follow a community** - keep me updated when this community becomes active.
2. **Save an event** - remind me and help me act later.
3. **Personalize my city/category feed** - show what is most relevant this week.

The implementation should reuse the existing codebase and data model wherever possible:

- `SavedCommunity` becomes the product primitive behind the **Follow** UX.
- `SavedEvent` remains the primitive behind **Save event**.
- `NotificationPreference`, `NotificationOutbox`, `InboxItem`, `Device`, and `QuietHours` remain the notification foundation.
- `UserInteraction` remains the behavioral signal table for analytics and future scoring.
- Existing community, event, discovery, notification, and save modules should be extended, not replaced.

This is intentionally an **engagement layer**, not a social layer.

## 2. Business problem

IndLokal currently has a strong discovery proposition: city-first communities, events, and resources for the Indian diaspora in Germany. However, discovery alone does not guarantee repeat usage.

Users may find a community once, tap a WhatsApp link, and never return. Organizers may not see enough feedback to keep their listings updated. The product therefore needs a lightweight loop that brings users back when relevant local activity changes.

The business problem is:

> How do we convert public discovery traffic into recurring, consent-based engagement while keeping the MVP lean and aligned with the existing architecture?

## 3. Product goals

### 3.1 Primary goals

- Increase repeat visits by giving users useful updates from communities and events they already showed intent toward.
- Make community following feel meaningful through event alerts, weekly digest inclusion, and a visible following list.
- Make event saving feel actionable through reminders, calendar/share actions, and saved-event surfaces.
- Improve feed relevance using explicit preferences and lightweight interaction signals.
- Give organizers basic proof of value through follower and event-save signals, without building a full CRM or social dashboard.

### 3.2 Non-goals

The engagement layer will **not** implement:

- in-app chat,
- comments,
- public user profiles,
- friend/follower social graph,
- public follower lists,
- full RSVP attendee lists,
- ticketing or payments,
- complex recommendation ML,
- a separate engagement microservice,
- a new notification platform,
- a new analytics warehouse.

## 4. Product principles

1. **Activity-led, not directory-led**  
   Engagement should point users to what is happening now or soon.

2. **Follow means recall**  
   Following a community means: notify me when this community posts relevant activity. It does not mean joining a social graph.

3. **Save means intent**  
   Saving an event means: I may attend, remind me, and keep it easy to find.

4. **Consent before noise**  
   Push/email engagement must respect topic preferences, quiet hours, caps, and unsubscribe expectations.

5. **Reuse first**  
   Existing `SavedCommunity`, `SavedEvent`, notification, and interaction models should be reused for MVP.

6. **Additive architecture**  
   Any new fields or APIs should be backward-compatible and small enough to roll back safely.

## 5. Target users and jobs-to-be-done

| Persona | Job-to-be-done | Engagement need |
| --- | --- | --- |
| Newcomer | Find real communities and know what to join | Follow city/category and suggested communities |
| Settled explorer | Discover events they are missing | Weekly digest and followed-community alerts |
| Family user | Plan weekend/community activities | Saved event reminders and family-relevant feed |
| Student/professional | Find relevant groups/events without noise | Category/language preference-based ranking |
| Community organizer | Get visibility and understand interest | Follower count, channel clicks, event saves |
| City ambassador / operator | Improve data quality and supply freshness | Interaction signals and engagement diagnostics |

## 6. Scope

### 6.1 MVP scope

#### A. Community follow

- Rename user-facing **Saved Community** language to **Following** / **Follow**.
- Use existing `SavedCommunity` as the persistence model.
- Add or complete one-tap follow/unfollow on:
  - community detail,
  - community cards where technically practical,
  - mobile community detail if not already complete.
- Show followed communities under `/me` and mobile `Me` / saved surface as **Following**.
- Track analytics events:
  - `community.followed`,
  - `community.unfollowed`,
  - `community.follow_cta.viewed` where useful.

#### B. Event save

- Keep **Save** wording for events.
- Use existing `SavedEvent` as persistence.
- Ensure saved events are visible in `/me` and mobile saved/bookmarks surfaces.
- Trigger reminder scheduling through the existing notification outbox path where available.
- Track analytics events:
  - `event.saved`,
  - `event.unsaved`,
  - `event.calendar.tapped`,
  - `event.share.tapped`,
  - `event.registration.tapped`.

#### C. Notification linkage

- Followed community + new published event should enqueue `COMMUNITY_UPDATE` where caps and preferences allow.
- Saved event should enqueue reminder notifications where the event start time supports reminder windows.
- Weekly digest should prefer followed communities, saved-event categories, city preference, and high-scoring upcoming events.
- Use existing `NotificationPreference`, `NotificationOutbox`, `InboxItem`, `QuietHours`, and `Device` models.

#### D. Lightweight personalization

- Use existing user profile fields:
  - `cityId`,
  - `personaSegments`,
  - `preferredLanguages`,
  - `onboardingComplete`.
- Use existing community and event metadata:
  - city,
  - categories,
  - languages,
  - activity/trust/completeness score,
  - trending flag,
  - upcoming event count.
- Use existing `UserInteraction` rows for future scoring and reporting.
- Do not introduce ML for MVP.

#### E. Organizer value signals

- Add minimal organizer-facing metrics where existing surfaces already exist:
  - follower count,
  - upcoming event saves,
  - access channel clicks,
  - profile views.
- These can be shown as read-only cards. No campaign CRM in this BRD.

### 6.2 Phase 2 scope

- Notification intensity per followed community: `ALL`, `DIGEST_ONLY`, `MUTED`.
- Follow city and follow category as explicit persistence models if existing notification preferences are insufficient.
- Feed scoring service using explicit weights and user interaction signals.
- Organizer trend cards: follower growth, channel CTR, event-save trend.
- Push/email copy localization.

### 6.3 Phase 3 scope

- Lightweight `Interested` / `Going` event intent, only if event density and organizer demand justify it.
- Recommendation scoring experiments.
- Public aggregate social proof such as follower count badges, only after data density is high enough.

## 7. Out of scope for this implementation

- New social graph.
- Public member lists.
- In-app messaging.
- Event comments.
- Payment/ticketing.
- Complex RSVP workflows.
- New user-generated feed posts.
- Replacing WhatsApp/Telegram community channels.
- Overhauling the existing schema names before product validation.

## 8. User experience requirements

### 8.1 Community detail

Primary CTA:

- Default: `Follow`
- Active: `Following`
- Secondary actions: `Share`, `Report`, access channel buttons

Expected behavior:

```text
Given I am logged in
When I tap Follow on a community
Then the button changes to Following
And the community appears under Following in my account
And future new-event alerts from that community are eligible for notification delivery.
```

For logged-out users:

```text
Given I am logged out
When I tap Follow
Then I am prompted to sign in
And after sign-in I should return to the original community where possible.
```

### 8.2 Community card

Where layout allows, community cards should expose a compact follow action.

Do not make the card visually noisy. If card-level follow creates layout or performance risk, ship detail-page follow first and add card follow in Phase 1.1.

### 8.3 Event detail

Primary action cluster:

- `Save`
- `Add to Calendar`
- `Register / Open link`
- `Share`

Expected behavior:

```text
Given I save an upcoming event
When the save succeeds
Then it appears in my saved events
And reminder notifications are scheduled where reminder windows are still valid.
```

### 8.4 Me / account surface

Rename:

- `Saved Communities` -> `Following`
- `Saved Events` remains `Saved Events`

The account surface should become the user's recall hub, not just a profile page.

### 8.5 Weekly digest

Digest should be framed as:

- `This weekend in {city}`
- `New from communities you follow`
- `Popular near you`

Digest should avoid sending empty or low-quality content. If fewer than a configurable minimum number of relevant items exist, suppress or fallback to city-level high-confidence events/resources.

## 9. Business rules

### 9.1 Follow community

- A user can follow a community once.
- Follow is private to the user in MVP.
- Following does not imply community membership.
- Following does not add the user to WhatsApp/Telegram.
- Following does not expose the user to the community organizer.
- Unfollowing stops future community-update eligibility, subject to existing already-enqueued notification behavior.

### 9.2 Save event

- A user can save an event once.
- Saving an event does not register the user with the event host.
- Saving an event can schedule reminders.
- Unsaving an event should suppress or cancel pending reminders where technically feasible.

### 9.3 Notification eligibility

A notification can be sent only when all of the following are true:

- user has a valid channel target for the channel,
- user preference for the topic/channel is enabled,
- quiet hours and frequency caps allow delivery or defer it,
- notification score gate passes where the topic requires scoring,
- idempotency key has not already been used.

### 9.4 Personalization

For MVP, personalization should be deterministic and explainable. Use simple weighted ranking, not black-box recommendations.

Recommended starting weights:

| Signal | Suggested weight |
| --- | ---: |
| Followed community event | +40 |
| Saved related event/category | +20 |
| User city / metro match | +20 |
| Persona/category match | +15 |
| Preferred language match | +10 |
| Trending community/event | +10 |
| High trust/activity score | +10 |
| Stale/cancelled/low-trust signal | negative / exclude |

Weights are product defaults and should remain configurable in code/constants, not database-driven, until experimentation justifies admin configuration.

## 10. Success metrics

### 10.1 Activation

| Metric | Target |
| --- | ---: |
| Community follow rate from detail views | >= 15% |
| Event save rate from detail views | >= 12% |
| Push permission opt-in after engagement prompt | >= 50% |
| Account users with at least one follow or save | >= 35% |

### 10.2 Retention

| Metric | Target |
| --- | ---: |
| Weekly digest open / click-through | establish baseline first 4 weeks |
| Return session within 7 days after follow/save | >= 20% |
| D30 retained users with follow/save | 2x users without follow/save |

### 10.3 Supply-side value

| Metric | Target |
| --- | ---: |
| Organizer sees at least one measurable engagement signal | yes for claimed communities with traffic |
| Access channel tap-through from community detail | >= 30% |
| Share rate on event detail | >= 5% |

## 11. Analytics and reporting requirements

Track via existing analytics/event catalog and `UserInteraction` where server-side persistence is useful.

Minimum events:

| Event | Purpose |
| --- | --- |
| `community.detail.viewed` | denominator for follow rate |
| `community.followed` | core conversion |
| `community.unfollowed` | churn / notification fatigue |
| `community.channel.tapped` | handoff to WhatsApp/Telegram/website |
| `event.detail.viewed` | denominator for save/register/share |
| `event.saved` | intent signal |
| `event.unsaved` | cancellation signal |
| `event.registration.tapped` | high-intent conversion |
| `event.calendar.tapped` | planning intent |
| `event.share.tapped` | growth loop |
| `digest.opened` / `digest.clicked` | recall loop health, if channel supports it |
| `notification.suppressed` | preference/cap/quality debugging |

## 12. Compliance and privacy requirements

- Follow and save are private user actions.
- No public follower lists in MVP.
- Do not expose individual user identities to organizers from follow/save data.
- Notification preferences must be user-editable.
- Email must support unsubscribe requirements.
- Push payloads should not include sensitive personal data.
- Analytics should avoid storing unnecessary PII in metadata.

## 13. Dependencies

- Existing auth/session flow.
- Existing web/mobile profile and saved surfaces.
- Existing notification outbox and preference models.
- Existing community/event queries.
- Existing save actions/API routes.
- Existing PostHog or analytics abstraction where enabled.
- Existing content registry/copy conventions if user-facing strings are centralized.

## 14. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Notification fatigue | Use caps, quiet hours, digest-first fallback, and simple notification controls |
| Over-engineering follow models too early | Reuse `SavedCommunity`; add dedicated `CommunityFollow` only when notification levels need it |
| Under-engineering future personalization | Persist interaction signals now; keep deterministic scoring extensible |
| Organizer misinterprets follows as members | UX copy: `Followers on IndLokal`, not `Members` |
| Low content density creates weak digest | Suppress low-quality digests or fallback to city-level top content |
| Duplicate notification sends | Enforce idempotency keys in outbox |
| Confusing save/follow language | Standardize: communities are followed, events are saved |

## 15. Rollout approach

### Phase 0 - terminology and UX alignment

- Rename saved community UI to following/follow.
- Ensure `/me` and mobile saved surfaces use consistent labels.
- Confirm analytics event naming.

### Phase 1 - engagement actions and recall

- Complete follow/unfollow and save/unsave behavior across key surfaces.
- Wire notification eligibility for followed-community new events.
- Wire saved-event reminders consistently.
- Add weekly digest prioritization logic.

### Phase 2 - lightweight personalization

- Add deterministic ranking for `This week for you`.
- Use followed communities, saved events, city, categories, languages, and activity/trust scores.

### Phase 3 - organizer feedback

- Add minimal read-only engagement cards to organizer surfaces.
- Use aggregate-only metrics.

## 16. Acceptance criteria

```text
Given a logged-in user follows a community
When the follow succeeds
Then the community is persisted in SavedCommunity
And the UI displays Following
And the community appears in the user's Following list.
```

```text
Given a followed community publishes a new event
When notification enqueue runs
Then eligible followers receive a COMMUNITY_UPDATE outbox row subject to preferences, caps, quiet hours, and score gates.
```

```text
Given a logged-in user saves an upcoming event
When the save succeeds
Then the event is persisted in SavedEvent
And eligible reminders are scheduled through NotificationOutbox.
```

```text
Given a user has followed communities and city preferences
When the weekly digest is generated
Then followed-community events are prioritized above generic city events unless quality or timing rules suppress them.
```

```text
Given an organizer views their workspace
When their community has engagement data
Then they can see aggregate follower, event-save, channel-click, and profile-view metrics without seeing individual user identities.
```

## 17. Open questions

1. Should `SavedCommunity` remain the long-term model name, or should a future migration introduce `CommunityFollow` after the UX proves useful?
2. Should follow city/category be represented via notification preferences first, or as explicit follow tables later?
3. What minimum content threshold should suppress the weekly digest?
4. Should organizer engagement metrics be added to the existing organizer dashboard or introduced as a separate analytics section?
5. Which analytics provider is considered production-ready for launch: PostHog, server-side `UserInteraction`, or both?
