# TDD-0038: Event host workspace dashboard

- **Status:** Shipped
- **Linked PRD:** PRD-0038
- **Owner:** Eng

## 1. Architecture overview

No new tables, no migration. The work is a web-only (Next.js App Router) change under
`apps/web/src/app/organizer/host/**`, plus one new server helper and one new server action.

Components touched / added:

- **New** `apps/web/src/lib/organizer/host-workspace.ts` — pure-ish helpers:
  - `getHostProfile(user)` — typed read of `User.metadata.hostProfile`.
  - `computeHostCompleteness(profile, hasEvent)` — completeness items + percentage.
  - `getHostEventStats(userId)` — counts (live / inReview / declined / past / upcoming),
    `unverifiedUpcomingCount`, `nextUpcoming`, and `declined[]` (with `reviewReason`),
    derived from `moderationState` + lifecycle + `createdByUserId`.
- **Rewritten** `apps/web/src/app/organizer/host/page.tsx` — overview using the helper.
- **New** `apps/web/src/app/organizer/host/profile/page.tsx` + `HostProfileForm.tsx` +
  `actions.ts` (`updateHostProfile`).
- **Edited** `apps/web/src/app/organizer/host/layout.tsx` — add "Profile" nav link.
- **New analytics** `HOST_PROFILE_UPDATED` in `apps/web/src/lib/analytics/events.ts`.
- **Seed** `apps/web/prisma/seed.ts` — enrich demo host.

## 2. Data model changes

None. Host profile stays `User.metadata.hostProfile = { displayName, cityId, links[] }`
(PRD-0017). Host events are read via the first-class `Event.createdByUserId`
(PRD-0037 / migration `20260531120000_event_moderation_axis`) and
`Event.moderationState`/`status`/`reviewReason`.

## 3. API surface

No REST endpoints. Server action only:

| Action                              | Auth                             | Request                             | Response                                  |
| ----------------------------------- | -------------------------------- | ----------------------------------- | ----------------------------------------- |
| `updateHostProfile(prev, formData)` | `EVENT_HOST` or `PLATFORM_ADMIN` | `displayName`, `cityId`, `link1..3` | `{ success } \| { success:false, error }` |

Validation via Zod (mirrors `hostStartSchema`): `displayName` 2–100, `cityId` resolves to
an active city, links are optional valid URLs.

## 4. Mobile screens & navigation

None — web organizer portal only.

## 5. Push / Email / Inbox triggers

None.

## 6. Feature flags

None. Ships unconditionally (UI/UX parity; no schema/behavioral risk to existing lanes).

## 7. Observability

- `host_profile_updated` PostHog event on successful profile save.
- Existing `host_event_submitted_for_review` continues to fire from the create flow.

## 8. Failure modes & fallbacks

- Missing `hostProfile` metadata → helper returns sensible defaults from
  `User.displayName`/`cityId`; overview still renders.
- Invalid city on profile save → action returns an error, no write.
- No events → overview shows the empty "post your first event" state.

## 9. Test plan

- **Unit** (`apps/web/src/lib/organizer/__tests__/host-workspace.test.ts`):
  - `computeHostCompleteness` percentages for empty / partial / full profiles.
  - `getHostEventStats` buckets published-upcoming → live, pending → inReview, rejected →
    declined (with reason), past → past; respects `createdByUserId` scoping; ignores other
    users' events. Uses the shared test DB (port 5434).
- **Typecheck + lint** clean.

## 10. Rollout plan

Single release, no flag. Merge → deploy.

## 11. Backout plan

Revert the web changes; no migration to undo. The previous host page is restored by git
revert.
