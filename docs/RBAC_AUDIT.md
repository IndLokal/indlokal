# RBAC Audit (Current Snapshot)

Status: Active  
Reviewed on: 2026-06-18

Use this as a short implementation audit. For full auth/session architecture, see [AUTHENTICATION_AND_AUTHORIZATION_ARCHITECTURE.md](./AUTHENTICATION_AND_AUTHORIZATION_ARCHITECTURE.md).

## Scope

- Role model target: [RBAC_AND_AUTHORIZATION.md](./RBAC_AND_AUTHORIZATION.md)
- Flow target: [RBAC_FLOW_MAPPING.md](./RBAC_FLOW_MAPPING.md)

## Current State

### Confirmed Good

- RBAC is not behind a dedicated `communityRbacV2` runtime flag.
- Collaborator schema role model is two-role (`COMMUNITY_ADMIN`, `COLLABORATOR`).
- Submission and claim approvals grant community-scoped authority rows and write role audit events.
- Governance integration tests exist for collaborator flows.

### Open Findings

1. Multi-admin semantics are ambiguous.

- Current implementation allows promoting additional `COMMUNITY_ADMIN` members.
- Some comments/docs still read as single-owner/single-admin.
- References: [apps/web/src/app/organizer/(community)/collaborators/actions.ts](<../apps/web/src/app/organizer/(community)/collaborators/actions.ts>), [apps/web/src/lib/auth/community-permissions.ts](../apps/web/src/lib/auth/community-permissions.ts)

2. Submission approval wording still carries legacy ownership terminology.

- Behavior is relationship-based, but UI/variable wording still includes `grantOwnership` and compatibility `ownershipIntent` metadata.
- References: [apps/web/src/app/submit/actions.ts](../apps/web/src/app/submit/actions.ts), [apps/web/src/app/admin/(dashboard)/submissions/ApproveSubmissionForm.tsx](<../apps/web/src/app/admin/(dashboard)/submissions/ApproveSubmissionForm.tsx>)

3. `CommunityStatus.CLAIMED` remains as deprecated enum debt.

- Intentional compatibility hold; ownership state is `ClaimState`-driven.
- Reference: [apps/web/prisma/schema.prisma](../apps/web/prisma/schema.prisma)

## Actions

1. Decide and codify owner vs delegated-admin semantics.
2. Rename legacy ownership wording in admin/submission surfaces.
3. Keep this file brief and refresh only when behavior changes.

## Decision Log

- 2026-06-18: replaced stale legacy audit with concise current snapshot.
