# TDD-0045: Community Pulse Score – Bug Fixes

- **Status:** Implemented
- **Linked PRD:** PRD-0045

## 1. Architecture overview

Pure-logic changes in `scoring.ts` + minor UI changes in badge/card/queries. No schema
migration required. Two orthogonal concerns:

1. **Scoring correctness** — `latestSignal` derived from DB at score-refresh time
2. **Badge UX** — composite `pulseScore` replaces raw `activityScore`

## 2. Data model changes

None. All fixes operate on existing columns (`activityScore`, `completenessScore`, `trustScore`,
`lastActivityAt`, `createdAt`, `Event.moderationState`).

## 3. Key design decisions

### D1 – Derive effective recency from events in scoring queries (not `lastActivityAt` writes only)

`Community.lastActivityAt` is the canonical recency store, but it is expensive to write atomically
on every event creation / approval path. Instead, both `refreshAllScores` and
`refreshCommunityScore` now batch-fetch `MAX(event.startsAt)` per community (PUBLISHED events only)
and compute:

```
effectiveLastActivityAt = max(lastActivityAt, latestPublishedEventAt)
```

This fixes the recency component immediately for all 24 communities without requiring
`lastActivityAt` to be pre-populated.

### D2 – PulseBadge (composite, not activityScore)

`pulseScore = activityScore×0.5 + completenessScore×0.3 + trustScore×0.2`

Computed client-side from three already-stored columns. No DB column added.
Thresholds: ≥ 80 Very Active · ≥ 60 Active · ≥ 40 Moderate · else Low activity.
Same formula applied on mobile in the Pulse Score card.

### D4 – Recency cap

Add `Math.min(40, ...)` to recency calculation so communities with a future event scheduled
(startsAt > now → negative daysAgo) don't exceed the 40-pt component maximum.

### D5 – PUBLISHED event filter

All event count sub-queries in scoring add `moderationState: 'PUBLISHED'` to prevent
PENDING_REVIEW host events from inflating activity.

## 4. Function signatures changed

```ts
// scoring.ts
computeActivityBreakdown(input: {
  eventsLast90Days: number;
  lastActivityAt: Date | null;
  viewsLast30Days?: number;
  latestPublishedEventAt?: Date | null;   // NEW – latestSignal recency anchor
})

computeFreshnessState(
  lastActivityAt: Date | null,
  latestPublishedEventAt?: Date | null,   // NEW – same anchor for demotion logic
)

// Badge.tsx
PulseBadge({ pulseScore: number })
```

`computeActivityScore` signature is unchanged (it delegates to `computeActivityBreakdown`);
existing callers without the new fields continue to work.

## 5. Files changed

| File                                                  | Change                                                                     |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `src/modules/scoring/scoring.ts`                      | latestSignal recency anchor, PUBLISHED filter, latestEventDate batch fetch |
| `src/components/ui/Badge.tsx`                         | ActivityBadge → PulseBadge, composite pulseScore thresholds                |
| `src/modules/community/queries.ts`                    | add `createdAt: true` to community list selects                            |
| `src/modules/discovery/queries.ts`                    | add `createdAt: true` to trendingCommunitySelect                           |
| `src/components/CommunityCard.tsx`                    | compute pulseScore, pass to PulseBadge                                     |
| `src/app/[city]/communities/[slug]/page.tsx`          | update badge call                                                          |
| `src/app/organizer/(community)/events/new/actions.ts` | write `lastActivityAt`                                                     |
| `src/modules/pipeline/review.ts`                      | bump `lastActivityAt` + score on event approval                            |
| `src/modules/scoring/__tests__/scoring.test.ts`       | add latestSignal + recency cap tests                                       |
| `apps/mobile/app/communities/[slug].tsx`              | fix pulseScore formula (was simple avg, now weighted)                      |

## 6. Test plan

- Unit: `scoring.test.ts` — latestSignal override, recency cap, PUBLISHED filter passthrough, zero-signal baseline
- Integration: existing `refresh.integration.test.ts` (unchanged — still passes with new optional params)
- Manual: run score refresh cron against dev DB, verify communities with published events show Moderate or better
