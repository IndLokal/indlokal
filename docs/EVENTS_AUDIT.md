# Events Implementation Audit (Code vs Blueprint)

## 1. Purpose and Scope

This document audits the **actual event implementation** against the target model in
[EVENTS_AND_LIFECYCLE.md](./EVENTS_AND_LIFECYCLE.md). It checks the schema, the three event
creation paths, the public read queries, the moderation/review surfaces, seeds, and tests,
and reports **what is good, what is a gap, what is over-engineered, and what is
under-engineered**.

Findings are code-grounded and reference real files; this is the single source of truth for
the events audit. Implementation work is specced in
[docs/specs/PRD/0037-event-governance-and-approval-model.md](./specs/PRD/0037-event-governance-and-approval-model.md)
and its TDD.

**Headline:** events have a solid base entity and a clean community-trusted creation path,
but governance is **half-built and self-contradictory**: independent **host events are
written straight to the live feed** despite UI copy promising review, public read queries do
**no moderation filtering at all**, "Pending review" badges are **faked from trust signals**
rather than a real moderation state, and there is **no admin review queue or moderation
field** on the event. The fix is to make moderation a **first-class axis** on the event,
gate reads on it, and replace the trust-signal heuristic — not to rebuild events.

---

## 2. How to Read This

- ✅ **Good** — implemented and matches the blueprint; keep it.
- ❌ **Gap** — missing, unwired, or contradicts the blueprint; should be fixed.
- 🔶 **Over-engineered** — more machinery than the MVP blueprint asks for; simplify.
- 🔻 **Under-engineered** — present but incomplete vs the blueprint; finish it.

---

## 3. Executive Summary

- **The event entity is sound.** `Event` ([apps/web/prisma/schema.prisma](../apps/web/prisma/schema.prisma))
  has city, optional community, time fields, recurrence, and a `source` provenance enum. It is
  a good base.
- **The community-trusted lane is correct.** `createEvent`
  ([apps/web/src/app/organizer/events/new/actions.ts](../apps/web/src/app/organizer/events/new/actions.ts))
  gates on `canEditCommunity` and publishes directly — exactly the blueprint's §6.1
  community-trusted lane.
- **But the host lane lies.** `createHostEvent`
  ([apps/web/src/app/organizer/host/events/new/actions.ts](../apps/web/src/app/organizer/host/events/new/actions.ts))
  writes the event row immediately with `source: 'USER_SUGGESTED'` and a comment "needs
  review", yet there is **no review state and nothing holds it back** — it is publicly
  visible the moment it is written.
- **Reads enforce nothing.** Every public query in
  [apps/web/src/modules/event/queries.ts](../apps/web/src/modules/event/queries.ts) filters
  only `status: { not: 'CANCELLED' }`. There is **no moderation gate**, so host/pipeline events
  appear in discovery, search, and city feeds with no approval.
- **Status is conflated and faked.** The blueprint's two axes (moderation vs lifecycle) are
  collapsed onto the single `EventStatus` time enum, and "Pending review / Verified" chips on
  the organizer and host list pages are derived from `trustSignals.length` — a trust badge
  standing in for a moderation decision that doesn't exist.
- **No accountable creator on the event.** Host attribution lives in `Event.metadata.hostUserId`
  (free-form JSON), not a first-class column — unlike `Community.createdByUserId`. This blocks
  the future event-organizer model and makes host queries rely on JSON path matching.
- **No review queue, no review record, no tests.** There is no admin events-moderation queue,
  no approve/reject action, no reviewer/decision fields, and no governance tests.

Path forward: **add a moderation axis + first-class creator → gate reads → build the review
queue → replace trust-signal chips → seed + test.** Mostly wiring, little net-new modelling.

---

## 4. What Is Good ✅

- **Solid base entity.** `Event` carries city (required), community (optional), full time/venue
  fields, `isRecurring` + `recurrenceRule`, and useful indexes (`[cityId, startsAt]`,
  `[communityId, startsAt]`, `[status]`). It is ready to grow a moderation axis without reshaping.
