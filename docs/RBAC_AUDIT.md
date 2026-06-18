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
- Submission/admin approval wording now uses organizer-access terminology (`grantOrganizerAccess`) and new submissions use relationship-first intent (legacy reads remain for backward compatibility).
- Governance integration tests exist for collaborator flows.

### Open Findings

1. Multi-admin semantics are ambiguous.

- Current implementation allows promoting additional `COMMUNITY_ADMIN` members.
- Some comments/docs still read as single-owner/single-admin.
- References: [apps/web/src/app/organizer/(community)/collaborators/actions.ts](<../apps/web/src/app/organizer/(community)/collaborators/actions.ts>), [apps/web/src/lib/auth/community-permissions.ts](../apps/web/src/lib/auth/community-permissions.ts)

2. `CommunityStatus.CLAIMED` remains as deprecated enum debt.

- Intentional compatibility hold; ownership state is `ClaimState`-driven.
- Reference: [apps/web/prisma/schema.prisma](../apps/web/prisma/schema.prisma)

## Actions

1. Decide and codify owner vs delegated-admin semantics.
2. Decide whether to keep or remove deprecated `CommunityStatus.CLAIMED` enum value.
3. Keep this file brief and refresh only when behavior changes.

## Decision Log

- 2026-06-18: replaced stale legacy audit with concise current snapshot.
- 2026-06-18: marked submission approval wording as resolved (`grantOrganizerAccess` rename + relationship-first submission intent metadata).
