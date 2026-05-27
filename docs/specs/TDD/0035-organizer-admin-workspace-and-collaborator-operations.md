# TDD-0035: Organizer admin workspace and collaborator operations

- **Status:** Draft
- **Linked PRD:** PRD-0035
- **Owner:** Founders

## 1. Architecture overview

This feature standardizes organizer web routes around an active-community workspace contract.

Core architectural goals:

- All organizer page loaders and server actions resolve the same active community.
- Collaborator management becomes a first-class organizer surface.
- Community event operations gain a dedicated list surface in organizer.
- Legacy organizer routes remain functional through redirects.

Primary components touched:

- `apps/web/src/lib/session.ts`
- `apps/web/src/app/organizer/layout.tsx`
- `apps/web/src/app/organizer/page.tsx`
- `apps/web/src/app/organizer/communities/page.tsx`
- `apps/web/src/app/organizer/profile/*` or redirects from `edit/*`
- `apps/web/src/app/organizer/links/*` or redirects from `channels/*`
- `apps/web/src/app/organizer/collaborators/*`
- `apps/web/src/app/organizer/events/*`
- admin collaborator moderation surfaces

## 2. Data model changes

No new mandatory schema changes are required for baseline organizer workspace IA if collaborator table already exists.

Expected existing contracts:

- `Community.claimedByUserId`
- `Community.claimState`
- `CommunityCollaborator`
- `CommunityCollaborator.status`
- `CommunityCollaborator.source`

Optional follow-up fields if needed for UX completeness:

- none in v1 baseline

Indexes to verify:

- collaborator unique `(communityId, userId)`
- collaborator lookup on `(communityId, status)`
- collaborator lookup on `(requestedEmail, status)`
- event lookup on `(communityId, startsAt)`

## 3. API surface

No public API contract is required for v1 if organizer remains server-rendered with server actions.

Server action / route contracts:

| Method | Path                                 | Auth                                 | Request                        | Response                        |
| ------ | ------------------------------------ | ------------------------------------ | ------------------------------ | ------------------------------- |
| POST   | `/organizer/switch`                  | organizer session                    | `communityId`, optional `next` | 303 redirect to organizer path  |
| POST   | organizer profile action             | organizer session + active community | profile fields                 | success/error state             |
| POST   | organizer links action               | organizer session + active community | channel fields                 | success/error state             |
| POST   | organizer collaborator invite action | organizer session + active community | email, note                    | success/error state             |
| POST   | organizer event create action        | organizer session + active community | event fields                   | success/error state or redirect |

## 4. Web screens & navigation

Organizer route graph:

- `/organizer`
- `/organizer/communities`
- `/organizer/profile`
- `/organizer/links`
- `/organizer/collaborators`
- `/organizer/events`
- `/organizer/events/new`

Redirects:

- `/organizer/edit` -> `/organizer/profile`
- `/organizer/channels` -> `/organizer/links`

Navigation contract:

- shared organizer shell shows active workspace identity on all workspace routes
- all page loaders call shared active community resolver
- all mutations verify the same active community contract before write

## 5. Push / Email / Inbox triggers

Required email triggers already partially exist and must be aligned with organizer workflow:

- collaborator approved email to collaborator
- collaborator approved notification to owner/organizer
- collaborator rejected email to collaborator
- collaborator rejected notification to owner/organizer

No push requirement in v1.

## 6. Feature flags

Recommended flags:

- `organizer_workspace_v2`
- `organizer_collaborators_page_v1`
- `organizer_events_list_v1`

Default behavior:

- old routes remain available until new surfaces are validated
- redirect behavior can be gated if phased rollout is needed

Kill-switch behavior:

- disable new routes/pages and fall back to existing organizer routes without touching auth/session model

## 7. Observability

Metrics/events:

- `organizer_workspace_opened`
- `organizer_workspace_switched`
- `organizer_collaborator_invited`
- `organizer_collaborator_invite_duplicate`
- `organizer_collaborator_request_approved`
- `organizer_event_created`
- `organizer_context_mismatch_blocked`

Logs / diagnostics:

- log active community resolution failures
- log invalid switch attempts
- log blocked writes where form community/context does not match resolved workspace

Sentry tags:

- `surface=organizer`
- `communityId`
- `organizerRole=owner|collaborator|admin`

## 8. Failure modes & fallbacks

- Missing active community cookie:
  - resolve first accessible community deterministically
- Invalid active community cookie:
  - ignore cookie, fall back safely, emit diagnostic event
- User loses access to previously active community:
  - reset workspace and redirect to valid organizer context
- Duplicate collaborator invite:
  - return success-state messaging, no duplicate membership
- Admin moderation delay:
  - pending status remains visible in collaborator UI
- Route mismatch during rollout:
  - redirect legacy routes to canonical routes

## 9. Test plan

- Unit:
  - active community resolver behavior
  - invalid cookie fallback behavior
  - collaborator invite idempotency
  - permission checks for owner/collaborator/admin
- Integration:
  - switching communities changes page context and write target
  - profile save writes only to active community
  - links add/delete operate only on active community
  - collaborator invite creates or reuses pending row correctly
  - events list filters by active community only
- E2E (Playwright web):
  - multi-community organizer switch flow
  - collaborator invite flow from organizer UI
  - legacy route redirect behavior
  - mobile navigation access to critical routes
- Load:
  - not required for v1

## 10. Rollout plan

1. Introduce shared active community resolver and route scaffolds behind flags.
2. Ship canonical routes with redirects disabled or internal-only first.
3. Enable collaborators page.
4. Enable events list page.
5. Turn on redirects from legacy routes.
6. Monitor analytics, support incidents, and context mismatch metrics.

## 11. Backout plan

- Disable organizer workspace v2 flags.
- Revert redirects to legacy routes if needed.
- Keep collaborator data model and admin moderation intact.
- Preserve session and workspace cookie behavior unless it is root cause of failure.
