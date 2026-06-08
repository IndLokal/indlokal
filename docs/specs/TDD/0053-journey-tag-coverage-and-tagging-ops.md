# TDD-0053: Journey tag coverage - audit report, backfill, pipeline tag suggestions

- **Status:** Implemented (coverage report + admin backfill GA; pipeline tag suggestions flag-gated, `JOURNEY_TAG_SUGGESTIONS_ENABLED`)
- **Linked PRD:** PRD-0053
- **Linked ADR:** ADR-0011 (composition model), ADR-0007 (resource scope), ADR-0006 (pipeline is ETL)
- **Owner:** Engineering + Content Ops (Phase 2)

## 1. Architecture overview

Three additive workstreams over existing tables and surfaces - **no new content model, no new ingestion
path** (ADR-0011 §6, ADR-0006). Tags are `Resource.audiences[]` / `Resource.lifecycleStage[]` (PRD-0030)
and `Community.personaSegments[]` / `Community.languages[]` (shipped).

```
(1) COVERAGE AUDIT            (2) BACKFILL                     (3) TAGGING-AT-INGESTION
┌────────────────────┐       ┌───────────────────────────┐    ┌───────────────────────────┐
│ scripts/journey-   │       │ admin worklist + edit forms│    │ organizer/host community   │
│ coverage.ts        │       │ (resources: PRD-0030 fields│    │ form: personaSegments field│
│  -> counts vs gate │       │  communities: new persona  │    ├───────────────────────────┤
│  (reuses density)  │       │  field)  -> updateMany     │    │ AI pipeline: emit suggested│
└─────────┬──────────┘       └─────────────┬─────────────┘    │ tags -> review queue        │
          │ reads                          │ writes            │ (PRD/TDD-0013), human approve│
          ▼                                ▼                   └─────────────┬─────────────┘
   db.resource / db.community  <-- invalidateResolver() on save  <-----------┘ approve -> write
```

The coverage report **imports the same `density.ts` gate** from `modules/journeys` (TDD-0052) so "READY"
means exactly "promotable by the engine".

## 2. Data model changes

**None.** All tags already exist:

- `Resource.audiences: ResourceAudience[]`, `Resource.lifecycleStage: ResourceStage[]` (PRD/TDD-0030 §2).
- `Community.personaSegments: String[]`, `Community.languages: String[]` (shipped; PRD-0051 taxonomy).

This TDD only **populates** them and adds tooling. The only persisted-state addition is that
pipeline-suggested tags ride the **existing** review-queue record shape (PRD/TDD-0013) - no new table.
If suggestion provenance needs storing, prefer an additive field on the existing review/extraction
record (TBD with the pipeline owner) rather than a new model.

## 3. Coverage audit (`scripts/journey-coverage.ts`)

A Node script (and an admin-only readout route) that, per city, computes for each persona x stage the
count of journey-eligible components, then grades against the density gate.

```ts
// pnpm journey:coverage --city=stuttgart [--persona=FAMILY] [--json]
interface CoverageCell {
  stage: ResourceStage;
  resourceCount: number; // tagged + scope-resolved for this city/persona/stage
  communityCount: number; // personaSegment-matched, verified-led
  eventCount: number; // PUBLISHED, persona-relevant, upcoming
  total: number;
}
interface CoverageRow {
  persona: JourneyPersona;
  cells: CoverageCell[];
  verdict: 'READY' | 'THIN'; // === density.ts evaluation (TDD-0052 §8)
  gaps: string[]; // e.g. "FAMILY/SETTLED has 1 (<2)"
}
```

Implementation reuses the **journey composition path** in dry-run mode (call `composeJourney` per
persona, count blocks per stage, run the gate) so the report can never diverge from what the engine would
actually render. Output: a console table + optional `--json` for dashboards.

Untagged-row queries for the backfill worklist:

```ts
// resources missing journey tags in a city's resolved set
db.resource.findMany({
  where: {
    /* resolved-for-city */ OR: [
      { audiences: { isEmpty: true } },
      { lifecycleStage: { isEmpty: true } },
    ],
  },
});
// communities missing persona segments in a city
db.community.findMany({ where: { cityId, personaSegments: { isEmpty: true } } });
```

## 4. Backfill surfaces

- **Resources** - `/admin/data/resources` already exposes scope/audiences/lifecycleStage/priority/
  essential (PRD-0030 §7 UX). Add a **filter** (`?gap=untagged|audience|stage`) and a "journey gaps"
  count badge. Saving busts the resolver cache for affected cities (`invalidateResolver()`), so the
  journey reflects the change within the cache TTL.
