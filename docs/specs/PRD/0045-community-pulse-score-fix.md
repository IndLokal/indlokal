# PRD-0045: Community Pulse Score – Bug Fixes

- **Status:** Implemented
- **Owner:** Jay
- **Linked:** TDD-0045

## 1. Problem

Communities across cities display "Low activity" in the card UI despite having events and/or
being claimed and well-described. Root cause: three compounding bugs in the scoring pipeline.

**Bug A (Critical):** `Community.lastActivityAt` is never written by any production code path
(organizer event creation, pipeline approval, profile edit). The recency sub-component (0–40 pts,
the single largest contributor) therefore always evaluates to 0 for every community.

**Bug B:** Event count queries in `refreshAllScores` / `refreshCommunityScore` do not filter on
`moderationState: 'PUBLISHED'`, so PENDING_REVIEW host events inflate counts without representing
real public activity.

**Bug C (UX):** The badge component uses raw `activityScore` (currently always 0) rather than the
composite `pulseScore`. A claimed, well-described community with no events yet looks identical to a
blank unclaimed stub.

## 2. Success Metrics

- Zero communities showing "Low activity" solely because `lastActivityAt` is null
- Claimed + well-described communities achieve ≥ Moderate badge without requiring events
- Communities with recent published events reflect accurate recency in their score

## 3. Scope

- Derive `latestSignal` from `max(lastActivityAt, latestPublishedEventAt)` inside scoring queries (no migration)
- Badge (`PulseBadge`) uses `pulseScore = activityScore×0.5 + completenessScore×0.3 + trustScore×0.2`
- `computeFreshnessState` uses the same signal anchor (fixes DORMANT demotion for active communities)
- Write `Community.lastActivityAt` on organizer event creation and pipeline event approval
- Filter all event count sub-queries to `moderationState: 'PUBLISHED'`
- Cap recency at 40 pts to prevent future-dated events from exceeding the component maximum

## 4. Out of Scope

- New DB columns or migrations
- Cold-start grace scoring (artificially inflates low-quality seeded listings)
- Reading `ActivitySignal` in scoring (deferred to engagement layer, TDD-0041)
- View-count weighting changes
- Mobile badge changes
