# Flows → Authority Mapping (Product Blueprint)

> Document type: Product flow-to-authority mapping (target behavior).
>
> For current as-built auth/authz architecture and implementation boundaries, use [AUTHENTICATION_AND_AUTHORIZATION_ARCHITECTURE.md](./AUTHENTICATION_AND_AUTHORIZATION_ARCHITECTURE.md).
>
> Last reviewed: 2026-06-18.

## 1. Purpose and Scope

This document maps **every way a person gains or changes authority** — both over a
**community** and over the **platform back office** — onto the role model defined in
[RBAC_AND_AUTHORIZATION.md](./RBAC_AND_AUTHORIZATION.md). For each flow it answers three
questions in plain product terms:

- **Who** can start it and who approves it?
- **What authority** exists after it completes?
- **What stays true** afterwards (the guarantees)?

It does **not** describe code or data structures. It is a product operating blueprint
that sits between the role model and the detailed feature flows. For the end-to-end UX
of individual flows, see [COMMUNITY_SUBMISSION_FLOW.md](./COMMUNITY_SUBMISSION_FLOW.md),
[COMMUNITY_CLAIM_FLOW.md](./COMMUNITY_CLAIM_FLOW.md), and
[COMMUNITY_ORGANIZER_ADMIN_FLOW.md](./COMMUNITY_ORGANIZER_ADMIN_FLOW.md). For where the
current product diverges from the target described here, see
[RBAC_AUDIT.md](./RBAC_AUDIT.md).

---

## 2. How to Read This

Authority over a community is held by its **people list** — one organizer,
plus any number of collaborators. Every flow below ends by either creating that
people list, adding to it, or changing it. Two promises are kept by every flow:

1. A **claimed** community always has **exactly one organizer**, and the organizer is on the
   people list.
2. Becoming an organizer or collaborator of one community gives a person **no power over any
   other community** and **no platform-wide title**.

Sections 4–10 cover **community** flows. Section 11 covers **platform** flows — how
back-office and city-ambassador authority is granted.

---

## 3. Flow Catalog (overview)

| #   | Flow                        | Who starts it                   | Who approves          | Authority after                                                                              |
| --- | --------------------------- | ------------------------------- | --------------------- | -------------------------------------------------------------------------------------------- |
| A   | **Platform seeding**        | Platform team                   | —                     | None yet (community is listed but unowned and claimable)                                     |
| B   | **Community submission**    | Any member                      | Platform reviewer     | Organizer if the submitter says they help run it; otherwise none yet (published & claimable) |
| C   | **Community claim**         | Any member                      | Platform reviewer     | Organizer                                                                                    |
| D   | **Collaborator invite**     | Organizer                       | The invitee accepts   | Collaborator                                                                                 |
| E   | **Request to help**         | Any member                      | Organizer or platform | Collaborator                                                                                 |
| F   | **Remove collaborator**     | Organizer                       | —                     | Collaborator removed                                                                         |
| G   | **Transfer responsibility** | Current organizer (or platform) | —                     | Responsibility moves to a member                                                             |

The columns that used to differ between flows in the old product — _"is the organizer on
the people list?"_ and _"does this grant a platform-wide title?"_ — are now the **same
for every flow**: the organizer is always on the list, and no flow grants a platform title.
That consistency is the goal of this blueprint.

---

## 4. Flow A — Platform Seeding

**Story.** The platform team lists a community so the directory is useful before any
organizer shows up.

- **Who starts it:** Platform Admin or Ops Lead.
- **Approval:** none — this is a platform action.
- **Authority after:** none. The community is listed and **claimable**, with no organizer
  and an empty people list.

**Guarantees & notes**

- An unowned community is a **valid, intended** state, not a gap. It invites a claim.
- If the team wants to assign an organizer at seeding time, that is the **same outcome as a
  claim approval** (Flow C): the named person becomes the organizer, on the people list,
  recorded — never an informal back-channel grant.

---

## 5. Flow B — Community Submission

**Story.** Anyone can add a community to the directory. At submit time they answer one
question — _"What's your relationship to this community?"_ — and the answer decides what
happens on approval.

- **Who starts it:** any member, via the submit form.
- **Approval:** a platform reviewer.
- **Authority after — depends on what the submitter declared:**