- **Communities** - add `personaSegments` (multi-select from the shared taxonomy) and confirm `languages`
  to the community admin edit form, plus the same gap filter. Reuse the unified taxonomy vocab from
  `@indlokal/shared` (PRD-0051) - no new enum.

No new migration; these are form/query changes over existing columns.

## 5. Pipeline-assisted tagging (suggest -> review -> approve)

Per ADR-0006 the pipeline is ETL, not an agent; it **suggests**, humans **approve**.

- Extend the extraction step so, for each emitted/updated `COMMUNITY` (and, when resources extraction
  lands, `RESOURCE`), the pipeline proposes `personaSegments` / `audiences` / `lifecycleStage` from the
  content, attached to the **existing review-queue item** (PRD/TDD-0013).
- The review UI renders suggestions as an approvable diff (approve / edit / reject), consistent with how
  extracted entities are already reviewed.
- **Suggestions are never written to the live tag columns until approved.** Approval writes through the
  normal moderation path; rejection discards. This preserves the L0 trust gate (strategy §10).
- Track suggestion **approval rate** as a quality signal (PRD-0053 §3 metric); if low, the suggestion
  prompt is tuned or disabled without affecting the human-only backfill path.

No change to the cron sharding / dispatch (PRD/TDD-0023..0029); this is an additive output field on the
extraction step, gated by a flag (§6).

## 6. Feature flags

| Flag                              | Default | Behavior                                                                                                                      |
| --------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `JOURNEY_TAG_SUGGESTIONS_ENABLED` | `false` | When on, the pipeline emits suggested journey tags into the review queue. Off: pipeline unchanged; backfill stays admin-only. |

The coverage report and admin backfill worklist need no flag (read-only report; admin-gated edits).

## 7. Observability

- Coverage report is itself the primary observability artifact; schedule it (or expose the admin route)
  so coverage % is trackable over time per city.
- Log pipeline suggestion volume + approval/reject counts (feeds the approval-rate metric).
- Reuse PRD-0052 journey observability (dropped-block counter, per-stage block counts) as the live
  "is coverage still healthy?" signal - a journey starving in production is a coverage regression alert.

## 8. Failure modes & fallbacks

- **Report disagrees with the engine** -> impossible by construction: the report calls the same
  `composeJourney` + `density.ts`. Covered by a test asserting parity.
- **Pipeline suggests a bad tag** -> contained by suggest-only + human review; no live write.
- **Bulk backfill mistake** -> edits go through the standard admin audit log (PRD-0018 context) and are
  reversible per-row; no destructive bulk operation in this TDD.
- **Suggestion flag off** -> coverage is maintained by admin-only backfill + organizer-form tagging;
  journeys still launch, just with more manual effort.

## 9. Test plan

- **Unit** - coverage counting per stage; verdict parity with `density.ts` at boundary counts;
  untagged-row query predicates.
- **Integration** - seed Stuttgart fixtures with mixed tag coverage; assert the report's READY/THIN
  verdict matches what `composeJourney` would render; assert admin tag-save busts the resolver cache and
  the resource then appears in the journey; assert pipeline-suggested tags land in the review queue as
  PENDING and are journey-ineligible until approved.
- **Pipeline** - extraction emits suggestions only when `JOURNEY_TAG_SUGGESTIONS_ENABLED`; suggestions
  never write live columns pre-approval.
- **Regression** - resource/community admin edits and the existing review queue behave unchanged when the
  flag is off.

## 10. Rollout plan

1. Ship the **coverage report** first (read-only) - establish the Stuttgart baseline (PRD-0053 §3).
2. Ship **admin backfill** filters/fields; run the Stuttgart x Family backfill to clear the density gate
   (this is the gate that unblocks PRD/TDD-0052 launch).
3. Enable `JOURNEY_TAG_SUGGESTIONS_ENABLED` in staging; validate suggestion quality + approval flow;
   then production.
4. Add **organizer-form persona tagging** so new community supply is tagged at source.
5. Re-run the coverage report as a recurring health check; expand backfill to the next journey/city in
   lockstep with PRD-0052 rollouts.

## 11. Backout plan

- Set `JOURNEY_TAG_SUGGESTIONS_ENABLED=false` -> pipeline reverts to unchanged ETL output; backfill stays
  admin-only.
- The coverage report and admin form fields are additive and read-mostly; disabling them has no data
  effect (tags already written by editors remain valid and simply power journeys).
