# PRD-0036: Community governance & scoped authority

- **Date:** 2026-05-29
- **Status:** Accepted
- **Owner:** Platform
- **Linked:** ADR-0008, TDD-0036, ADR-0005
- **Audit:** [docs/RBAC_AUDIT.md](../../RBAC_AUDIT.md)

## Problem

A claimed community needs a clear answer to "who is allowed to run this?" Today the answer is split
between the primary-owner pointer (`claimedByUserId`) and the community membership table. This
lets ownership and delegated team access blur together in the UI. We want community authority to
be simple, explicit, and scoped to the community.

## Users & JTBD

- **Primary owner** (one per community): "I run this community and decide who else ca help."
- **Collaborator:** "I help operate a community I was invited to or approved for."
- **Platform admin:** "I approve claims/submissions and ca step in on any community."
- **Submitter (not necessarily a organizer):** "I want to add a community I know about, and tell
  you whether I actually help run it."

## Success Metrics

- 100% of community write actions authorize against the community membership record (zero reads of
  `User.role` for community permission).
- Exactly one primary owner per claimed community (DB-enforced through `claimedByUserId`).
- Every grant/revoke/transfer produces a `ContentLog` audit row.

## Scope

- Two community roles only: **Community admin** (`COMMUNITY_ADMIN`) and **Collaborator** (`COLLABORATOR`).
- `COMMUNITY_ADMIN` means delegated admin access, not primary ownership.
- Primary ownership stays on `claimedByUserId`; a claim/submission approval or transfer updates that
  pointer and can also create or update a `COMMUNITY_ADMIN` membership row.
- Collaborators are invited by email or request access; the primary owner reviews team changes.
- Ownership transfer updates the primary owner pointer and demotes the outgoing owner to `COLLABORATOR`.
- Submission form asks the submitter to **declare their relationship** to the community instead of
  a bare "I want ownership" checkbox.
- Authorization is enforced uniformly (no feature flag).

## Out of Scope

- Additional collaborator tiers (admin/viewer) or per-action permission grids.
- `EVENT_HOST` / `PARTNER_ORG_ADMIN` flows (future platform roles, ADR-0005).
- New collaborator-management UI beyond what already exists (invite + list); remove/transfer remain
  server actions for primary-owner use.

## User Stories & Acceptance Criteria

### Story 1 — Organizer access comes from a membership row, not a profile role

```gherkin
Given a platform admin approves a community claim
When the claim is approved
Then the claiming user gets a COMMUNITY_ADMIN CommunityCollaborator row for that community
And the community's claimedByUserId points to that user
And a ROLE_GRANTED ContentLog row is written
And the user's global User.role is NOT changed to grant the access
```

### Story 2 — Submitter declares their relationship

```gherkin
Given a submitter adds a community
When they choose their relationship to the community
Then they ca pick "I help run this community" or "I'm just adding it"
And the choice is stored on the submission
And on approval, organizer access is only granted when the submitter helps run it
And granting it creates a COMMUNITY_ADMIN membership row (not a global role)
```

### Story 3 — Exactly one primary owner

```gherkin
Given a community already has a organizer
When a second COMMUNITY_ADMIN row is attempted for the same community
Then the database rejects it
```

### Story 4 — Ownership transfer demotes the outgoing organizer to collaborator

```gherkin
Given a community has a organizer
When ownership is transferred to another member
Then the new user becomes COMMUNITY_ADMIN
And the previous organizer becomes a COLLABORATOR (not removed, not admin)
And claimedByUserId is updated
And the change is recorded in ContentLog
```

### Story 5 — Community writes authorize against membership

```gherkin
Given a user without a COMMUNITY_ADMIN/COLLABORATOR membership for a community
When they attempt to edit the community, manage channels, or create events for it
Then the action is rejected
And a platform admin is always allowed
```

## UX

- **Submit form:** replace the "I want organizer ownership" checkbox with a relationship choice
  ("I help run this community" / "I'm just adding it"). Same-email-for-login hint is retained for
  the "help run" option.
- **Admin submissions:** show the declared relationship; the "grant organizer access on approve"
  control defaults on when the submitter declared they help run it.
- **Organizer team page:** primary owner card + active admins/collaborators list + email invite.
  Only the primary owner sees promote/demote/remove/transfer controls.

## Risks

- Removing the global-role grant could lock organizers out of login if login still keys off
  `User.role`. Mitigation: organizer login gates on having a claimed community or active membership
  (TDD-0036), and the migration backfills `COMMUNITY_ADMIN` rows.
- Collapsing the enum is a destructive schema change. Mitigation: the rollout edits the
  not-yet-applied collaborator-roles migration in place; backout is `git revert` + `migrate reset`
  in dev.
