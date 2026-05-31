# Roles, Permissions & Authorization (Product Blueprint)

## 1. Purpose and Scope

This document defines **who is allowed to do what** on IndLokal, and why. It is the
foundational product blueprint for roles, permissions, and community governance.

It covers:

- The kinds of authority that exist on the platform and where each one applies
- The complete role catalog (platform roles and community roles)
- What every role can and cannot do
- The governance rules that keep authority safe (ownership, delegation, removal)

It does **not** describe implementation internals, database schemas, or code-level
audit findings. It is a product operating blueprint. For how each real-life flow
grants or changes authority, see [RBAC_FLOW_MAPPING.md](./RBAC_FLOW_MAPPING.md). For
where today's product diverges from this blueprint, see [RBAC_AUDIT.md](./RBAC_AUDIT.md).

Related product flows: [COMMUNITY_SUBMISSION_FLOW.md](./COMMUNITY_SUBMISSION_FLOW.md),
[COMMUNITY_CLAIM_FLOW.md](./COMMUNITY_CLAIM_FLOW.md),
[COMMUNITY_ORGANIZER_ADMIN_FLOW.md](./COMMUNITY_ORGANIZER_ADMIN_FLOW.md).

---

## 2. Why This Blueprint Exists

IndLokal is curated by three groups working together: the **platform team** (quality
and operations), **city ambassadors** (local representation), and **community
organizers** (the people who actually run communities). Each group needs real power
over part of the system, and none of them should have power over the parts that
aren't theirs.

