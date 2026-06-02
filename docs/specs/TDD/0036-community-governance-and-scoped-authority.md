# TDD-0036: Community governance & scoped authority

- **Date:** 2026-05-29
- **Status:** Accepted
- **Linked:** PRD-0036, ADR-0008, ADR-0005
- **Audit:** [docs/RBAC_AUDIT.md](../../RBAC_AUDIT.md)

## Architecture

Community authority is split between the primary-owner pointer (`Community.claimedByUserId`) and a
single role-bearing table, `CommunityCollaborator`, through
[apps/web/src/lib/auth/community-permissions.ts](../../../apps/web/src/lib/auth/community-permissions.ts).
The helper returns the caller's role for a community (`COMMUNITY_ADMIN` | `COLLABORATOR` | `null`), with a
`claimedByUserId` ownership fallback and a `PLATFORM_ADMIN` fast-path. Every community write
(`organizer/edit`, `organizer/channels`, `organizer/events/new`) calls it unconditionally; the
member-management actions additionally require the primary owner.

## Data model changes

`apps/web/prisma/schema.prisma`:

- `enum CollaboratorRole` collapses from `COMMUNITY_ADMIN | ADMIN | COLLABORATOR | VIEWER` to **`COMMUNITY_ADMIN |
COLLABORATOR`**.
- `CommunityCollaborator.role` keeps `@default(COLLABORATOR)`.
- **One primary owner per community** is enforced by `Community.claimedByUserId`. Multiple
  `COMMUNITY_ADMIN` rows may exist for delegated admins.
- `enum CommunityStatus` keeps its value `CLAIMED` physically (removing a Postgres enum value
  mid-history is a heavyweight swap with no behavioral payoff), but it is **deprecated and never
  written** — ownership state lives in `claimState` + `claimedByUserId`. Documented with a schema
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

- `inviteCollaborator` — role-less (always creates a `COLLABORATOR` request); enforce
  `canManageCommunity` on the primary owner.
- `resendCollaboratorInvite` — OWNER-only resend for `COMMUNITY_ADMIN_INVITE` + `PENDING`, with
  server cooldown and metadata timestamp (`inviteEmailLastSentAt`) to avoid accidental duplicate sends.
- `demoteAdminToCollaborator` — demotes a delegated admin from `COMMUNITY_ADMIN` to `COLLABORATOR`.
- `removeCollaborator` — kept; refuses to remove the primary owner; enforces `canManageCommunity`.
- `transferOwnership` — kept; demotes outgoing `COMMUNITY_ADMIN → COLLABORATOR`; promotes target
  to `COMMUNITY_ADMIN`; syncs `claimedByUserId`; logs.

`apps/web/src/app/organizer/collaborators/accept/route.ts`:

- `GET` stores handoff token/invite and renders a scanner-safe confirmation page.
- `POST` requires explicit user submit, validates invite + token in one transaction, consumes token
  only after invite checks, activates collaborator, and signs user in.

`apps/web/src/app/admin/(dashboard)/actions.ts`:

- `approveClaim` — primary-owner path: set `claimState=CLAIMED`/`claimedByUserId` and upsert a
  `COMMUNITY_ADMIN` row for organizer-level access; write `ContentLog ROLE_GRANTED`.
- `approveSubmission` — when granting organizer access, mirror `approveClaim` (create or upsert a
  `COMMUNITY_ADMIN` row + log, set claim fields); **do not** set `User.role = COMMUNITY_ADMIN`. The
  admin's "grant" control defaults from the submitter's declared relationship.

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
- **Duplicate primary owner:** the grant/transfer paths keep `claimedByUserId` in sync so a second
  primary owner is not created; the `(community_id, user_id)` unique key prevents duplicate rows for the same user.
- **DB unreachable on login/session:** existing graceful "no session"/vague-error handling is kept.

## Test plan

`apps/web/src/lib/auth/__tests__/community-permissions.test.ts`:

- Rewrite the role matrix so `COMMUNITY_ADMIN` is delegated admin access (view/edit only unless the
  user is the primary owner); `COLLABORATOR` → view/edit only; no membership → all false;
  `PLATFORM_ADMIN` → all true; `claimedByUserId` fallback → owner/manage.

New governance tests (server actions, with mocked `db`):

- Invite creates a `COLLABORATOR` request and requires the primary owner.
- `removeCollaborator` refuses the primary owner.
- `transferOwnership` promotes target to `COMMUNITY_ADMIN` and demotes the prior owner to `COLLABORATOR`.
- `approveClaim` / `approveSubmission` (grant) create a `COMMUNITY_ADMIN` row and do not change `User.role`.

## Rollout plan

- Edit the unapplied migration in place; apply on deploy. No staged flag rollout — enforcement is
  unconditional and made safe by the backfill + fallback.

## Backout plan

- `git revert` the change set. In dev, `pnpm prisma migrate reset` to rebuild the schema. No
  production data has the new enum until deploy.
