# PRD-0044: Confirmation Popups UX and Coverage

- **Status:** Implemented
- **Owner:** Product Engineering
- **Reviewers:** PM, Eng Lead
- **Linked:** TDD-0044, PRD/TDD-0036, PRD/TDD-0037

## 1. Problem

High-impact admin and organizer actions were inconsistent: some actions had no
confirmation guard, and popup behavior had mobile usability
issues (confirm action visibility and cramped behavior on small screens).

This created two risks:

- Accidental moderation/destructive actions from single taps.
- Poor operator UX on phones and narrow screens.

## 2. Goals

- Provide a standard, reusable confirmation popup pattern for form-based server
  actions.
- Fix mobile popup behavior so confirm/cancel controls remain visible and usable.
- Expand popup coverage to all core moderation flows, including submissions.
- Audit ambassador/admin/organizer surfaces and document follow-up targets.

## 3. Scope

Implemented in this integrated popup-guard rollout:

- Reusable popup component with consistent API and tone variants.
- Mobile-safe popup layout and action footer behavior.
- Coverage on core moderation/governance actions:
  - Admin: submissions, claims, events, collaborator requests, reports, pipeline
    auto-approval revert.
  - Admin data: community, event, and resource delete actions.
  - Organizer: collaborator governance, channel removal, event archive/cancel.

## 4. Out of Scope

- Replacing every submit button in admin data CRUD pages.
- Multi-step typed confirmations (for example requiring typed entity name).
- Analytics instrumentation specific to popup opens/cancels.

## 5. User Stories

- As an admin reviewer, I can confirm before approving/rejecting submissions,
  claims, events, and collaborator requests.
- As an organizer owner/admin, I can confirm before role changes and removals.
- As a mobile operator, I can always see and tap confirm/cancel buttons without
  clipping or hidden controls.

## 6. Acceptance Criteria

```gherkin
Given a high-impact form action uses the shared confirmation component
When the user taps the trigger
Then a popup opens with title, optional description, and confirm/cancel controls
And confirm submits the parent form action
And cancel closes the popup without submitting
```

```gherkin
Given the popup is opened on a small screen
When content is long or viewport height is constrained
Then the popup remains within viewport
And action buttons remain visible and tappable
And background scrolling is prevented while open
```

```gherkin
Given admin submission review actions
When an operator chooses approve or reject
Then the action requires confirmation before mutation
```

## 7. UX Notes

- Confirmation dialogs are modal and dismissible by backdrop, cancel, or Escape.
- Action footer is mobile-first with full-width buttons on small screens.
- Confirm button tones:
  - `danger` for destructive/revert/reject
  - `primary` for approve/resolve/grant-like actions
  - `neutral` for non-destructive state progression

## 8. Coverage Audit Summary

### Covered

- Admin: claims, events, submissions, collaborator requests, reports,
  pipeline revert-auto-approvals.
- Organizer: collaborator promote/demote/remove/transfer, channel removal,
  community event archive, host event cancel/archive.

### Ambassador console

- No destructive/moderation actions currently require popup guards in the
  current ambassador surfaces (submit/check-in/feedback flows are additive).

### Recommended follow-up

- Admin city active toggle and selected bulk pipeline operations.

## 9. Risks

- Added confirmation clicks can slow expert workflows; mitigated by restricting
  use to high-impact actions.
- Modal stacking complexity; mitigated by using one shared component API.
