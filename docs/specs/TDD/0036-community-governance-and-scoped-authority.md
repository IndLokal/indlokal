# TDD-0036: Community governance & scoped authority

- **Date:** 2026-05-29
- **Status:** Accepted
- **Linked:** PRD-0036, ADR-0008, ADR-0005
- **Audit:** [docs/RBAC_AUDIT.md](../../RBAC_AUDIT.md)

## Architecture

Community authority is read from a single role-bearing table, `CommunityCollaborator`, through
[apps/web/src/lib/auth/community-permissions.ts](../../../apps/web/src/lib/auth/community-permissions.ts).
The helper returns the caller's role for a community (`COMMUNITY_ADMIN` | `COLLABORATOR` | `null`), with a
`claimedByUserId → COMMUNITY_ADMIN` fallback and a `PLATFORM_ADMIN` fast-path. Every community write
(`organizer/edit`, `organizer/channels`, `organizer/events/new`, collaborator management) calls it
unconditionally — there is no feature flag.

## Data model changes

`apps/web/prisma/schema.prisma`:

- `enum CollaboratorRole` collapses from `COMMUNITY_ADMIN | ADMIN | COLLABORATOR | VIEWER` to **`COMMUNITY_ADMIN |
COLLABORATOR`**.
- `CommunityCollaborator.role` keeps `@default(COLLABORATOR)`.
- **One organizer per community** is enforced at the application layer (claim/submission approval
  and transfer). A DB partial unique index (`UNIQUE (community_id) WHERE role = 'COMMUNITY_ADMIN'`) is
  deferred: Prisma cannot represent partial indexes in `schema.prisma`, so a raw one would be
  flagged as drift by `prisma migrate dev`.
- `enum CommunityStatus` keeps its value `CLAIMED` physically (removing a Postgres enum value
  mid-history is a heavyweight swap with no behavioral payoff), but it is **deprecated and never
  written** — ownership state lives in `claimState` + the `COMMUNITY_ADMIN` row. Documented with a schema
  comment.

## Migration

Edit the not-yet-applied migration
`apps/web/prisma/migrations/20260529120000_collaborator_roles/migration.sql` in place (it is dated
today and was never rolled out):

1. `CREATE TYPE "CollaboratorRole" AS ENUM ('COMMUNITY_ADMIN', 'COLLABORATOR');` (two values from the start —
   avoids a enum-remap migration).
2. Add the `role` column with `DEFAULT 'COLLABORATOR'` and the `(community_id, role)` index.
3. **Backfill:** insert one `COMMUNITY_ADMIN` row per claimed community
   (`claimed_by_user_id IS NOT NULL AND claim_state = 'CLAIMED'`), `ON CONFLICT` upsert to
   `COMMUNITY_ADMIN/ACTIVE`.
4. Best-effort `ContentLog` `ROLE_GRANTED` backfill for active memberships.

Dev backout: `git revert` the code change and `pnpm prisma migrate reset`.

## API surface

`apps/web/src/app/organizer/collaborators/actions.ts`:

- `inviteCollaborator` — role-less (always creates a `COLLABORATOR` request); remove the
  `role`/`ASSIGNABLE_ROLES` input; enforce `canManageCommunity` unconditionally.
- `resendCollaboratorInvite` — OWNER-only resend for `COMMUNITY_ADMIN_INVITE` + `PENDING`, with
  server cooldown and metadata timestamp (`inviteEmailLastSentAt`) to avoid accidental duplicate sends.
- `setCollaboratorRole` — **deleted** (no tiers to set).
- `removeCollaborator` — kept; refuses to remove the `COMMUNITY_ADMIN`; enforces `canManageCommunity`.
- `transferOwnership` — kept; demotes outgoing `COMMUNITY_ADMIN → COLLABORATOR` (was `ADMIN`); promotes target
  to `COMMUNITY_ADMIN`; syncs `claimedByUserId`; logs.

`apps/web/src/app/organizer/collaborators/accept/route.ts`:

- `GET` stores handoff token/invite and renders a scanner-safe confirmation page.
- `POST` requires explicit user submit, validates invite + token in one transaction, consumes token
  only after invite checks, activates collaborator, and signs user in.

`apps/web/src/app/admin/(dashboard)/actions.ts`:

- `approveClaim` — single membership-row path: upsert `COMMUNITY_ADMIN` row + `ContentLog ROLE_GRANTED` + set
  `claimState=CLAIMED`/`claimedByUserId`. Remove the legacy `User.role = COMMUNITY_ADMIN` branch and
  the flag check.
- `approveSubmission` — when granting organizer access, mirror `approveClaim` (create `COMMUNITY_ADMIN` row +
  log, set claim fields); **do not** set `User.role = COMMUNITY_ADMIN`. The admin's "grant" control
  defaults from the submitter's declared relationship.

`apps/web/src/app/organizer/login/actions.ts`:

- Gate organizer login on **community relationship**, not `User.role`: allow `PLATFORM_ADMIN`, or a
  user with ≥1 `CLAIMED` community, or ≥1 `ACTIVE` collaborator membership. Removes the
  `COMMUNITY_ADMIN | EVENT_HOST` role check.

`apps/web/src/lib/validation.ts` + submit form/action:

- Replace `ownershipIntent: boolean` with `relationship: 'HELP_RUN' | 'JUST_ADDING'`
  (default `JUST_ADDING`). Stored under `metadata.submitter.relationship`.

## Mobile screens / Push / Email / Inbox

No mobile, push, or inbox changes. Existing organizer/claim emails are unchanged. Submission-received
email is unchanged.

## Feature flags

`COMMUNITY_RBAC_V2` (`FLAGS.communityRbacV2`) is **removed**. Community-permission checks become the
only path. All `if (FLAGS.communityRbacV2 && ...)` guards are replaced with the unconditional check.

## Observability

- `Events.COMMUNITY_ROLE_CHANGED` continues to fire on invite/remove/transfer.
- `ContentLog` `ROLE_GRANTED` / `ROLE_REVOKED` rows on every grant/revoke/transfer.

## Failure modes

- **Org without a backfilled COMMUNITY_ADMIN row:** `getCommunityRole` `claimedByUserId → COMMUNITY_ADMIN` fallback keeps
  them working until the row exists.
- **Duplicate organizer:** the grant/transfer paths demote or upsert so a second `COMMUNITY_ADMIN` is not
  created; the `(community_id, user_id)` unique key prevents duplicate rows for the same user.
- **DB unreachable on login/session:** existing graceful "no session"/vague-error handling is kept.

## Test plan

`apps/web/src/lib/auth/__tests__/community-permissions.test.ts`:

- Rewrite the role matrix to two roles: `COMMUNITY_ADMIN` → view/edit/manage/own; `COLLABORATOR` →
  view/edit only; no membership → all false; `PLATFORM_ADMIN` → all true; `claimedByUserId`
  fallback → owner.

New governance tests (server actions, with mocked `db`):

- Invite creates a `COLLABORATOR` request and requires manage rights.
- `removeCollaborator` refuses the `COMMUNITY_ADMIN`.
- `transferOwnership` promotes target to `COMMUNITY_ADMIN` and demotes the prior owner to `COLLABORATOR`.
- `approveClaim` / `approveSubmission` (grant) create a `COMMUNITY_ADMIN` row and do not change `User.role`.

## Rollout plan

- Edit the unapplied migration in place; apply on deploy. No staged flag rollout — enforcement is
  unconditional and made safe by the backfill + fallback.

## Backout plan

- `git revert` the change set. In dev, `pnpm prisma migrate reset` to rebuild the schema. No
  production data has the new enum until deploy.