| Submitter declared                               | On approval                                                                                                                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **"I help run this community"**                  | The submitter becomes the **organizer**, on the people list. (They can later add collaborators and, if needed, transfer organizer to someone else — see Flows D and G.)                   |
| **"I'm just adding it"**                         | The community is published but stays **unowned** and **claimable**. The submitter stays a **member** with no authority.                                                                   |
| **"I'm just adding it" + suggests an organizer** | Same as above — published and claimable — and the platform **invites the suggested person to claim** it. The suggested person only becomes organizer once they act and pass claim review. |
| **Reject**                                       | Nothing is published, nothing is granted.                                                                                                                                                 |

**Guarantees & notes**

- **One question, not many roles.** "I help run it" covers anyone hands-on (organizer or
  helper); they all start as **organizer**, because the organizer can immediately add
  collaborators and hand responsibility over. There is no separate "collaborator submit"
  path to reason about.
- **A named third party is a lead, not an authority.** Suggesting an organizer never
  auto-grants the role — that person still has to claim and be verified. This keeps the
  rule "authority is earned by the person who acts."
- **A plain member submission opens the listing for claim** (the unowned/claimable state
  from Flow A), so the real organizer can step in later.
- Verification badges (verified, claimed) are about **trust**, not authority.

---

## 6. Flow C — Community Claim

**Story.** A member finds their community already listed and asks to run it. This is the
reference path for becoming an organizer.

- **Who starts it:** any member (email-first, no account hurdle).
- **Approval:** a platform reviewer.
- **Authority after:** the claimant becomes the **organizer**, on the people list. The
  community is now **claimed**.

**Guarantees & notes**

- A claim is only valid for a community that is **not already claimed**.
- Approval makes the claimant the organizer of **that one community** — nothing more. Their
  platform account remains an ordinary member.
- This is the shape every "becomes organizer" path (B-"I help run it", A-with-assignment,
  G-transfer) matches.

---

## 7. Flow D — Collaborator Invite

**Story.** An organizer brings in another person to help run the community.

- **Who starts it:** organizer.
- **Approval:** the invitee accepts the invite.
- **Authority after:** the invitee joins the people list as a **collaborator**.

**Guarantees & notes**

- The inviter **picks the role**, and it can only be collaborator.
- Invite acceptance is explicit (scanner-safe confirm page + button), not auto-accepted on link open.
- **Organizer responsibility is not invitable** — it only moves via transfer (Flow G).
- Re-inviting someone who is already a member or already invited does nothing
  (no duplicates).
- Re-sending a pending organizer invite is allowed but server-throttled to prevent accidental duplicate sends.

---

## 8. Flow E — Request to Help

**Story.** A member of the public asks to help run a community that already has an organizer.

- **Who starts it:** any member, from the community's page.
- **Approval:** the platform team.
- **Authority after:** the requester joins the people list as a **collaborator**.

**Guarantees & notes**

- Only available for **claimed** communities, and rate-limited to prevent spam.
- Approval is a deliberate act — it adds the requester as a **collaborator** and never
  silently makes them an organizer.

---

## 9. Flow F — Remove a Collaborator

**Story.** An organizer removes a collaborator from the community's people list.

- **Who:** organizer.
- **Authority after:** that person is no longer a collaborator and has no authority over
  the community.

**What is not allowed**

- Removing the **organizer**. The community can never be left with no organizer — stepping
  away is done through transfer (Flow G), not removal.

---

## 10. Flow G — Transfer Responsibility

**Story.** An organizer hands the community to someone else before stepping away.

- **Who:** the current organizer (or the platform team for recovery cases).
- **Authority after:** the chosen member becomes the **new organizer**, and the previous
  organizer steps down to collaborator (or leaves). This happens as one move, so there is
  never a gap with no organizer.

**Guarantees & notes**

- The new organizer must already be a member of the community.
- You cannot transfer responsibility to yourself.

---

## 11. Platform Flows → Authority

The flows above grant authority over **one community**. The flows here grant or change
authority over the **platform back office and shared directory**. They map onto the
platform roles in [RBAC_AND_AUTHORIZATION.md](./RBAC_AND_AUTHORIZATION.md) §5.2 and §7.

