# TDD-0060: Contribution Attribution & "My Contributions"

- **Status:** Approved
- **Linked PRD:** PRD-0060
- **Depends on:** TDD-0009 (submit), TDD-0057 (contribution intake), TDD-0059 (me export)
- **Owner:** Engineering

## 1. Architecture overview

This is a **normalization + read-model** change, not a new subsystem. No schema
migration: every attribution field already exists and is indexed.

```
Public contribution action          Actor attribution (session-first)
──────────────────────────          ─────────────────────────────────
submitCommunity   ───────────────▶  Community.createdByUserId = session.id | null
suggestCommunity  ───────────────▶  ContentReport.reporterUserId + PipelineItem.submittedBy
reportIssue       ───────────────▶  ContentReport.reporterUserId
contributeEvent   ───────────────▶  ContentReport.reporterUserId + PipelineItem.submittedBy
                                     (Event.createdByUserId stays null — not a host)

getMyContributions(userId) ─ unions ─▶  Community.createdByUserId == userId (COMMUNITY_SUBMITTED)
                                        ContentReport.reporterUserId == userId (SUGGEST_*)
                                          ↳ joined to Event for status/href when eventId present
                              ─▶ /me "Your contributions" section
```

Single source of truth for attribution: `getSessionUser()`. Contact email/name
are never used to derive the actor.

Components touched:

- `apps/web/src/app/submit/actions.ts` — session-first; remove ghost-user upsert.
- `apps/web/src/app/actions/reports.ts` — attribute `suggestCommunity`, `reportIssue`.
- `apps/web/src/app/actions/contributions.ts` — no behavior change; covered by tests/invariants.
- `apps/web/src/lib/contributions/my-contributions.ts` — **new** read model.
- `apps/web/src/app/me/page.tsx` — **new** "Your contributions" section.

## 2. Data model changes

**None.** Fields used (all existing, all nullable, all indexed where queried):

- `Community.createdByUserId` (relation `CreatedCommunities`, `@@index`).
- `ContentReport.reporterUserId` (relation `ReporterUser`, `@@index([reporterUserId])`).
- `ContentReport.eventId` (relation `EventReports`, `@@index([eventId])`).
- `PipelineItem.submittedBy`.
- `Event.moderationState`, `Event.slug`, `Community.status`, `Community.slug`.

Rationale for reusing existing fields rather than adding `submittedByUserId`/
`suggestedByUserId`: `Community.createdByUserId` already means "the user who
created/submitted this community" (used by PRD-0059 export as `createdCommunities`),
and `ContentReport.reporterUserId` already means "the authenticated user behind
this report/suggestion". Adding parallel columns would duplicate meaning and
require a migration for no behavioral gain — explicitly rejected as
over-engineering.

## 3. Module surface

New pure-ish read model (DB read only, no mutations):

```ts
// apps/web/src/lib/contributions/my-contributions.ts
export type ContributionKind = 'COMMUNITY' | 'EVENT';
export type ContributionStatus = 'UNDER_REVIEW' | 'PUBLISHED' | 'NEEDS_CHANGES';

export interface MyContribution {
  id: string; // stable per-source id
  kind: ContributionKind;
  title: string;
  status: ContributionStatus;
  href: string | null; // public link when a published entity exists
  citySlug: string | null;
  createdAt: Date;
}

export async function getMyContributions(
  userId: string,
  opts?: { limit?: number },
): Promise<MyContribution[]>;
```

Union sources (deduped, newest first, capped by `limit`, default 50):

1. **Communities submitted by the user** — `Community` where
   `createdByUserId == userId AND source == 'COMMUNITY_SUBMITTED'`. Status maps
   from `Community.status`: `ACTIVE → PUBLISHED`, `UNVERIFIED → UNDER_REVIEW`,
   `INACTIVE → NEEDS_CHANGES`. `href` only when status is `PUBLISHED`.
2. **Event / community suggestions by the user** — `ContentReport` where
   `reporterUserId == userId AND reportType IN ('SUGGEST_EVENT','SUGGEST_COMMUNITY')`.
   For `SUGGEST_EVENT` joined to `event`: status maps from
   `Event.moderationState` (`PUBLISHED → PUBLISHED`, `REJECTED → NEEDS_CHANGES`,
   else `UNDER_REVIEW`); `href` when the event is `PUBLISHED`. `SUGGEST_COMMUNITY`
   reports have no entity yet → always `UNDER_REVIEW`, `href: null`.

To avoid double counting, community **submissions** (source 1) and community
**suggestions** (source 2, `SUGGEST_COMMUNITY`) are distinct rows by design — a
submission produces a `Community` row, a suggestion produces only a
`ContentReport`. Host-owned events (`Event.createdByUserId == userId`) are **not**
included; they belong to the host workspace, not the contributor list.

The function reads via the shared `db` client and is resilient: a failure is
caught by the caller (`/me` already wraps list loading in try/catch).

## 4. Mobile screens & navigation

No mobile UI in this TDD. The read-model types are intentionally serializable so a
future `GET /api/v1/me/contributions` can reuse the same shape.

## 5. Push / Email / Inbox triggers

None.

## 6. Feature flags

None. Attribution correctness and a read-only `/me` section are low-risk and ship
unflagged, consistent with the existing `/me` account lists.

## 7. Observability

- Reuse existing `CONTRIBUTION_SUBMITTED` analytics (already carries
  `isAuthenticated` / actor distinctId). No new events.
- `submitCommunity` continues to emit `COMMUNITY_SUBMITTED`; analytics distinctId
  becomes the session user id when authenticated (previously always `anonymous`).

## 8. Failure modes & fallbacks

- **DB read failure in `getMyContributions`:** caller catches and renders the
  empty state (matches existing `/me` fallback for account lists).
- **No session in a contribution action:** attribution is `null`; the contribution
  still succeeds (anonymous path unchanged in behavior except no ghost user).
- **Contact email upsert removed:** community submit no longer depends on a writable
  `users` table for the contact email; one fewer failure point.

## 9. Test plan

- **Unit:**
  - Status-mapping helpers (community status → ContributionStatus; event
    moderationState → ContributionStatus) are pure and table-tested.
- **Integration (`@db`):**
  - `submitCommunity` with a session user whose account email ≠ contact email →
    `Community.createdByUserId == session.id`; **no** new `User` created from the
    contact email; contact email present in `metadata.submitter.email`.
  - `submitCommunity` anonymous → `createdByUserId == null`, submission succeeds.
  - `suggestCommunity` / `reportIssue` with session → `reporterUserId == session.id`.
  - `getMyContributions` unions a submitted community + an event suggestion for the
    user, scoped to that user (does not leak other users' contributions), ordered
    newest-first, and maps statuses correctly.
- **Regression:**
  - `contributeEvent` still sets `reporterUserId` + `submittedBy` and leaves
    `Event.createdByUserId` null.
  - Existing `/submit` and organizer/host event creation unchanged.

## 10. Rollout plan

Ship in one change. No flag. Attribution applies to new contributions going
forward; historical rows are unaffected (no backfill).

## 11. Backout plan

Revert the PR. No migration to undo, no data cleanup required. Removing the `/me`
section and reverting the action edits fully restores prior behavior.