- **Community-trusted lane is exactly right.** `createEvent` authorizes with
  `canEditCommunity(user, community.id)` (the RBAC v2 community layer), stamps
  `source: 'COMMUNITY_SUBMITTED'`, and publishes immediately — the intended zero-friction path
  for accountable organizers.
- **Provenance enum already exists.** `ContentSource { ADMIN_SEED, COMMUNITY_SUBMITTED, IMPORTED,
USER_SUGGESTED }` gives events a source today; community events and host events are already
  distinguishable by it.
- **Anti-flood guardrail exists.** `createHostEvent` enforces `HOST_UNVERIFIED_CAP = 5` outstanding
  events per host — the right instinct (blueprint §9.7), just attached to a review state that
  doesn't really exist yet.
- **Public submissions are correctly queued, not published.** `submit/service.ts` routes public
  event submissions into `PipelineItem` (PENDING), not straight into `Event` — the one path that
  already honours "vet before public".

---

## 5. Gaps ❌

### 5.1 No moderation state on the event ❌

`Event` has only `EventStatus { UPCOMING, ONGOING, PAST, CANCELLED }` — a **time/lifecycle**
enum. There is no field answering "may this be seen?" The blueprint's moderation axis
(`Published / Pending review / Rejected`, §5.1) does not exist. Everything below stems from
this.

**Fix:** add a first-class moderation state (e.g. `EventModerationState { PUBLISHED,
PENDING_REVIEW, REJECTED }`) plus a review record (reviewer, decided-at, reason), orthogonal to
`EventStatus`. See TDD-0037 §2.

### 5.2 Host events publish immediately despite "needs review" ❌

`createHostEvent` writes the `Event` row with `source: 'USER_SUGGESTED'` and the comment
"unverified host submission - needs review", but **nothing holds it back** — no pending state,
and reads don't filter it. The product copy promises review that never happens. This is the
most serious correctness/trust defect.

**Fix:** host events must be created `PENDING_REVIEW` and excluded from public reads until a
platform reviewer approves (blueprint §6.2).

### 5.3 Public read queries do no moderation filtering ❌

Every list/detail query in [apps/web/src/modules/event/queries.ts](../apps/web/src/modules/event/queries.ts)
gates on `status: { not: 'CANCELLED' }` only (lines 65, 84, 144, 208…). There is no moderation
predicate, so any row in the table is public.

**Fix:** add `moderationState: 'PUBLISHED'` to every public read (detail, city feed, search,
related). Organizer/host/admin reads use their own scoped predicates.

### 5.4 "Pending review / Verified" chips are faked from trust signals ❌

The organizer and host event list pages derive the review chip from `trustSignals.length`
rather than a moderation decision. A trust badge (a quality signal) is being used to fake a
governance state (an approval). The two are unrelated (blueprint §4.1, §5).

**Fix:** render chips from the real `moderationState`; keep `TrustSignal` for what it is — trust,
not authority/approval.

### 5.5 No admin event review queue or approve/reject action ❌

There is no admin surface listing `PENDING_REVIEW` events and no `approveEvent` / `rejectEvent`
server action, even though hosts and the pipeline are meant to feed one. (Community/claim
moderation queues exist; events have none.)

**Fix:** add an admin events-moderation queue gated by `pipeline.approve` (or a new
`events.review`), with approve/reject writing the moderation state + `ContentLog` + host
notification.

### 5.6 Host attribution is buried in JSON, not first-class ❌

Host identity lives in `Event.metadata.hostUserId`, queried via `metadata: { path:
['hostUserId'], equals: user.id }`. `Community` already solved this with a real
`createdByUserId` column. JSON-path matching is unindexed, fragile, and blocks the
future-organizer model (blueprint §8, §11).

**Fix:** add `Event.createdByUserId` (nullable FK to `User`) as the accountable-creator field;
backfill from `metadata.hostUserId`.

### 5.7 No governance tests ❌

