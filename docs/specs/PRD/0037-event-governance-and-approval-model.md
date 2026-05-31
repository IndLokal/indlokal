# PRD-0037: Event governance and approval model

- **Status:** Implemented
- **Owner:** Founders
- **Reviewers:** PM, Eng Lead, Design
- **Linked:** TDD-0037, ADR-0009, PRD-0017, PRD-0036, COMMUNITY_ORGANIZER_ADMIN_FLOW.md
- **Blueprint:** [docs/EVENTS_AND_LIFECYCLE.md](../../EVENTS_AND_LIFECYCLE.md)
- **Audit:** [docs/EVENTS_AUDIT.md](../../EVENTS_AUDIT.md)

> This PRD is the implementation contract for the events product blueprint. The blueprint
> defines the two axes (moderation vs lifecycle) and governance lanes; this document turns
> them into shippable requirements. Moderation states use the finalized set from ADR-0009:
> `PUBLISHED`, `PENDING_REVIEW`, `REJECTED` (provenance — auto vs reviewed — is derived from
> `source`, not a separate state).

## 1. Problem

Event creation currently uses multiple intake lanes with inconsistent governance and user messaging:

1. Claimed-community organizer workspace (`/organizer/events/new`) creates events directly in `events` (`source=COMMUNITY_SUBMITTED`, `status=UPCOMING`) and they are visible in discovery feeds immediately.
2. Event-host workspace (`/organizer/host/events/new`) also creates directly in `events` (`source=USER_SUGGESTED`, `status=UPCOMING`) even though UI copy says events are reviewed before going live.
3. Public and ambassador event submissions go through `pipeline_items` and require platform-admin review before becoming events.

This creates policy drift:

- "Pending review" badges are shown in organizer and host tables based on trust signals, not an actual event moderation state.
- Event hosts see "reviewed before live" copy, but events are already live by query behavior.
- There is no explicit, product-level source of truth for who approves what.

## 2. Users & JTBD

- **Community admin:** I need my team's events to go live fast without platform bottlenecks.
- **Collaborator:** I need to add events for the active community with clear ownership and auditability.
- **Event host:** I need predictable moderation expectations and a transparent status.
- **Platform admin:** I need one clear queue for non-community event moderation and emergency override powers.

## 3. Success Metrics

- 100% of event create flows assign an explicit moderation lane (`COMMUNITY_TRUSTED` or `PLATFORM_REVIEW`).
- 0 contradictory UX states where a page says "pending review" for events that are already publicly live.
- p50 time-to-live for community workspace events < 2 minutes.
- p50 time-to-decision for platform-reviewed events < 24h.
- New analytics events shipped and monitored:
  - `organizer_event_created`
  - `host_event_submitted_for_review`
  - `host_event_reviewed`
  - `platform_event_review_decision`

## 4. Scope

- Define one explicit event governance policy by actor and source.
- Keep organizer and collaborator event creation enabled for claimed communities.
- Remove platform-admin review dependency for claimed-community workspace events.
- Introduce explicit platform-review lifecycle for event-host and public event submissions.
- Add a dedicated admin review surface for platform-reviewed events (host/public/ambassador).
- Align event status labels and copy across organizer, host, and public surfaces.
- Add audit logging and analytics for event moderation decisions.

### 4.1 Product policy matrix (v1)

| Actor / lane                        | Can create          | Requires community-admin review | Requires platform-admin review before public visibility |
| ----------------------------------- | ------------------- | ------------------------------- | ------------------------------------------------------- |
| Community admin (claimed workspace) | Yes                 | No                              | No                                                      |
| Collaborator (claimed workspace)    | Yes                 | No                              | No                                                      |
| Event host (no community)           | Yes                 | No                              | Yes                                                     |
| Public submit / ambassador submit   | Yes (as submission) | No                              | Yes                                                     |
| Platform admin                      | Yes (override)      | No                              | N/A                                                     |

## 5. Out of Scope

