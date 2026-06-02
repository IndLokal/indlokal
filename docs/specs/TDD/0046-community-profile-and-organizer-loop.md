# TDD-0046: Community Profile and Organizer Edit Loop

Status: Draft
Date: 2026-06-02
Related: PRD-0046

## Scope

Files:

1. apps/web/src/app/organizer/(community)/edit/EditProfileForm.tsx
2. apps/web/src/app/organizer/(community)/edit/actions.ts
3. apps/web/src/app/[city]/communities/[slug]/page.tsx
4. apps/web/src/app/organizer/(community)/profile/page.tsx
5. apps/web/src/app/organizer/(community)/profile/CityChangeRequestForm.tsx
6. apps/web/src/app/admin/(dashboard)/claims/page.tsx
7. apps/web/src/app/admin/(dashboard)/actions.ts

## Design

### Organizer Edit Form

1. Add logo URL input (`logoUrl`) for public profile branding.
2. Add persona-segment multi-select (`personaSegments[]`) using shared constants.
3. Add profile readiness block with quality checklist and direct links to:
   - /organizer/links
   - /organizer/events/new

### Organizer Edit Action

1. Extend Zod schema to include:
   - `logoUrl?: string` (URL or empty)
   - `personaSegments: string[]`
2. Persist both fields via `db.community.update`.
3. Keep existing revalidation and scoring refresh behavior.

### Organizer City Change UI

1. Render city-change card in organizer profile for authorized owner-level maintainers.
2. Use searchable city picker interaction aligned with submit-community UX.
3. Collect `cityId`, `reason`, optional `evidenceUrl`.
4. Show pending-state banner when request status is pending.

### Organizer City Change Action Policy

1. Validate user session and owner-level community authority.
2. Resolve source and target city metro keys as:
   - `metroKey = city.metroRegionId ?? city.id`
3. Apply policy:
   - If source and target metro keys match: auto-approve and apply immediately.
   - Else: store pending `cityChangeRequest` for admin moderation.
4. Always revalidate organizer profile; revalidate city discovery paths when city is changed.
5. Reject organizer submission when a previous city-change request is already pending.
6. Auto-approved same-metro moves write a community content-log entry for audit traceability.

### Admin Moderation for City Change

1. Claims page reads communities where `metadata.cityChangeRequest.status = PENDING`.
2. Approve action updates `community.cityId`, marks request approved, revalidates old/new city routes.
3. Reject action marks request rejected and revalidates organizer/admin surfaces.
4. Queue copy explicitly indicates cross-region changes need moderation.

### Public Community Page

1. Compute persona labels from shared persona label map.
2. Render “Who this is for” section when persona segments exist.
3. Show “Edit public profile” shortcut for authorized maintainers using `canEditCommunity`.

## Data Impact

1. Writes existing columns only (`logoUrl`, `personaSegments`).
2. Reuses `Community.metadata` JSON for:
   - `cityChangeRequest` object (pending/approved/rejected state)
3. No migration.

## Test Plan

1. `pnpm -F web typecheck` passes.
2. Manual organizer flow:
   - Update logo/persona on /organizer/profile
   - Verify persisted values on public page.
3. Manual public flow:
   - Authorized user sees edit shortcut.
   - Non-authorized users do not.
4. Manual city-change flow:
   - Same-metro move applies immediately, no admin queue item.
   - Any cross-region move creates pending admin queue item.
5. Manual admin flow:
   - Approve pending item moves community city and route pages resolve correctly.
   - Reject pending item keeps current city and marks request rejected.

## Backout

1. Revert organizer profile/edit/public-page/admin-claims changes introduced for this spec.
2. No data backfill required.
