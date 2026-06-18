# PRD-0060: Contribution Attribution & "My Contributions"

- **Status:** Approved
- **Owner:** Engineering
- **Reviewers:** PM, Eng Lead, Design
- **Linked:** TDD-0060, PRD-0057 (Contribution intake), PRD-0059 (Me data export), ADR-0008, ADR-0009

## 1. Problem

When a **logged-in** user contributes content (submits a community, suggests a
missing event, suggests/reports a community), the contribution is not reliably
attributed to their account. Concretely, in the current code:

1. `submitCommunity` derives the "creator" by **upserting a `User` from the typed
   contact email** (`apps/web/src/app/submit/actions.ts`), not from the active
   session. This (a) ignores the authenticated actor, (b) silently creates ghost
   `User` rows for any contact email, and (c) misattributes the record when the
   typed email differs from the signed-in account.
2. `suggestCommunity` and `reportIssue` (`apps/web/src/app/actions/reports.ts`)
   write **no** `reporterUserId` at all, so an authenticated user's suggestion is
   anonymous in the data model.
3. `contributeEvent` correctly attributes the actor (`reporterUserId` +
   `PipelineItem.submittedBy`), but there is **no read surface** where a user can
   see "things I contributed", so the attribution is invisible to the user.

The result: a signed-in member who adds value to the directory has no record of
it, cannot track review status, and the platform cannot credit contributors.

Why now: contribution intake (PRD-0057) and data portability (PRD-0059) have
landed; attribution is the missing connective tissue that makes both trustworthy
and makes a member-facing contributor loop possible.

## 2. Users & JTBD

- **Authenticated member / contributor** — _"When I add a community or suggest an
  event while signed in, I want it tied to my account and visible to me, so I can
  track whether it was published."_
- **Ambassador / operator** — _"I want contributions attributed to real accounts
  (not email-derived ghosts) so contributor stats and trust signals are accurate."_

## 3. Success Metrics

- 100% of contributions made by an authenticated user carry a structured
  `actorUserId` (no reliance on typed contact email for attribution).
- 0 new ghost `User` rows created from contact email on community submit.
- A signed-in user can see every contribution they made in the current model on
  `/me`, with live review status.
- Measured via existing `CONTRIBUTION_SUBMITTED` analytics (`isAuthenticated`
  property) and a DB invariant check (see TDD-0060 §9).

## 4. Scope

- **One attribution rule** applied uniformly across all public contribution
  actions: when a session user exists, attribution binds to that session user id;
  contact email/name are communication metadata only, never the attribution key.
- Community submit (`submitCommunity`): attribute to session user via
  `Community.createdByUserId`; **stop** creating ghost users from contact email.
- Community suggestion + issue report (`suggestCommunity`, `reportIssue`):
  attribute to session user via `ContentReport.reporterUserId` (and
  `PipelineItem.submittedBy` where a pipeline item is created).
- Event suggestion (`contributeEvent`): confirm + lock existing actor attribution
  (`reporterUserId`, `submittedBy`); keep `Event.createdByUserId` **null** for
  suggestions (host authority is separate — see §5 / ADR-0009).
- A single **"My Contributions"** read model + a section on `/me`.

## 5. Out of Scope

- Mobile "My Contributions" UI (read model is shaped to be reused later; mobile
  surface is a follow-up).
- Backfilling historical email-derived ghost users into real accounts.
- Any new schema/migration — all attribution fields already exist.
- Editing or withdrawing a contribution after submission.
- Contributor leaderboards, gamification, or points.

### Identity model (the rule this PRD enforces)

Three identities are kept strictly distinct and must never be conflated:

| Identity                   | Field(s)                                                                                | Meaning                        | Set from                        |
| -------------------------- | --------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------- |
| **Actor**                  | `Community.createdByUserId`, `ContentReport.reporterUserId`, `PipelineItem.submittedBy` | Who performed the contribution | Session (`getSessionUser`) only |
| **Contact**                | `metadata.submitter.{name,email}`, `ContentReport.reporterEmail`                        | Who to email about it          | Typed form fields (comms only)  |
| **Owner / host authority** | `Community.claimedByUserId`, `Event.createdByUserId`, `CommunityCollaborator`           | Who governs/manages the entity | Claim & approval flows only     |

Suggesting an event does **not** make the suggester its host. Submitting a
community creates an attributed-but-`UNCLAIMED` record; ownership still requires
the claim flow. This preserves ADR-0008/0009 authority semantics.

## 6. User Stories

- As a signed-in member, when I submit a community, it is recorded under my
  account so I can see it later.
- As a signed-in member, when I suggest a missing event or community, it is tied
  to me and I can track whether it was published or is still under review.
- As a member, I can open `/me` and see a "Your contributions" list with each
  item's type, title, and current status.
- As an operator, contributor attribution reflects real authenticated accounts,
  not email-derived ghosts.

## 7. Acceptance Criteria (Gherkin)

```
Given I am signed in
When I submit a community with a contact email different from my account email
Then the community's createdByUserId is my account id
And no new User row is created from the contact email
And the contact email is stored only as submitter communication metadata

Given I am signed in
When I suggest a missing community or report an issue
Then the ContentReport.reporterUserId is my account id

Given I am signed in
When I suggest a missing event
Then the ContentReport.reporterUserId and PipelineItem.submittedBy are my account id
And the placeholder Event.createdByUserId is null (I am not its host)

Given I am signed in and have contributed a community and an event suggestion
When I open /me
Then I see both under "Your contributions" with their current review status

Given I am NOT signed in
When I submit a community
Then createdByUserId is null
And the submission still succeeds with contact email captured as metadata
```

## 8. UX

- New `/me` section "Your contributions": a simple list, newest first. Each row:
  type chip (Community / Event), title, status chip (Under review / Published /
  Needs changes), and a link to the public entity when one exists.
- Empty state: "You haven't added anything yet — submit a community or suggest an
  event." with links to existing contribute entry points.
- No new colors/components; reuse `card-base` and existing chip styling.

## 9. Risks & Open Questions

- **Risk:** Removing ghost-user creation means an anonymous submitter who later
  signs up is not auto-linked to their prior submission. _Mitigation:_ contact
  email is retained in metadata for future reconciliation; out of scope for v1.
- **Risk:** Double-counting host-created events in "My Contributions". _Mitigation:_
  the read model only includes user-originated suggestions/submissions, not
  host-owned events (which live in the host workspace).
- **Resolved:** No migration required; all fields already exist and are indexed.
