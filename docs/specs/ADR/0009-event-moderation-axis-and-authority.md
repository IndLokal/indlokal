# ADR-0009: Event moderation is a first-class axis, orthogonal to lifecycle, with creator-based authority

- **Date:** 2026-05-31
- **Status:** Accepted
- **Linked:** ADR-0005 (platform roles), ADR-0008 (community membership), PRD/TDD-0037
- **Blueprint:** [docs/EVENTS_AND_LIFECYCLE.md](../../EVENTS_AND_LIFECYCLE.md)
- **Audit:** [docs/EVENTS_AUDIT.md](../../EVENTS_AUDIT.md)

## Context

The events blueprint ([EVENTS_AND_LIFECYCLE.md](../../EVENTS_AND_LIFECYCLE.md)) defines an
event as living on **two independent axes**: _moderation_ (may it be seen?) and _lifecycle_
(where is it in time?). The audit ([EVENTS_AUDIT.md](../../EVENTS_AUDIT.md)) found that the
implementation collapses both onto the single `EventStatus` time enum and fakes the moderation
state from `TrustSignal` rows, with three concrete consequences:

1. **Host events publish immediately** despite "needs review" copy — `createHostEvent` writes an
   `Event` row that public reads never filter.
2. **Public reads enforce nothing** — `event/queries.ts` gates only on `status != CANCELLED`.
3. **Authority/attribution is buried in JSON** — host identity lives in
   `Event.metadata.hostUserId`, unlike `Community.createdByUserId`, blocking the future
   event-organizer model.

We need a small, flexible model that fixes governance without over-building toward features
(co-hosts, ticketing, recurring-series governance) that are out of MVP scope.

## Decision

1. **Moderation is a first-class axis on `Event`, separate from lifecycle.** Add
   `EventModerationState { PUBLISHED, PENDING_REVIEW, REJECTED }`. `EventStatus { UPCOMING,
ONGOING, PAST, CANCELLED }` stays unchanged as the time axis. The two are orthogonal; a row is
   publicly visible only when `moderationState = PUBLISHED` **and** `status != CANCELLED`.

2. **Three moderation states, not four.** We deliberately do **not** split `AUTO_PUBLISHED` vs
   `APPROVED`. Both are simply `PUBLISHED`; _how_ a row became published (trusted-on-create vs
   reviewer-approved) is **provenance**, derivable from `source` + the `ContentLog` review record —
   not a distinct visibility state. This keeps the enum minimal (anti-over-engineering) while
   staying flexible.

3. **The lane is decided by source, enforced on create.**
   - Community lane (`canEditCommunity`) → `PUBLISHED` on create.
   - Host / public / ambassador / pipeline → `PENDING_REVIEW` on create; a platform reviewer
     moves it to `PUBLISHED` or `REJECTED`.

4. **Reads enforce visibility, not screens.** Every public query adds
   `moderationState: 'PUBLISHED'`. Organizer/host/admin reads use scoped predicates.

5. **Accountable creator is first-class.** Add `Event.createdByUserId` (nullable FK to `User`),
   mirroring `Community.createdByUserId`. Backfill from `metadata.hostUserId` and retire the JSON
   path. This is the attribution the "Hosted by…" block and future authority hang off.

6. **A review record lives on the event.** Add `reviewedById`, `reviewedAt`, `reviewReason`;
   every decision also writes a `ContentLog` entry (who/when/why) and, for host events, a
   notification.

7. **Event authority reuses the community pattern, but is not built yet.** For MVP:
   - community events are governed by **community authority** (`canEditCommunity`) — inherited, no
     event-level role;
   - host events are governed by **their single creator** (`createdByUserId`).
     The model is shaped so a future `EventCollaborator` people list (one event organizer + co-hosts)
     can attach to `Event` exactly as `CommunityCollaborator` attaches to `Community` (ADR-0008),
     without reshaping existing rows.

## Consequences

**Positive**

- One truthful moderation axis replaces the trust-signal heuristic; status labels stop lying.
- Host events are genuinely vetted before public; reads are safe by construction.
- First-class `createdByUserId` unblocks the future event-organizer model and removes fragile
  JSON-path queries.
- Minimal enum + reused authority pattern keeps the MVP lean but extensible.

**Negative / trade-offs**

- Requires a migration + backfill (existing rows → `PUBLISHED`; `metadata.hostUserId` →
  `createdByUserId`).
- Provenance (auto vs reviewed) is derived, not a column — analytics must read `source` +
  `ContentLog` rather than a single enum value. Accepted: avoids a redundant state.
- No DB-level guarantee that a host event has a creator (nullable FK); enforced in the write path,
  consistent with how ADR-0008 handles the single-organizer invariant.

**Deferred (explicitly not decided here)**

- `EventCollaborator` / event co-hosts (future; reuse ADR-0008 pattern).
- Material-edit re-review automation (blueprint §9.4) — the field supports it; the trigger is
  future work.
- Per-source review workflows / ambassador fast-track prioritisation beyond queue ordering.