- Ticketing, payments, or RSVP workflow redesign.
- Multi-step editorial workflows beyond pending/approved/rejected.
- Community-owner approval queue for collaborator-created events (future toggle if needed).
- Mobile event creation redesign (web governance baseline first).

## 6. User Stories

- As a community admin, I can publish events immediately for my claimed community.
- As a collaborator, I can publish events for my active community without platform review delays.
- As an event host, I can submit events and clearly see they are pending platform review until approved.
- As a platform admin, I can approve/reject pending host/public events from one review queue.
- As an operator, I can trust status labels because they reflect real moderation state.

## 7. Acceptance Criteria (Gherkin)

```gherkin
Given a COMMUNITY_ADMIN or COLLABORATOR creates an event from /organizer/events/new
When the create action succeeds
Then the event is visible in city event discovery immediately
And the event moderation lane is COMMUNITY_TRUSTED
And no platform-admin approval is required.
```

```gherkin
Given an EVENT_HOST submits a new event from /organizer/host/events/new
When the create action succeeds
Then the event is stored as pending platform review
And the event is not publicly visible until approved by platform admin.
```

```gherkin
Given a platform admin opens the event review queue
When they approve a pending host/public event
Then the event becomes publicly visible
And review metadata (reviewedAt, reviewedBy, decision) is stored
And host-facing status updates to approved/live.
```

```gherkin
Given a platform admin rejects a pending host/public event
When the decision is saved with a reason
Then the event remains hidden from public discovery
And host-facing status updates to rejected with actionable feedback.
```

```gherkin
Given an organizer opens community events list
When viewing event status chips
Then labels use publication truth (Live, Cancelled, Past)
And never imply platform review where no platform review exists.
```

## 8. UX

Screens in scope:

- `/organizer/events` and `/organizer/events/new`
- `/organizer/host/events` and `/organizer/host/events/new`
- New admin event moderation queue page
- Existing admin data events page (status/edit/delete) as secondary control surface

UX requirements:

- Claimed-community workspace copy must say events are published directly.
- Host flow copy must reflect true moderation state and expected SLA.
- Status chips must derive from moderation state + lifecycle state, not trust-signal presence.
- Empty states must guide the next action (publish, wait for review, or fix rejected event).
- Rejection reason visibility for host/public submitters must be explicit.

## 9. Risks & Open Questions

Risks:

- Introducing moderation state may require careful backfill for existing host events.
- Mixing old trust-signal semantics with new moderation semantics can create temporary UI ambiguity.

Open questions:

- Should community admins optionally require approval for collaborator-created events in regulated communities?
- Should platform review SLA be hard-coded (for example 24h) or configurable per city/ops load?
- Should approved host events get an automatic trust signal, or is moderation state enough?

## 10. Data & future-organizer alignment

This PRD aligns the event data model to the blueprint without building future features early
(see ADR-0009 for the decision record). Two MVP-level requirements have product impact:

- **Accountable creator is first-class.** Every human-created event records the person behind
  it (`Event.createdByUserId`), replacing the host id stored in free-form metadata. This powers
  the "Hosted by…" attribution and is the anchor for future event organizers.
- **Moderation and lifecycle are separate fields.** Status chips must read moderation state
  (`PUBLISHED` / `PENDING_REVIEW` / `REJECTED`) and lifecycle (`UPCOMING` / `ONGOING` / `PAST` /
  `CANCELLED`) independently — never trust-signal presence.

**Forward compatibility (not in this PRD's build scope):** the model is shaped so a future
event-organizer authority — one event organizer plus optional co-hosts — can attach to an event
as a people list, reusing the community organizer/collaborator pattern (ADR-0008). MVP keeps the
single creator as the implicit organizer; no schema reshape is needed to add co-hosts later.

### 10.1 Seed expectations

Seeds must exercise both lanes so local/test parity matches production governance:

- at least one **community event** in `PUBLISHED` state attached to a claimed community, and
- at least one **host event** in `PENDING_REVIEW` state with a `createdByUserId` set,

so the public feed, the organizer/host lists, and the admin review queue all have realistic data.
