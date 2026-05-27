# PRD-0034: Organizer collaborator access for claimed communities (minimal v1)

- **Status:** Draft
- **Owner:** Founders
- **Reviewers:** PM, Eng Lead
- **Linked:** PRD-0031, PRD-0017, TDD-0034

## 1. Problem

From an organizer perspective, the current model has two blockers:

1. If a community is already claimed, other real organizers cannot request access through product flow.
2. A primary organizer cannot self-serve add a co-organizer to help run the page/events.

Today this requires manual admin intervention and creates avoidable operational load.

## 2. Users & JTBD

- **Primary organizer (already claimed):** I need to add one or two trusted co-organizers quickly.
- **Co-organizer (already claimed community):** I need a clear "request access" path when claim CTA is no longer available.
- **Admin:** I need low-risk approval controls without introducing complex org RBAC.

## 3. Product decision (minimal, not over-engineered)

Ship a lightweight collaborator model in v1:

1. Keep existing `claimedByUserId` as **primary owner** (no ownership model rewrite).
2. Add simple **community collaborator membership** (active/pending only).
3. Add two paths to create pending collaborator requests:
   - organizer-invite by email (from organizer surface)
   - public "Request organizer access" on already-claimed community pages
4. Admin can approve/reject pending collaborator requests.

Do **not** add granular permission sets, organizations, billing seats, or invite expiry in v1.

## 4. Success metrics

- 90% of collaborator additions completed without direct founder/manual DB edits.
- Median time for co-organizer access request to approval < 48h.
- Reduction in support/admin threads asking "how can another organizer join?"

## 5. Scope

### In scope (v1)

- Claimed community page shows:
  - claimed badge (existing)
  - new CTA: "Request organizer access" (instead of dead-end)
- Organizer portal surface to add collaborator by email.
- Pending collaborator request queue in admin.
- Approve/reject collaborator request actions.
- Organizer auth + portal access recognizes collaborator membership.

### Out of scope (v1)

- Fine-grained per-feature permissions (edit profile vs events vs channels).
- Multi-level roles (owner/admin/editor/viewer).
- Auto-approval rules, domain matching, or SCIM.
- Full org/team management redesign.

## 6. User stories

- As a primary organizer, I can invite another organizer by email to co-manage my community.
- As a co-organizer, I can request access even when the community is already claimed.
- As an admin, I can approve collaborator access safely and keep an audit trail.

## 7. Acceptance criteria

```gherkin
Given a community with claimState = CLAIMED
When a public user opens the community page
Then they see "Request organizer access"
And they can submit request details.
```

```gherkin
Given a primary organizer invites collaborator email X
When X is approved by admin
Then X can log in to organizer portal
And X can manage that specific community.
```

```gherkin
Given admin rejects a collaborator request
When requester retries later
Then they can submit another request
And no ownership state is changed.
```

## 8. UX notes (v1)

- Keep wording explicit:
  - CLAIMED page CTA: "Request organizer access"
  - UNCLAIMED page CTA: existing "Claim this community"
- In organizer portal, add a small "Collaborators" card with:
  - list active collaborators
  - invite by email input
- In admin, reuse claims-like moderation pattern for collaborator requests.

## 9. Risks and mitigations

- **Risk:** impersonation/spam access requests.
  - Mitigation: keep admin approval required in v1.
- **Risk:** confusion between ownership and collaborator access.
  - Mitigation: explicit labels: "Primary owner" vs "Collaborator".
- **Risk:** too much scope creep into RBAC.
  - Mitigation: one collaborator role in v1; defer granular permissions.

## 10. Rollout

1. Ship data model + admin moderation.
2. Ship claimed-page access request CTA.
3. Ship organizer invite UI.
4. Verify with 3-5 real organizer teams before wider communication.
