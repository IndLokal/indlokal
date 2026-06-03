# TDD-0047: Organizer event entry quality and timezone consistency

- **Status:** Implemented
- **Linked PRD:** PRD-0047
- **Owner:** Founders

## 1. Architecture overview

Add a shared timezone utility for event datetime-local parsing/formatting and update organizer-host event write flows to enforce cross-field quality rules and persist richer metadata.

Components touched:

- `apps/web/src/lib/datetime/event-timezone.ts` (new)
- `apps/web/src/components/organizer/event-form-fields.tsx`
- Organizer forms/pages/actions under `app/organizer/(community)/events/**`
- Host forms/pages/actions under `app/organizer/host/events/**`

## 2. Data model changes

No Prisma migration required.

Existing `Event` model fields are used:

- `startsAt`, `endsAt`
- `isOnline`, `onlineLink`, `venueName`, `venueAddress`
- `isRecurring`, `recurrenceRule`
- `categories` via `EventCategory`

## 3. API surface

No external API endpoint changes.

Server action contracts gain new form fields:

- `categorySlugs[]`
- `recurrencePreset` (`none` | `weekly` | `monthly`)

## 4. Mobile screens & navigation

Not in scope (web organizer-host surfaces only).

## 5. Push / Email / Inbox triggers

No notification changes.

## 6. Feature flags

No new feature flag. This is a quality hardening update to existing organizer flows.

## 7. Observability

Validation failures surface via existing action field errors.
No new analytics events in this phase.

## 8. Failure modes & fallbacks

- Invalid datetime-local input -> field validation error.
- Invalid category slug set -> field validation error.
- Unknown city/timezone -> fallback to `Europe/Berlin`.
- Unsupported recurrence preset -> normalized to one-time in create, preserved-safe in edit.

## 9. Test plan

- Unit:
  - timezone conversion helper parse/format deterministic checks.
  - recurrence preset mapping.
- Integration:
  - organizer add/edit rejects online events without link.
  - organizer add/edit rejects offline events without venue details.
  - organizer add/edit persists category relations.
  - organizer add/edit persists recurrence fields.
  - host add/edit parity for the same validations.
- E2E:
  - create weekly categorized event from organizer UI and verify public rendering.

## 10. Rollout plan

1. Ship utility + server action validation changes.
2. Ship form field additions.
3. Verify typecheck and organizer-host smoke paths.

## 11. Backout plan

- Revert action validation blocks and form field sections.
- Keep data already written (`categories`, `isRecurring`, `recurrenceRule`) as backward compatible.
