# PRD-0031: Submission ownership and claim lifecycle alignment

- **Status:** Draft
- **Owner:** Founders
- **Reviewers:** PM, Eng Lead
- **Linked:** TDD-0031, PRD/TDD-0013, PRD-0017

## 1. Problem

Community submission approval and community ownership are currently treated as separate workflows in parts of the product, but operators expect a direct submission to result in owner attribution after admin approval.

Observed confusion:

1. Admin approves a direct submission, community becomes `ACTIVE`.
2. Public page still shows "Claim this community".
3. Submitter cannot access organizer tools because ownership was not linked.

This causes trust and UX mismatch for both admins and submitters.

## 2. Users & JTBD

- **Platform admin**: when I approve a direct submission, I want ownership state to reflect what I approved.
- **Submitter/organizer**: if I submitted my own community, I want to manage it without a second claim flow.
- **Public user**: I should see accurate ownership state on the community page.

## 3. Success Metrics

- 0 approved direct submissions left in `ACTIVE + UNCLAIMED` unless explicitly marked non-owner submission.
- < 5% of approved submissions require manual ownership correction by admins.
- Organizer login success rate improves for newly approved submitters.

## 4. Scope

- Define canonical policy for ownership on submission approval.
- Align admin approval action with ownership policy.
- Ensure public/community list badges and claim CTA reflect updated state immediately.
- Define one-time backfill policy for historically approved submissions.
- Add audit metadata indicating why ownership was (or was not) auto-linked.

## 5. Out of Scope

- Redesigning full organizer onboarding UX.
- Multi-owner roles and delegation (covered by PRD-0017).
- Changes to event-host-only flow.

## 6. User Stories

- As an admin, I can approve submission content and ownership together when submitter is the organizer.
- As an admin, I can approve content without assigning ownership when submitter is not the organizer.
- As a submitter, I can clearly indicate whether I am requesting ownership.

## 7. Acceptance Criteria

```gherkin
Given a community submission with ownership intent set to true
When an admin approves it
Then community status is ACTIVE
And claimState is CLAIMED
And claimedByUserId points to submitter user
And organizer login is allowed for submitter email.
```

```gherkin
Given a community submission with ownership intent set to false
When an admin approves it
Then community status is ACTIVE
And claimState remains UNCLAIMED
And public page may still show "Claim this community".
```

```gherkin
Given ownership was updated during approval
When admin action completes
Then city feed and community detail/list routes are revalidated
And badges/CTA update without stale claim state.
```

## 8. Policy Decision (Proposed)

Default recommendation:

1. **Ownership intent required**: submission form captures explicit checkbox/field ("I am an organizer and want to manage this page").
2. **Admin-controlled finalization**: admin approval can confirm or override ownership linking.
3. **No implicit ownership from contact email alone** for future submissions without ownership intent.

Interim behavior (already shipped in code):

- If submitter email exists and community is unclaimed at approval time, system auto-links owner.

This interim behavior is acceptable short-term, but should be superseded by explicit ownership-intent semantics.

## 9. Risks & Open Questions

- **Impersonation risk**: someone can submit another community and be auto-linked as owner.
  - Mitigation: require explicit ownership intent + lightweight proof + admin confirmation.
- **Operational overhead**: adding another admin decision point can slow review.
  - Mitigation: default admin toggle pre-filled based on ownership intent.
- **Historical data ambiguity**: old submissions lack ownership-intent field.
  - Open question: should backfill auto-claim all, or only rows with claim evidence/contact-domain confidence?

## 10. Implementation Notes (Shipped Delta - 2026-05-27)

Ownership decision and post-approval clarity improvements shipped:

1. Submission approval email now clearly separates:

- listing-live confirmation (public page)
- organizer-access next step when ownership is granted

2. Ownership-granted emails now include organizer-login CTA with prefilled email.
3. Organizer login page accepts `?email=` prefill from approval link for lower friction.
4. Admin submissions approval UI now includes explicit "Will grant organizer access on approve: Yes/No" safeguard near approve action.
5. Approval-side safeguard is live-updating with checkbox state to reduce missed ownership decisions.
