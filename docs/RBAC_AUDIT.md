# RBAC Implementation Audit (Code vs Blueprint)

## 1. Purpose and Scope

This document audits the **actual implementation** against the target role model in
[RBAC_AND_AUTHORIZATION.md](./RBAC_AND_AUTHORIZATION.md) and the flow mappings in
[RBAC_FLOW_MAPPING.md](./RBAC_FLOW_MAPPING.md). It checks enums, tables, server actions,
auth helpers, feature flags, seeds, and tests, and reports **what is good, what is a gap,
what is over-engineered, and what is under-engineered**.

Findings are code-grounded and reference real files; this document is the single source of
truth for the audit.

**Headline:** the RBAC v2 foundation is _built and largely correct_, but it is (a) **off by
default** and only partially wired into edit actions, (b) **over-scoped** — it ships a
4-tier collaborator model when the blueprint wants 2 roles, and (c) the **submission**
approval path is misaligned with the revised declared-relationship model. The work ahead is
mostly **simplification + rollout**, not new building.

---

## 2. How to Read This

For each finding we give a verdict:

- ✅ **Good** — implemented and matches the blueprint; keep it.
- ❌ **Gap** — missing, unwired, or contradicts the blueprint; should be fixed.
- 🔶 **Over-engineered** — more machinery tha the MVP blueprint asks for; simplify.
- 🔻 **Under-engineered** — present but incomplete vs the blueprint; finish it.

---

## 3. Executive Summary

The earlier version of this audit said "the foundation is weak." That is **no longer
accurate** — the role-bearing `CommunityCollaborator` work (the `COMMUNITY_RBAC_V2` change)
has since landed. The current reality:

- **The role-bearing people list exists and is correct.** `CommunityCollaborator` is the
  single membership table; claim approval (flag on) writes a `COMMUNITY_ADMIN` row + audit log
  instead of a global role; transfer is atomic and protects the last owner.
- **Scoped platform authority exists.** `RoleAssignment` (with `cityId`) plus `can()` /
  `assertCan()` enforce city-scoped ambassador power; admin actions all gate on `assertCan`.
- **But it is dark.** The whole community layer is behind `FLAGS.communityRbacV2`, which is
  **default OFF**. With the flag off, organizer edit actions fall back to "do you have any
  claimed community" + the workspace cookie — i.e. the legacy claimer model still governs.
- **It is over-scoped.** The code carries a 4-tier collaborator model (`COMMUNITY_ADMIN / ADMIN /
COLLABORATOR / VIEWER`) and a 4-level capability ladder, while the blueprint reduced this
  to **two roles** (Organizer + Collaborator). That extra machinery is the main thing to
  trim — consistent with "don't over-engineer."
- **Submission approval is misaligned.** `approveSubmission` still uses the old admin
  `grantOwnership` checkbox, sets a **global `User.role`**, and (unlike claim) does **not**
  write a `CommunityCollaborator` COMMUNITY_ADMIN row — contradicting both the new declared-relationship
  submission doc and the community-scoped grant the claim path now uses.

So the path forward is: **simplify roles → align submission → roll out the flag → backfill +
test**. Very little net-new code.

---

## 4. What Is Good ✅

- **Single people list, including the organizer.** `CommunityCollaborator`
  ([apps/web/prisma/schema.prisma](../apps/web/prisma/schema.prisma)) is the authoritative
  membership record; the organizer is the `COMMUNITY_ADMIN` row, mirrored by `Community.claimedByUserId`.
  This resolves the old "split source of truth" gap.
- **Claim approval grants community-scoped authority, not a global role** (flag on).
  `approveClaim` in [apps/web/src/app/admin/(dashboard)/actions.ts](<../apps/web/src/app/admin/(dashboard)/actions.ts>)
  upserts a `COMMUNITY_ADMIN` membership + `ContentLog(ROLE_GRANTED)` instead of granting a global role.