There are no tests asserting: community events publish directly, host events land
`PENDING_REVIEW` and stay out of public reads, approve/reject transitions, or the host cap.
The riskiest governance paths are entirely untested.

**Fix:** add action + query integration tests per TDD-0037 §test-plan.

---

## 6. Over-Engineered 🔶

### 6.1 Trust-signal machinery doing governance work 🔶

Using polymorphic `TrustSignal` rows to imply "verified/pending" is more moving parts than the
problem needs, and it conflates two concepts. A single `moderationState` enum replaces the
heuristic and is simpler to read and reason about. Keep `TrustSignal` for genuine trust badges
only.

### 6.2 `HOST_UNVERIFIED_CAP` keyed on a non-existent state 🔶

The cap counts "unverified upcoming" events using `status: 'UPCOMING'` as a proxy for
"un-reviewed". Once a real `PENDING_REVIEW` state exists, the cap should count _that_ — the
current proxy is incidental complexity standing in for the missing field.

---

## 7. Under-Engineered 🔻

### 7.1 `ContentSource` cannot distinguish the review sub-lanes 🔻

Host submissions, public submissions, and ambassador submissions all collapse toward
`USER_SUGGESTED` / pipeline, so the review queue can't tell a known host from an anonymous
submission or prioritise an ambassador fast-track (blueprint §6.3). For MVP this is acceptable,
but the source taxonomy should be nudged so the lane is derivable (e.g. distinct values or a
companion field). Don't build per-source workflows yet — just keep the lane recoverable.

### 7.2 No review record on approval/rejection 🔻

Even where review is intended, there is nowhere to record _who_ decided, _when_, and _why
(on reject)_. The blueprint (§9.6) requires every decision to be logged; the event needs
reviewer/decided-at/reason fields plus a `ContentLog` entry.

### 7.3 Material-edit re-review not modelled 🔻

The blueprint (§9.4) sends a published **host** event back to review when its date/venue/title
changes. There is no edit-diff or re-review trigger today. MVP can ship without it, but the
moderation field should be designed so flipping back to `PENDING_REVIEW` is trivial.

---

## 8. Target Model (summary)

The remediation converges on the blueprint's two-axis model:

- **Moderation axis** — `EventModerationState { PUBLISHED, PENDING_REVIEW, REJECTED }`, first-class
  on `Event`, plus `reviewedById` / `reviewedAt` / `reviewReason`.
- **Lifecycle axis** — keep `EventStatus { UPCOMING, ONGOING, PAST, CANCELLED }` unchanged.
- **Accountable creator** — add `Event.createdByUserId`; retire `metadata.hostUserId`.
- **Read gate** — public reads require `moderationState = PUBLISHED` (and `status != CANCELLED`).
- **Lanes** — community path → `PUBLISHED` on create; host/public/ambassador/pipeline →
  `PENDING_REVIEW` → admin approve/reject.
- **Future organizer** — `createdByUserId` is the seed for an `EventCollaborator` people list later,
  reusing the `CommunityCollaborator` pattern (blueprint §8.2). Not built in MVP.

---

## 9. Remediation Plan (sequence)

1. **Schema** — add `EventModerationState`, `moderationState`, `reviewedById`, `reviewedAt`,
   `reviewReason`, `createdByUserId`; index `[moderationState]` and `[createdByUserId]`.
2. **Backfill** — existing rows → `PUBLISHED`; copy `metadata.hostUserId` → `createdByUserId`.
3. **Writes** — community lane stays `PUBLISHED`; host lane → `PENDING_REVIEW`; cap counts
   `PENDING_REVIEW`.
4. **Reads** — add `moderationState: 'PUBLISHED'` to all public queries.
5. **Review queue** — admin list + `approveEvent` / `rejectEvent` (`ContentLog` + notification).
6. **Surfaces** — replace trust-signal chips with `moderationState`.
7. **Seed** — at least one community (published) event and one host (`PENDING_REVIEW`) event.
8. **Tests** — lane outcomes, read gating, approve/reject, cap.

All steps are specced in TDD-0037.