Authority that is too broad erodes trust (someone edits a community they don't run);
authority that is too narrow stalls the product (an organizer can't add a co-host).
This blueprint draws the lines clearly so the product can scale organizer onboarding
and multi-city operations without authority becoming a source of bugs, incidents, or
confusion.

The single most important idea: **authority is always tied to a thing and a place.**
Running _one community_ is not the same as being a platform administrator. Helping in
_one city_ is not the same as helping in every city. The model keeps these separate on
purpose.

---

## 3. The Two Kinds of Authority

IndLokal has exactly two authority systems. Keeping them distinct is the heart of this
blueprint.

### 3.1 Platform authority

Power over the **back office and shared directory** — reviewing submissions, approving
claims, resolving reports, running the content pipeline, managing the team. This is
held by platform staff and city ambassadors. Some of it is global (applies everywhere);
some is narrowed to a **city** (an ambassador acts only in their city).

### 3.2 Community authority

Power over **one specific community** — its profile, events, channels, and the people
who help run it. For MVP, this is held by one organizer and the collaborators they
bring in. It never spills over to other communities.

> A person can hold both. Someone might be a city ambassador (platform authority in
> Stuttgart) _and_ the organizer of two communities (community authority over just those
> two). These are independent; one never implies the other.

---

## 4. Product Principles

1. **Authority is scoped, never global by accident.** Helping run one community grants
   power over that community only — not a platform-wide title.
2. **One clear source of truth per community.** "Who can manage this community?" has a
   single, complete answer that includes the organizer.
3. **Least privilege.** People get the narrowest authority that lets them do their job.
   Being able to _see_ something never implies being able to _change_ it.
4. **No community is ever left unmanaged.** Every claimed community has exactly one
   organizer at all times; responsibility can be handed over but never simply dropped.
5. **Every grant and removal is recorded.** Who gave whom access to what, and when, is
   always answerable.
6. **The system decides, not the screen.** Permission is enforced by the platform on
   every action, not merely by hiding a button.
7. **One pattern, reused.** The way community authority works is the template for
   future per-thing authority (e.g. event hosts, partner organizations).

---

## 5. Role Catalog

### 5.1 Community roles (per community)

Held over a single community. A user can have a different role in each community they
touch.

| Role             | Who they are                                  | In one sentence                                      |
| ---------------- | --------------------------------------------- | ---------------------------------------------------- |
| **Organizer**    | The accountable person who runs the community | Full control over the listing and who helps with it. |
| **Collaborator** | A helper                                      | Helps maintain the profile, channels, and events.    |

There is **exactly one organizer** per claimed community. Collaborators can be many.

### 5.2 Platform roles

Held over the back office and directory. Most are global; the ambassador role is tied
to a city.

| Role                  | Scope    | What they do                                                                                             |
| --------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| **Platform Admin**    | Global   | Full control, including granting platform roles and emergency actions.                                   |
| **Ops Lead**          | Global   | Runs day-to-day operations: pipeline, claims, reports, scoring, merges, content.                         |
| **Partnerships Lead** | Global   | Reviews submissions/claims, resolves reports, runs outreach.                                             |
| **City Ambassador**   | One city | Represents IndLokal locally: submits and verifies communities, checks people in at events.               |
| **Content Editor**    | Global   | Improves directory content; does not govern access.                                                      |
| **Member (default)**  | —        | Any signed-in person: browse, save, follow, RSVP, submit, claim, request to help. No standing authority. |

> A "Member" becomes an organizer/collaborator **of a specific community**
> through the flows in [RBAC_FLOW_MAPPING.md](./RBAC_FLOW_MAPPING.md). Their platform
> account stays an ordinary member; their power lives on the community, not on their
> profile.

---

## 6. What Each Community Role Can Do

| Capability                                        | Collaborator | Organizer |
| ------------------------------------------------- | :----------: | :-------: |
| View the organizer workspace & insights           |      ✓       |     ✓     |
| Edit community profile                            |      ✓       |     ✓     |
| Create, edit, and remove events                   |      ✓       |     ✓     |
| Manage access channels (WhatsApp, Telegram, etc.) |      ✓       |     ✓     |
| Invite collaborators                              |              |     ✓     |
| Remove a collaborator                             |              |     ✓     |
| Transfer responsibility to someone else           |              |     ✓     |
| Archive or deactivate the community listing       |              |     ²     |

² Archiving or deactivating a community listing is a platform-governed safety action
handled by the platform team, not an organizer self-serve button, so the directory is
never lost by accident.

---

## 7. What Each Platform Role Can Do

| Area                                     | Platform Admin | Ops Lead | Partnerships Lead | City Ambassador | Content Editor |
| ---------------------------------------- | :------------: | :------: | :---------------: | :-------------: | :------------: |
| View directory data                      |       ✓        |    ✓     |         ✓         |   (own city)    |       ✓        |
| Edit directory data                      |       ✓        |    ✓     |                   |                 |                |
| Archive or deactivate directory listings |       ✓        |          |                   |                 |                |
| Review content pipeline                  |       ✓        |    ✓     |         ✓         |                 |                |
| Approve / reject claims & submissions    |       ✓        |    ✓     |         ✓         |                 |                |
| Resolve reports                          |       ✓        |    ✓     |         ✓         |                 |                |
| Submit / verify communities locally      |       ✓        |          |                   |  ✓ (own city)   |                |
| Check people in at events                |       ✓        |          |                   |  ✓ (own city)   |                |
| Outreach (CRM)                           |       ✓        |    ✓     |         ✓         |        ✓        |                |
| Improve content                          |       ✓        |    ✓     |                   |                 |       ✓        |
| Manage the team (grant/revoke roles)     |       ✓        |          |                   |                 |                |

The city ambassador's powers apply **only to their assigned city**. An ambassador for
Stuttgart cannot act in Berlin.

---

## 8. Organizer & Delegation Model

- **One organizer per community.** The organizer is the accountable human and is always part of
  the community's people list.
- **Organizers delegate by inviting collaborators.**
- **Delegation never exceeds the delegator.** You cannot grant someone more power than
  you hold. You cannot raise your own role.
- **Responsibility is transferred, never abandoned.** When an organizer steps away, the
  platform updates the record in one move. There is never a moment with no organizer.
- **The platform team is the backstop.** For exceptional cases (an organizer is
  unreachable, a takeover dispute), the platform team can intervene — always recorded.

---

## 9. Governance Rules

These rules hold no matter which flow created the authority:

1. **Exactly one organizer** for every claimed community, at all times.
2. **No self-promotion to organizer** — responsibility only moves via transfer.
3. **Privilege ceiling** — nobody grants or assigns a role higher than their own.
4. **No self-escalation** — you cannot promote yourself.
5. **Approval where it matters** — public requests to help a community require approval
   before they take effect; organizer invites take effect on acceptance.
6. **Right state required** — you can only claim a community that is unclaimed, and only
   request to help a community that is already claimed.
7. **Everything is recorded** — every grant, change, and removal of authority is logged
   with who did it, to whom, and when.

---

## 10. How Authority Is Granted (at a glance)

Authority is never assumed; it is granted through a defined flow and then enforced on
every action.

| You become…                                       | …through                                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Organizer** of a community                      | claiming an existing listing, submitting a community as someone who helps run it, or having responsibility transferred to you |
| **Collaborator** of a community                   | being invited by an organizer, or having your request to help approved                                                        |
| **City Ambassador**                               | being assigned to a city by the platform team                                                                                 |
| **Ops / Partnerships / Content / Platform Admin** | being granted the role by a platform admin                                                                                    |

Each of these is detailed, end to end, in
[RBAC_FLOW_MAPPING.md](./RBAC_FLOW_MAPPING.md).

---

## 11. Non-Goals (this blueprint)

- Per-field or per-feature permissions finer than organizer/collaborator.
- Event-level hosts as a distinct authority (planned later; will reuse this pattern).
- Partner/organization membership management (planned later).
- The technical data model and migration mechanics (covered in development specs, not
  here).

---

## 12. Future Direction

- **Event hosts** — a person who can manage a single event without managing the whole
  community, reusing the same per-thing authority pattern.
- **Partner organizations** — organizations that own a set of communities, with their
  own organizers.
- **Self-serve request approval** — letting organizers approve "request to help"
  directly, with the platform team retaining oversight.
- **Authority insights** — showing organizers a clear, friendly history of who was added or
  changed and when.