- **Scoped platform authority.** `RoleAssignment` (cityId / reserved orgId, `grantedBy`,
  `revokedAt`) plus `can()` in [apps/web/src/lib/auth/permissions.ts](../apps/web/src/lib/auth/permissions.ts)
  require a matching scoped assignment for `CITY_AMBASSADOR`. Admin/ambassador
  actions consistently call `assertCan(...)`.
- **Atomic transfer + last-owner protection.** `transferOwnership` in
  [apps/web/src/app/organizer/collaborators/actions.ts](../apps/web/src/app/organizer/collaborators/actions.ts)
  is transactional, demotes the prior owner, promotes the target, and keeps
  `claimedByUserId` in sync; `removeCollaborator` / `setCollaboratorRole` refuse to touch the
  `COMMUNITY_ADMIN` row.
- **Authority changes are recorded.** `ContentLog` actions `ROLE_GRANTED` / `ROLE_REVOKED`
  are written by set-role, remove, transfer, and claim-approval; analytics
  `COMMUNITY_ROLE_CHANGED` fires alongside.
- **Public request + admin moderation exist.** `PUBLIC_REQUEST` (request-to-help) is written
  in [apps/web/src/app/[city]/communities/[slug]/actions.ts](../apps/web/src/app/%5Bcity%5D/communities/%5Bslug%5D/actions.ts)
  and moderated by `approveCollaboratorRequest`.

---

## 5. Gaps ❌

### 5.1 RBAC v2 is off by default and barely gates edit actions ❌

`FLAGS.communityRbacV2` ([apps/web/src/lib/config/flags.ts](../apps/web/src/lib/config/flags.ts))
is **default OFF** ("kill-switch only"). Organizer edit actions (e.g. `addChannel` /
`deleteChannel` in [apps/web/src/app/organizer/channels/actions.ts](../apps/web/src/app/organizer/channels/actions.ts))
only call `canEditCommunity` **when the flag is on**. With it off, the only gate is
`user.claimedCommunities.length === 0` plus the workspace cookie. **Result:** the new
authority layer governs nothing in production today; the legacy claimer model is still live.

**Fix:** decide rollout. Either make `canEditCommunity` / `canManageCommunity` the
unconditional path (and treat the flag as a true kill-switch over real enforcement), or
ship the flag on. Today it reads as scaffolding that never took over.

### 5.2 Submission approval contradicts the revised model ❌

`approveSubmission` ([apps/web/src/app/admin/(dashboard)/actions.ts](<../apps/web/src/app/admin/(dashboard)/actions.ts>))
still:

- keys off a admin **`grantOwnership` checkbox** (the old model the submission doc just
  replaced with a _declared relationship_),
- on grant sets a **global `User.role = 'COMMUNITY_ADMIN'`**, and
- does **not** write a `CommunityCollaborator` COMMUNITY_ADMIN row — even with the flag on — unlike
  `approveClaim`.

This is inconsistent with [COMMUNITY_SUBMISSION_FLOW.md](./COMMUNITY_SUBMISSION_FLOW.md)
(now: "I help run this" → organizer; "I'm just adding it" → published & claimable; suggested
organizer → invite-to-claim) and reintroduces the global-role grant the claim path removed.

**Fix:** align submission to the declared-relationship outcomes and, where it grants an
organizer, mirror `approveClaim` (membership row + `ContentLog`, no global role). The form
still posts `ownershipIntent`; move it to the relationship field.

### 5.3 Inconsistent flag-gating across governance actions ❌

`inviteCollaborator` gates `canManageCommunity` **behind the flag**, but `setCollaboratorRole`
/ `removeCollaborator` / `transferOwnership` enforce **unconditionally**. So with the flag
off, invite has no authority check beyond "a claimed community exists." Pick one policy and
apply it uniformly.

### 5.4 No seed/backfill of COMMUNITY_ADMIN membership rows ❌