| #   | Flow                                                   | Who starts it                                             | Who approves | Authority after                                                          |
| --- | ------------------------------------------------------ | --------------------------------------------------------- | ------------ | ------------------------------------------------------------------------ |
| P1  | **Grant a platform role** (Ops, Partnerships, Content) | Platform Admin                                            | —            | The person holds that platform role globally                             |
| P2  | **Assign a city ambassador**                           | Platform Admin                                            | —            | The person represents IndLokal in **one city** only                      |
| P3  | **Revoke a platform role / ambassadorship**            | Platform Admin                                            | —            | The person returns to plain member; any community authority is untouched |
| P4  | **Review the queue** (submissions, claims, reports)    | Ops Lead / Partnerships Lead / City Ambassador (own city) | —            | No new standing authority; the reviewed item changes state               |
| P5  | **Edit directory content**                             | Content Editor / Ops Lead                                 | —            | No access authority granted — content only                               |
| P6  | **Archive or deactivate a listing**                    | Platform Admin                                            | —            | The listing leaves discovery; organizer and collaborators are untouched  |

**Guarantees & notes**

- **Platform roles are granted top-down.** Only a Platform Admin assigns or revokes them;
  nobody self-grants (the privilege-ceiling rule from the role model).
- **The two systems stay independent.** A platform role is never a side effect of a
  community flow, and a community role is never a side effect of a platform flow.
- **Ambassadors are city-scoped.** P2 grants authority in exactly one city; acting in
  another city requires a separate assignment.
- **Reviewing is not owning.** Approving a claim or submission (P4) gives the reviewer no
  authority over that community — it only moves the item to its next state.
- Every grant, revocation, and review decision is **recorded**, the same as community flows.

---

## 12. Guarantees That Hold After Every Flow

1. A claimed community has **exactly one organizer**, and the organizer is on the people list.
2. "Who can manage this community?" is answered by **one** people list, in full.
3. No flow grants a **platform-wide title** as a side effect of community authority.
4. Nobody ends up with more power than the person who granted it.
5. A community is **never** left with no organizer.
6. Every grant, change, and removal is **recorded** — who, to whom, and when.

---

## 13. Quick Reference — Who Can Do Each Flow

### Community flows

| Flow                      |   Member    | Collaborator | Organizer | Platform team |
| ------------------------- | :---------: | :----------: | :-------: | :-----------: |
| A Seed                    |             |              |           |       ✓       |
| B Submit                  | ✓ (submit)  |              |           |  ✓ (approve)  |
| C Claim                   |  ✓ (claim)  |              |           |  ✓ (approve)  |
| D Invite                  |             |              |     ✓     |               |
| E Request to help         | ✓ (request) |              |           |  ✓ (approve)  |
| F Remove collaborator     |             |              |     ✓     |               |
| G Transfer responsibility |             |              |     ✓     |       ✓       |

### Platform flows

| Flow                   | Member | Content Editor | City Ambassador | Ops / Partnerships | Platform Admin |
| ---------------------- | :----: | :------------: | :-------------: | :----------------: | :------------: |
| P1 Grant platform role |        |                |                 |                    |       ✓        |
| P2 Assign ambassador   |        |                |                 |                    |       ✓        |
| P3 Revoke role         |        |                |                 |                    |       ✓        |
| P4 Review queue        |        |                |  ✓ (own city)   |         ✓          |       ✓        |
| P5 Edit content        |        |       ✓        |                 |         ✓          |       ✓        |
| P6 Archive listing     |        |                |                 |                    |       ✓        |

---

## 14. Related Documents

- [RBAC_AND_AUTHORIZATION.md](./RBAC_AND_AUTHORIZATION.md) — the role model this maps onto
- [RBAC_AUDIT.md](./RBAC_AUDIT.md) — where today's product diverges from these targets
- [COMMUNITY_SUBMISSION_FLOW.md](./COMMUNITY_SUBMISSION_FLOW.md), [COMMUNITY_CLAIM_FLOW.md](./COMMUNITY_CLAIM_FLOW.md), [COMMUNITY_ORGANIZER_ADMIN_FLOW.md](./COMMUNITY_ORGANIZER_ADMIN_FLOW.md) — the detailed UX flows
