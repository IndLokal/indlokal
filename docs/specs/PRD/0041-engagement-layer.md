# PRD-0041: Engagement layer

- **Status:** Draft
- **Owner:** Founder / Product
- **Reviewers:** PM, Eng Lead, Design
- **Linked:** TDD-0041, PRD/TDD-0002, PRD/TDD-0005, PRD/TDD-0006, [notifications.md](../EVENTS/notifications.md), [analytics.md](../EVENTS/analytics.md)
- **Created:** 2026-06-02

## 1. Problem

IndLokal has strong city-first discovery, but discovery alone does not create recall. A member
can find a community or event once, leave through WhatsApp/Telegram/register links, and never
come back. Organizers also need light proof that their listings are creating interest.

The product needs a lean engagement loop that lets members follow communities, save events,
receive useful reminders/digests, and see more relevant local activity without turning IndLokal
into a social network, RSVP platform, or messaging product.

## 2. Users & JTBD

- **Member** - "When I find a useful community or event, I want to keep it easy to find and get
  timely updates without noise."
- **Organizer** - "When I maintain a listing, I want aggregate signals that people are finding
  and acting on it."
- **Operator / ambassador** - "When supply quality changes, I want engagement signals that help
  prioritize what to improve."

## 3. Success Metrics

- Community follow rate from detail views >= 15%.
- Event save rate from detail views >= 12%.
- Account users with at least one follow or saved event >= 35%.
- Return session within 7 days after follow/save >= 20%.
- Weekly digest open/click baseline established in the first 4 weeks.
- Claimed communities with traffic show at least one aggregate engagement signal.

## 4. Scope

- **Community follow** - user-facing community save language becomes `Follow` / `Following`,
  backed by the existing `SavedCommunity` model. Follow/unfollow is available on community
  detail and, where layout allows, community cards. Following appears in `/me` and mobile saved
  surfaces.
- **Event save** - existing `SavedEvent` remains the persistence model. Events keep `Save` /
  `Saved` wording, appear in account/mobile saved surfaces, and expose calendar/share/register
  actions where already supported.
- **Notification linkage** - followed-community new events can enqueue `COMMUNITY_UPDATE`;
  saved upcoming events can enqueue reminder notifications; weekly digest prioritizes followed
  communities, saved-event categories, city, and high-quality upcoming events.
- **Lightweight personalization** - deterministic ranking uses existing user profile fields,
  community/event metadata, saved/followed state, and `UserInteraction` rows. No ML or separate
  recommendation service for MVP.
- **Organizer value signals** - existing organizer/admin surfaces may show aggregate follower,
  event-save, profile-view, and channel-click counts. No individual follower/saver identity is
  exposed.
- **Analytics** - track follow/save/unsave/unfollow, detail views, access-channel taps,
  calendar/share/register taps, digest clicks where the channel supports it, and notification
  suppression reasons where useful.

## 5. Out of Scope

- In-app chat, comments, public profiles, friend/follower graph, or public follower lists.
- RSVP attendee lists, ticketing, payments, or "Going" flows.
- Organizer CRM, campaigns, or individual user export.
- Dedicated engagement microservice, new notification platform, or analytics warehouse.
- Follow city/category as explicit persistence models.
- Complex recommendation ML or database-configured scoring weights.

## 6. User Stories

- As a Member I can follow a community so updates from it are easier to recall.
- As a Member I can save an event so I can find it later and receive eligible reminders.
- As a Member I can see followed communities and saved events in my account.
- As a Member I can receive a weekly digest that emphasizes my city and communities I follow.
- As an Organizer I can see aggregate engagement signals without seeing private user identities.

## 7. Acceptance Criteria (Gherkin)

```
Given I am a signed-in Member
When I follow a community
Then a SavedCommunity row is created
And the UI displays Following
And the community appears in my Following list
```

```
Given I am signed out
When I tap Follow or Save
Then I am prompted to sign in
And I return to the original community or event where possible
```

```
Given a followed community publishes a new event
When notification enqueue runs
Then eligible followers receive a COMMUNITY_UPDATE outbox row subject to preferences, caps,
quiet hours, score gates, and idempotency
```

```
Given I save an upcoming event
When reminder windows are still valid
Then SavedEvent is persisted
And eligible SAVED_EVENT_REMINDER rows are scheduled through the existing outbox path
```

```
Given a weekly digest is generated
When I follow communities or have saved related events
Then those signals rank above generic city matches unless quality or timing rules suppress them
```

```
Given an organizer views their workspace
When their community has engagement data
Then they see aggregate counts only
And no individual follower or saver identities are exposed
```

## 8. UX

- Community CTAs use `Follow` and `Following`; avoid `Save community`, `Join`, or `Member`
  unless actual community membership is implemented.
- Event CTAs use `Save` and `Saved`; avoid `RSVP` unless an RSVP workflow exists.
- `/me` and mobile saved/bookmark surfaces show communities as `Following` and events as
  `Saved Events`.
- Community detail gets the primary follow behavior first. Card-level follow is added only if
  it does not crowd the existing card layout.
- Notification copy should be activity-led: new event from a followed community, reminder for a
  saved event, or digest sections such as `This weekend in {city}`.
- Empty or low-quality weekly digests should be suppressed or fall back to high-confidence city
  content.

## 9. Risks & Open Questions

- **Notification fatigue:** respect existing preferences, quiet hours, caps, unsubscribe rules,
  and digest suppression.
- **Terminology drift:** standardize community intent as follow and event intent as save.
- **Premature schema churn:** keep `SavedCommunity` and `SavedEvent` for MVP; revisit
  `CommunityFollow` only when per-community notification controls are required.
- **Organizer misunderstanding:** label metrics as `Followers on IndLokal`, not `Members`.
- **Digest density:** define the minimum item threshold during implementation.
- **Analytics sink:** confirm whether launch reporting uses the analytics provider,
  `UserInteraction`, or both.