Seeds ([apps/web/prisma/directory.ts](../apps/web/prisma/directory.ts)) create only
`UNCLAIMED` communities; no claimed community with a `COMMUNITY_ADMIN` `CommunityCollaborator` is
seeded, and there is no evidence of a backfill for existing claimed communities. The flag-on
path is therefore unexercised by seed data, and turning the flag on without a backfill would
strand existing organizers (their authority lives only in `claimedByUserId`, which the helpers
fall back to — but role-bearing reads would see no row).

**Fix:** backfill a `COMMUNITY_ADMIN` row for every `claimedByUserId`, and seed at least one claimed
community for local/testing parity.

### 5.5 Governance actions lack integration tests ❌

Auth unit tests exist ([apps/web/src/lib/auth/**tests**/permissions.test.ts](../apps/web/src/lib/auth/__tests__/permissions.test.ts),
[community-permissions.test.ts](../apps/web/src/lib/auth/__tests__/community-permissions.test.ts)),
but there are no action-level tests for invite / set-role / remove / transfer or for the
claim/submission dual-write. The riskiest paths (escalation, transfer, last-owner protection)
are untested end-to-end.

---

## 6. Over-Engineered 🔶

### 6.1 Four-tier collaborator model vs. two roles 🔶

`enum CollaboratorRole { COMMUNITY_ADMIN ADMIN COLLABORATOR VIEWER }` and the matching
`view / edit / manage / own` ladder in
[apps/web/src/lib/auth/community-permissions.ts](../apps/web/src/lib/auth/community-permissions.ts)
exceed the blueprint, which is **Organizer + Collaborator** only (§5.1 of the model doc).
`ADMIN` and `VIEWER` are not in the product plan. `ASSIGNABLE_ROLES = ['ADMIN',
'COLLABORATOR', 'VIEWER']` and the role picker in `inviteCollaborator` expose tiers that
don't exist for users.

**Fix:** collapse to `COMMUNITY_ADMIN` (= organizer) + `COLLABORATOR`. Drop `ADMIN`/`VIEWER`, simplify
`MANAGE_ROLES`/`EDIT_ROLES`, and make invite role-less.

### 6.2 `setCollaboratorRole` as a tier-changer 🔶

With a single collaborator role, there is no "promote to admin / demote to viewer." The only
role move in the product is **transfer** (organizer). `setCollaboratorRole` exists solely to
service the 4-tier model and ca be removed once roles are collapsed.

### 6.3 Premature `UserRole` values 🔶

`UserRole` includes `EVENT_HOST` and `PARTNER_ORG_ADMIN`, which the blueprint lists as
**future** (§11/§12), not MVP. Harmless but speculative — keep only if a near-term pla needs
them; otherwise defer.

### 6.4 Redundant `CommunityStatus.CLAIMED` 🔶

`enum CommunityStatus { ACTIVE INACTIVE UNVERIFIED CLAIMED }` duplicates ownership state that
`ClaimState` already owns. [COMMUNITY_CLAIM_FLOW.md](./COMMUNITY_CLAIM_FLOW.md) explicitly
says status should not carry `CLAIMED`. Remove the value (it invites two-field drift).

---

## 7. Under-Engineered 🔻

### 7.1 Transfer demotes to ADMIN, not collaborator 🔻

`transferOwnership` demotes the outgoing owner to `ADMIN`, but the blueprint (Flow G) says the
outgoing organizer steps down to **collaborator**. Once `ADMIN` is removed (6.1), demote to
`COLLABORATOR`.

### 7.2 "Exactly one organizer" is procedural, not guaranteed 🔻

Single-owner is enforced by code (`updateMany COMMUNITY_ADMIN→ADMIN` then promote) but not by a DB
constraint. A partial unique index on `(communityId)` where `role = COMMUNITY_ADMIN` would make the
"one organizer" invariant structural rather tha dependent on call-site correctness.

---

## 8. Verdict Summary

