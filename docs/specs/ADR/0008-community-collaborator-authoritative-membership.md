# ADR-0008: CommunityCollaborator is the authoritative, role-bearing community membership

- **Date:** 2026-05-29
- **Status:** Accepted
- **Linked:** ADR-0005 (platform roles), PRD/TDD-0036
- **Audit:** [docs/RBAC_AND_AUTHORIZATION.md](../../RBAC_AND_AUTHORIZATION.md), [docs/RBAC_AUDIT.md](../../RBAC_AUDIT.md)

## Context

The product blueprint ([RBAC_AND_AUTHORIZATION.md](../../RBAC_AND_AUTHORIZATION.md)) defines
**community authority** with exactly two roles: a **Organizer** (one per claimed community)
and **Collaborators** (people who help run it). Platform authority is a separate, scoped layer
already covered by ADR-0005 (`RoleAssignment`).

The audit ([RBAC_AUDIT.md](../../RBAC_AUDIT.md)) found two problems with how community authority
was implemented:

1. **Split / implicit source of truth.** "Who ca manage this community?" was answered partly
   by `Community.claimedByUserId` and partly by a global `User.role = COMMUNITY_ADMIN`. A
   profile-level role was used as a permission, granting power over communities the account does
   not run, and blurring the line between community and platform authority.
2. **Over-engineering.** An earlier iteration shipped a four-tier collaborator model
   (`COMMUNITY_ADMIN / ADMIN / COLLABORATOR / VIEWER`) and a four-level capability ladder, far beyond the
   two roles the blueprint asks for.

We need a single, role-bearing record for community membership that the backend reads for every
community write, and we must keep it **as small as the blueprint** — two roles, no more.

## Decision

1. **`CommunityCollaborator` is the authoritative, role-bearing membership table.** Every person
   with authority over a community — including the organizer — has a row. The organizer is the
   single `COMMUNITY_ADMIN` row; everyone else is a `COLLABORATOR`.
2. **`CollaboratorRole` has exactly two values: `COMMUNITY_ADMIN` and `COLLABORATOR`.** "Organizer" in the
   product maps to `COMMUNITY_ADMIN`. No `ADMIN`/`VIEWER` tiers.
3. **One organizer per community.** `Community.claimedByUserId` mirrors the single `COMMUNITY_ADMIN` row, and
   the write paths (claim/submission approval, transfer) guarantee at most one `COMMUNITY_ADMIN`. A DB-level
   partial unique index is deferred because Prisma cannot express partial indexes in the schema
   (a raw one would be reported as drift by `migrate dev`).
4. **`User.role` is never a community permission.** Community writes authorize against
   `CommunityCollaborator` via `lib/auth/community-permissions.ts`. `User.role` remains for
   display and for the **platform** layer (ADR-0005) only. Granting a organizer creates an
   `COMMUNITY_ADMIN` row — never a global `COMMUNITY_ADMIN`.
5. **Every authority change is recorded** in `ContentLog` (`ROLE_GRANTED` / `ROLE_REVOKED`).
6. **Enforcement is unconditional.** There is no `COMMUNITY_RBAC_V2` flag; the community-authority
   helpers are the only path. A `claimedByUserId` fallback in the helpers keeps any not-yet
   backfilled owner working, and the migration backfills `COMMUNITY_ADMIN` rows for all claimed communities.

## Consequences

- **Positive**
  - One place answers "who ca manage this community?" — the membership table, with the organizer
    in it.
  - The model matches the blueprint exactly (two roles); less surface to maintain, test, and reason
    about.
  - Profile role is fully decoupled from community permission, closing the cross-community
    escalation gap.
  - "Exactly one organizer" is upheld by the grant/transfer paths and the `ON CONFLICT` backfill.
- **Negative**
  - Removing the four-tier enum and the flag is a one-time migration + code change touching the
    organizer/admin write paths.
  - Organizer login ca no longer key off `User.role`; it must read the membership/claim relation.
- **Neutral**
  - `EVENT_HOST` / `PARTNER_ORG_ADMIN` remain in `UserRole` as future platform roles (ADR-0005);
    they are out of scope here.

## Alternatives considered

- **Keep the four-tier model (`COMMUNITY_ADMIN/ADMIN/COLLABORATOR/VIEWER`).** Rejected: the blueprint is two
  roles; the extra tiers had no product flow and no UI, and added branching to every check.
- **Keep `User.role = COMMUNITY_ADMIN` as the organizer permission.** Rejected: it is account-wide,
  not community-scoped, so it grants power over communities the user does not run.
- **Gate the new model behind a long-lived `COMMUNITY_RBAC_V2` flag.** Rejected: the flag gated
  little real enforcement and left two divergent code paths; a backfill + fallback makes
  unconditional enforcement safe, and `git revert` is the backout.
