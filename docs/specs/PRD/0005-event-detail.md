# PRD-0005: Event detail (save, register, calendar, share)

- **Status:** Draft
- **Owner:** PM
- **Reviewers:** Mobile lead, Design

## 1. Problem

Mirror web `/[city]/events/[slug]` on mobile so users can act on an event in seconds.

## 2. Users & JTBD

- "Decide if I want to go, save it, get a reminder, register, share with family."

## 3. Success Metrics

- Save rate ≥ 12 % of detail views.
- Add-to-Calendar tap rate ≥ 8 %.
- Share rate ≥ 5 %.

## 4. Scope

- Hero image, title, host community link, date/time/venue, cost, description.
- Actions: **Save**, **Add to Calendar**, **Register / Open link**, **Share**, **Report**.
- Map preview if lat/long present (deep link to native maps).
- Related events (same community / category).
- Saving auto-schedules T-24h and T-2h reminders (TDD-0002).

## 5. Out of Scope

- In-app ticketing/payments (Phase 3).
- Comments / RSVP list.

## 6. User Stories

- As a user I tap Save and get reminded the day before.
- As a user I share to WhatsApp; the recipient opens it in the app via Universal Link.

## 7. Acceptance Criteria

```
Given a logged-in user taps Save
When the save succeeds
Then the icon updates, two reminder rows are scheduled in the outbox, and the pre-prompt for push fires if not yet handled
```

## 8. UX

Sticky action bar on scroll. Offline cached event renders with a small "Offline" chip.

## 9. Risks & Open Questions

- Time-zone display for users traveling — show event in venue local time with a sub-label in user TZ.
