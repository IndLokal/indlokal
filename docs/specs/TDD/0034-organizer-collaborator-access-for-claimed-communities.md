# TDD-0034: Organizer collaborator access for claimed communities (minimal v1)

- **Status:** Draft
- **Linked PRD:** PRD-0034
- **Owner:** Founders

## 1. Architecture overview

Current model supports one primary owner via `Community.claimedByUserId`.

Minimal extension for v1:

1. Keep `claimedByUserId` unchanged as primary owner.
2. Add collaborator membership table for additional organizers.
3. Add collaborator access request table (pending queue).

## 2. Data model changes

Add table: `CommunityCollaborator`

- `id` (cuid)
- `communityId` (FK)
- `userId` (FK)
- `status` enum: `PENDING | ACTIVE | REJECTED`
- `source` enum/string: `COMMUNITY_ADMIN_INVITE | PUBLIC_REQUEST | ADMIN_ADD`
- `requestedByUserId` nullable
- `requestedEmail` nullable (for pre-account invite flow)
- `createdAt`, `updatedAt`, `reviewedAt`, `reviewedByUserId` nullable

Constraints:

- Unique active membership per `(communityId, userId)`.
- Index `(communityId, status)` and `(requestedEmail, status)`.

No destructive migration to existing ownership fields.

## 3. Core workflows

### 3.1 Request access from claimed community page

File touchpoints:

- `apps/web/src/app/[city]/communities/[slug]/ClaimSection.tsx`
- `apps/web/src/app/[city]/communities/[slug]/actions.ts`

Behavior:

- If `claimState=CLAIMED`, show "Request organizer access" form instead of claim submit.
- Submit creates `CommunityCollaborator(status=PENDING, source=PUBLIC_REQUEST)`.
- Do not change `claimState` or `claimedByUserId`.

### 3.2 Owner invite collaborator

File touchpoints:

- new organizer action in `apps/web/src/app/organizer/...`

Behavior:

- Primary owner (or existing active collaborator) submits collaborator email.
- Upsert user if needed.
- Create pending collaborator request with `source=COMMUNITY_ADMIN_INVITE`.
- Invitee receives an email link and becomes `ACTIVE` on acceptance.

### 3.3 Admin moderation

File touchpoints:

- new admin page or section (claims-like queue)
- admin actions file in dashboard module

Behavior:

- Approve: set request `status=ACTIVE`; ensure user role supports organizer login (`COMMUNITY_ADMIN` or compatible).
- Reject: set request `status=REJECTED`.
- No ownership transfer in this flow.

## 4. Authorization and session behavior

Update organizer auth/session resolution so organizer portal community list includes:

- primary owner communities (`claimedByUserId=user.id`)
- active collaborator communities (`CommunityCollaborator.status=ACTIVE`)

Primary owner remains source of truth for ownership-specific actions (future restriction hooks).

## 5. UI surfaces

1. Claimed community public page:
   - CTA: "Request organizer access"
2. Organizer portal:
   - simple collaborator list + invite input
3. Admin queue:
   - pending collaborator requests with approve/reject

## 6. Observability

Track events:

- `organizer_access_requested` (source, community_id)
- `organizer_access_approved` (source, community_id)
- `organizer_access_rejected` (source, community_id)

## 7. Failure modes

- Duplicate pending request for same user/email + community:
  - return idempotent success message.
- Community merged/inactive during pending request:
  - reject with actionable message.
- Email invite for existing primary owner:
  - no-op with clear message.

## 8. Test plan

Unit:

- request creation rules by source (public vs owner invite)
- approval/rejection transitions

Integration:

- claimed page creates pending collaborator request (no claimState mutation)
- admin approval enables organizer login and community visibility
- owner invite + approve grants collaborator management access

UI:

- CLAIMED page shows access request CTA, not claim form
- organizer collaborator card add flow
- admin queue approve/reject actions

## 9. Rollout / backout

Rollout:

1. migrate schema and deploy read paths behind feature flag
2. enable admin moderation
3. enable public request + owner invite UI

Backout:

- disable feature flag to hide request/invite UI
- keep existing primary-owner claim flow unaffected
