# PRD-0004: Push permission flow + topic preferences

- **Status:** Draft
- **Owner:** PM
- **Reviewers:** Mobile lead, Design

## 1. Problem

Asking for push on launch caps opt-in around 35 %. We need a value-led prompt and a granular preferences screen so users stay opted in.

## 2. Users & JTBD

- "Tell me what I care about — and don't spam me."

## 3. Success Metrics

- Push opt-in ≥ 60 % of installs.
- Push opt-out / disable rate < 5 % per quarter.
- Preference-screen open rate ≥ 25 % within 14 days of install.

## 4. Scope

- **Permission prompt** triggered after the first valuable action: save event, follow community, or RSVP.
- A pre-prompt sheet ("Get notified when …") explaining value, with **Not now** / **Turn on**.
- Settings → **Notifications** screen with per-topic × per-channel toggles + quiet hours editor.
- Inbox link (data wired by TDD-0002; minimal list view here).

## 5. Out of Scope

- Per-community granular notification toggles (Phase 2).
- WhatsApp opt-in.

## 6. User Stories

- As a user who saved an event, I'm asked to enable reminders right after.
- As a user I can disable Weekly Digest while keeping Saved Event Reminders on.

## 7. Acceptance Criteria

```
Given a user taps Save on an event for the first time
When the save succeeds
Then the pre-prompt appears once; tapping Turn on triggers the OS prompt and registers the device

Given a user disables `topic=WEEKLY_DIGEST, channel=PUSH`
When the Friday digest enqueues
Then no push is delivered to that user (email still sent if enabled)
```

## 8. UX

Pre-prompt sheet copy, settings screen wireframe, quiet-hours time picker.

## 9. Risks & Open Questions

- iOS provisional notifications — consider for digest-only users.
