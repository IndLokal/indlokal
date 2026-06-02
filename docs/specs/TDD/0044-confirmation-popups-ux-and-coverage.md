# TDD-0044: Confirmation Popups UX and Coverage

- **Status:** Implemented
- **Linked PRD:** PRD-0044
- **Owner:** Product Engineering

## 1. Architecture

A reusable client component is used as the standard confirmation gate for
form-based server actions:

- `apps/web/src/components/ui/ConfirmSubmitButton.tsx`

Pattern:

1. Trigger button (`type=button`) opens modal state.
2. Confirm button invokes `form.requestSubmit()` on the nearest parent form.
3. Cancel/backdrop/Escape closes without mutation.

This preserves existing server action contracts and avoids per-page bespoke
modal logic.

## 2. Component Contract

`ConfirmSubmitButton` props:

- `triggerLabel`
- `title`
- `description?`
- `confirmLabel?`
- `cancelLabel?`
- `triggerClassName?`
- `tone?: 'danger' | 'primary' | 'neutral'`
- `disabled?`

Exported through:

- `apps/web/src/components/ui/index.ts`

## 3. Mobile UX Fixes

Implemented in shared component:

- Full-screen modal container with scroll-safe behavior (`overflow-y-auto`).
- Bottom-aligned on small screens, centered on larger screens.
- Internal max-height content region with independent scrolling.
- Sticky action footer with safe-area bottom padding.
- Full-width stacked action buttons on mobile; compact row on desktop.
- Body scroll lock while modal is open.
- Escape-key close support.

## 4. Applied Coverage (Implemented)

### Admin

- `apps/web/src/app/admin/(dashboard)/claims/page.tsx`
- `apps/web/src/app/admin/(dashboard)/events/page.tsx`
- `apps/web/src/app/admin/(dashboard)/submissions/page.tsx`
- `apps/web/src/app/admin/(dashboard)/submissions/ApproveSubmissionForm.tsx`
- `apps/web/src/app/admin/(dashboard)/collaborators/page.tsx`
- `apps/web/src/app/admin/(dashboard)/reports/page.tsx`
- `apps/web/src/app/admin/(dashboard)/pipeline/page.tsx` (revert auto-approvals)
- `apps/web/src/app/admin/(dashboard)/data/communities/page.tsx` (delete)
- `apps/web/src/app/admin/(dashboard)/data/events/page.tsx` (delete)
- `apps/web/src/app/admin/(dashboard)/data/resources/page.tsx` (delete)

### Organizer

- `apps/web/src/app/organizer/(community)/collaborators/page.tsx`
- `apps/web/src/app/organizer/(community)/channels/ChannelsForm.tsx`
- `apps/web/src/app/organizer/(community)/events/[slug]/page.tsx`
- `apps/web/src/app/organizer/host/events/[slug]/page.tsx`

## 5. Console Audit Outcome

Audited scopes:

- Admin console
- Organizer console
- Ambassador console
- Submission review surfaces

Findings:

- Ambassador console currently has no destructive/moderation forms that require
  confirmation in this implementation scope.
- Additional admin operations remain suitable for follow-up coverage (for
  example city active toggle and selected bulk pipeline actions).

## 6. Test Plan

- Typecheck web:
  - `pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`
- Run focused governance tests:
  - `pnpm --dir apps/web exec vitest run src/lib/auth/__tests__/community-permissions.test.ts src/app/organizer/(community)/collaborators/__tests__/governance.integration.test.ts`
- Manual QA:
  - Verify confirm/cancel behavior on desktop and mobile viewport widths.
  - Verify backdrop, cancel, and Escape close paths.
  - Verify confirm executes form action exactly once.

## 7. Rollout and Backout

Rollout:

- Shipped as one integrated popup-guard feature using a shared UI component
  with scoped page adoption.

Backout:

- Revert per-page usage to direct submit buttons while keeping shared component
  in codebase (non-breaking).
- Or revert component + usages together if required.