| Area                                                  | Verdict | Detail                                                    | Action                                     |
| ----------------------------------------------------- | :-----: | --------------------------------------------------------- | ------------------------------------------ |
| `CommunityCollaborator` people list (incl. organizer) |   ✅    | Single source of truth implemented                        | Keep                                       |
| Claim approval → membership row + audit (flag on)     |   ✅    | Grants scoped authority, not a global role                | Keep                                       |
| Scoped `RoleAssignment` + `can()`/`assertCan()`       |   ✅    | City-scoped enforcement present                           | Keep                                       |
| Atomic transfer + last-owner protection               |   ✅    | Transactional, syncs pointer                              | Keep                                       |
| `ContentLog` ROLE_GRANTED/REVOKED                     |   ✅    | Changes recorded                                          | Keep                                       |
| RBAC v2 off by default; edit actions barely gated     |   ❌    | Legacy claimer model still governs                        | Roll out / unconditionally enforce         |
| Submission approval (checkbox + global role, no row)  |   ❌    | Contradicts revised model & the claim path's scoped grant | Align to declared-relationship             |
| Inconsistent flag-gating across governance actions    |   ❌    | Invite gated, others not                                  | Unify policy                               |
| No seed/backfill of COMMUNITY_ADMIN rows              |   ❌    | Flag-on path unexercised                                  | Backfill + seed                            |
| No integration tests for governance actions           |   ❌    | Riskiest paths untested                                   | Add tests                                  |
| 4-tier `CollaboratorRole` + capability ladder         |   🔶    | Blueprint wants 2 roles                                   | Collapse to COMMUNITY_ADMIN + COLLABORATOR |
| `setCollaboratorRole` tier-changer                    |   🔶    | Only transfer is needed                                   | Remove with role collapse                  |
| `EVENT_HOST` / `PARTNER_ORG_ADMIN`                    |   🔶    | Future per blueprint                                      | Defer unless planned                       |
| `CommunityStatus.CLAIMED`                             |   🔶    | Duplicates `ClaimState`                                   | Remove value                               |
| Transfer demotes to ADMIN                             |   🔻    | Blueprint says collaborator                               | Demote to COLLABORATOR                     |
| One-organizer not DB-enforced                         |   🔻    | Procedural only                                           | Partial unique index                       |

---

## 9. What Should NOT Change

- **The flows.** Submission, claim, invite, request-to-help, transfer, and review match the
  flow docs — keep the journeys.
- **Low-friction, email-first claim.** Keep it.
- **Seeded, claimable (`UNCLAIMED`) communities.** Keep this as a intended state.
- **The `RoleAssignment` + `can()`/`assertCan()` platform layer.** It is correct and scoped;
  do not rebuild it.

The work is **simplify + wire up + align submission**, not redesign.

---

## 10. Recommended Order of Work

1. **Collapse `CollaboratorRole` to `COMMUNITY_ADMIN` + `COLLABORATOR`** (6.1, 6.2, 7.1). Removes the
   bulk of the over-engineering and simplifies every downstream check.
2. **Align submission approval** to the declared-relationship model and mirror `approveClaim`
   (5.2). Removes the last global-role grant.
3. **Decide the flag's role and enforce uniformly** (5.1, 5.3) — make community-permission
   checks the real, unconditional path.
4. **Backfill `COMMUNITY_ADMIN` rows + seed a claimed community** (5.4) before flipping on.
5. **Add governance integration tests** (5.5).
6. **Cleanup enums** — drop `CommunityStatus.CLAIMED`; defer `EVENT_HOST`/`PARTNER_ORG_ADMIN`
   (6.3, 6.4). Optionally add the one-organizer DB constraint (7.2).

---

## 11. Related Documents

- [RBAC_AND_AUTHORIZATION.md](./RBAC_AND_AUTHORIZATION.md) — the target role model
- [RBAC_FLOW_MAPPING.md](./RBAC_FLOW_MAPPING.md) — the target per-flow outcomes
