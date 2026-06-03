# PRD-0047: Organizer event entry quality and timezone consistency

- **Status:** Implemented
- **Owner:** Founders
- **Reviewers:** PM, Eng Lead, Design
- **Linked:** TDD-0047, PRD/TDD-0037, ADR-0009

## 1. Problem

Organizer event creation/edit flows currently allow structurally incomplete entries and timezone-ambiguous scheduling:

1. `datetime-local` values are parsed server-side without explicit city timezone semantics.
2. Online/offline fields are loosely captured without strict cross-field rules.
3. Category metadata is not captured at entry time despite category-driven discovery.
4. Recurrence data exists in the model but is not exposed in organizer forms.

This causes lower discovery quality, inconsistent user expectations, and avoidable moderation/admin cleanup.

## 2. Users & JTBD

- **Community admin / collaborator:** I need event entry fields that are clear and enforce minimum listing quality.
- **Event host:** I need event submission to capture the right details on first attempt and avoid rejection for missing basics.
- **Platform admin:** I need incoming events to be complete enough for quick review and publish decisions.
- **Users browsing events:** I need reliable date/time, location mode, category, and recurrence signals.

## 3. Success Metrics

- 100% of organizer/host event writes parse schedule from explicit city timezone semantics.
- 0 online events saved without `onlineLink`.
- 0 offline events saved without minimum venue details.
- > = 95% new events have at least one category.
- Recurrence usage measurable on organizer-created events (`isRecurring=true` when selected).

## 4. Scope

- Add timezone-safe parsing for organizer and host event create/edit server actions.
- Enforce cross-field validation:
  - online -> require `onlineLink`
  - offline -> require `venueName` and `venueAddress`
- Add category selection to organizer and host event forms.
- Persist event categories on create and update.
- Add recurrence selection (`none`, `weekly`, `monthly`) to organizer and host event forms.
- Persist recurrence fields (`isRecurring`, `recurrenceRule`) on create and update.
- Keep host edit city immutable contract clean by removing unused `cityId` parsing from action schema.

## 5. Out of Scope

- Advanced RRULE editing UI beyond weekly/monthly presets.
- Event map/geocoding capture (latitude/longitude).
- Ticket pricing model changes.
- Mobile event-create parity changes (web organizer scope only).

## 6. User Stories

- As an organizer, I want date/time interpreted for my event city so public schedules are accurate.
- As an organizer, I want required location details based on online/offline mode.
- As an organizer, I want to tag event categories so discovery filters work well.
- As an organizer, I want a simple recurrence picker for weekly/monthly events.

## 7. Acceptance Criteria (Gherkin)

```gherkin
Given an organizer submits an event with city-specific start/end datetime-local values
When the server validates and writes the event
Then stored startsAt/endsAt reflect the event city timezone semantics
And do not depend on runtime/server timezone.
```

```gherkin
Given an organizer submits an online event without an online link
When validation runs
Then the request is rejected with an actionable field error.
```

```gherkin
Given an organizer submits an offline event without venue name or venue address
When validation runs
Then the request is rejected with actionable field errors.
```

```gherkin
Given an organizer submits or edits an event with selected categories
When the write succeeds
Then event-category relations are created or replaced to match selections.
```

```gherkin
Given an organizer sets recurrence to weekly or monthly
When the write succeeds
Then isRecurring is true
And recurrenceRule is persisted to the matching RRULE preset.
```

## 8. UX

Screens in scope:

- `/organizer/events/new`
- `/organizer/events/[slug]/edit`
- `/organizer/host/events/new`
- `/organizer/host/events/[slug]/edit`

UX requirements:

- Categories shown as a multi-select checklist with clear helper copy.
- Recurrence shown as a simple select: one-time, weekly, monthly.
- Online/offline requirement hints shown inline.
- Validation messages remain field-level and actionable.

## 9. Risks & Open Questions

Risks:

- City-timezone conversion around DST boundaries needs deterministic conversion logic.
- Requiring venue details may initially increase organizer validation failures.

Open questions:

- Do we later require minimum one category at DB-level constraint or keep app-level validation?
- Should recurrence presets expose additional frequencies (biweekly/custom) in v2?
