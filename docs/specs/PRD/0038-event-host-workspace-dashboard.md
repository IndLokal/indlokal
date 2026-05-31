# PRD-0038: Event host workspace dashboard

- **Status:** Shipped
- **Owner:** Product
- **Reviewers:** PM, Eng Lead, Design
- **Linked:** TDD-0038, ADR-0009, PRD-0037, [HOST_DASHBOARD.md](../../HOST_DASHBOARD.md)

## 1. Problem

A community organizer who signs in lands on a rich workspace (stats-aware overview,
quick-action cards, profile-completeness meter, channels panel, team panel, public-page
link). An independent **event host** who signs in lands on two cards and a warning banner.
Both roles run the same content — events — through the same review machinery, but the host
gets a stub. A host cannot see how many of their events are live, in review, or declined;
cannot read why an event was declined; and cannot edit the "Hosted by…" profile without
re-running sign-up. The result is host churn.

The product owner blueprint for the fix is [HOST_DASHBOARD.md](../../HOST_DASHBOARD.md).
This PRD turns that blueprint into a buildable scope.

## 2. Users & JTBD

- **Event host** (`EVENT_HOST`) — "When I sign in, I want to see the state of all my events
  and act on them, so I keep my IndLokal presence alive without guessing."
- **Platform admin** (impersonating / supporting) — lands in the same workspace.

## 3. Success Metrics

- `host_profile_updated` fired when a host edits their profile (new event).
- Reuse of `host_event_submitted_for_review` (PRD-0037) from the workspace.
- Qualitative: host overview renders accurate live / in-review / declined / past counts
  with zero dependence on `trustSignals` or `metadata.hostUserId`.

## 4. Scope

- **Overview revamp** (`/organizer/host`): "my events at a glance" stat tiles (live, in
  review, declined, past), review-standing/cap callout, next-up event, needs-attention
  (declined events + reason), quick-action cards (post / events / profile), profile-
  completeness meter, public-presence link. Mirrors the organizer overview rhythm.
- **Profile surface** (`/organizer/host/profile`): editable display name, home city, and
  links — maintainable without re-running sign-up; writes `User.metadata.hostProfile` and
  syncs `User.displayName` / `User.cityId`.
- **Host workspace helper**: one server module computing the overview signals from
  `moderationState` + lifecycle + first-class `createdByUserId`, plus completeness.
- **Status truthfulness**: all counts/badges derived from the event moderation + lifecycle
  axes ([EVENTS_AND_LIFECYCLE.md](../../EVENTS_AND_LIFECYCLE.md) §5), retiring the
  `metadata.hostUserId` + `trustSignals` heuristics in the dashboard.
- **Nav**: add "Profile" to the host portal nav.
- **Seed**: enrich the demo host with links and a past + declined event so the workspace is
  exercisable out of the box.

## 5. Out of Scope

- Event co-hosts / per-event people lists (deferred — [EVENTS_AND_LIFECYCLE.md](../../EVENTS_AND_LIFECYCLE.md) §8.2).
- A separate host entity/table; logo/avatar; a public host page.
- Changing the host review lane, the cap value, or moderation axes (owned by PRD-0037).
- Ticketing / RSVP / attendee management.

## 6. User Stories

- As a host I want to see how many of my events are live, in review, declined, and past so
  I know the state of my presence.
- As a host I want to see why an event was declined so I can fix and resubmit.
- As a host I want to edit my display name, city, and links without re-running sign-up.
- As a host I want a completeness nudge so my "Hosted by…" block is credible.

## 7. Acceptance Criteria (Gherkin)

```
Given I am signed in as an EVENT_HOST with published, pending, and rejected events
When I open /organizer/host
Then I see accurate live / in-review / declined / past counts derived from moderationState
And I see my nearest upcoming event
And declined events appear under "Needs attention" with their review reason

Given I am at the un-reviewed cap
When I open the overview
Then the "Post an event" action is disabled and the cap is explained

Given I am a host on /organizer/host/profile
When I change my display name and links and save
Then User.metadata.hostProfile is updated, User.displayName is synced
And a host_profile_updated analytics event is fired
And the completeness meter reflects the new state
```

## 8. UX

- Reuses `OrganizerPageHeader`, `card-base`, and the completeness-meter idiom from the
  organizer dashboard. Stat tiles use the same card rhythm. Empty state: zero events shows a
  friendly "post your first event" nudge. Status badges reuse `EventModerationChip`.

## 9. Risks & Open Questions

- Reading host events by `createdByUserId` assumes the PRD-0037 backfill ran (it did:
  migration `20260531120000_event_moderation_axis`). Legacy rows with only
  `metadata.hostUserId` are out of scope and were backfilled.
- City change on the profile only affects future attribution, not past events' city.
