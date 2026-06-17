# TDD-0056: Pipeline Resource Lane — Technical Design

**Status:** Accepted
**Linked:** PRD-0056, ADR-0006, ADR-0007, PRD/TDD-0026, PRD/TDD-0030
**Owner:** Amelia (Engineer)
**Created:** 2026-06-10

---

## 1. Summary

This TDD documents the technical implementation of the RESOURCE lane inside the existing AI pipeline system. Resources are first-class entities in `PipelineEntityType`, sharing extraction, dedup, review queue, and moderation infrastructure with events and communities.

## 2. Schema changes

### 2a. Prisma

```
enum PipelineEntityType {
  EVENT
  COMMUNITY
  RESOURCE   // ← added
}
```

### 2b. Migration

`apps/web/prisma/migrations/20260610213000_add_pipeline_resource_lane/migration.sql`

```sql
ALTER TYPE "PipelineEntityType" ADD VALUE IF NOT EXISTS 'RESOURCE';
```

Idempotent via `IF NOT EXISTS`. Safe to run before code deploy; no data mutation.

## 3. Extraction schema

New type `ExtractedResource` in `src/modules/pipeline/types.ts`:

| Field              | Source               | Notes                                                  |
| ------------------ | -------------------- | ------------------------------------------------------ |
| `type`             | literal `'RESOURCE'` |                                                        |
| `title`            | LLM                  |                                                        |
| `description`      | LLM                  |                                                        |
| `cityName`         | LLM                  |                                                        |
| `resourceType`     | LLM                  | Constrained to `ResourceType` enum values              |
| `scope`            | LLM                  | Constrained to `ResourceScope` enum including DISTRICT |
| `scopeRegion`      | LLM                  | City slug, state code, or metro slug                   |
| `audiences`        | LLM                  | Array of `ResourceAudience` values                     |
| `lifecycleStage`   | LLM                  | Array of `ResourceStage` values                        |
| `url`              | LLM                  | Official/canonical URL                                 |
| `validUntil`       | LLM                  | YYYY-MM-DD or null                                     |
| `isOfficialSource` | LLM                  | bool                                                   |
| `confidence`       | LLM                  | 0-1                                                    |
| `fieldConfidence`  | LLM                  | per-field map                                          |

LLM extraction prompt includes full enum lists for resourceType, scope, audiences, and lifecycleStage so output is constrained server-side.

## 4. Dedup design

`checkResourceDuplicate` in `orchestrator.ts`:

- First pass: exact canonical URL match (`normalizeComparableUrl`).
- Second pass: title bigram similarity ≥ 0.72 AND same scope + scopeRegion.

**Scope compatibility rule**: two resources are only dedup candidates if `normalizeScopeForDedup(scope)` matches AND `normalizeScopeRegionForDedup(scopeRegion)` matches. GLOBAL scope matches any other GLOBAL regardless of scopeRegion (which is null by definition).

This prevents false merges between:

- `CITY/stuttgart` and `STATE/DE-BW` resources with similar titles.
- Two different state codes with the same generic resource title.

## 5. Rejection memory

`findRejectedResourceMatch` in `dedup.ts` follows the same pattern as the event/community equivalents:

1. Exact normalized source URL match.
2. Exact canonical resource URL match.
3. Title bigram similarity ≥ `COMMUNITY_DUPLICATE_NAME_THRESHOLD` (0.72).

## 6. Approval path

`createResourceFromExtraction` in `review.ts`:

- Derives `cityId` only for CITY scope (others get null).
- Derives `scopeRegion` from: LLM output → city slug (CITY/METRO) → `DE` (COUNTRY) → null (GLOBAL).
- Sets `source: 'IMPORTED'`, `lastReviewedAt: now()`, and `reviewCadenceDays` based on `isOfficialSource` (120 days official, 180 days otherwise).
- Sets `isEssential` for CONSULAR_SERVICE and VISA_SERVICE types.
- Writes ContentLog via the shared `approvePipelineItemRecord` path.

**Resources never auto-approve.** `shouldAutoApprovePipelineItem` returns `{ eligible: false, reason: 'resource-admin-approval-required' }` unconditionally for RESOURCE items.

## 7. Feature flag

`FLAGS.pipelineResourceLaneEnabled` (`PIPELINE_RESOURCE_LANE_ENABLED` env var, default `false`).

When `false`, RESOURCE items extracted from LLM output are silently dropped at queue time. This allows safe code deploy before migration.

## 8. Governance / moderation audit

- `PipelineItem.reviewedBy` now populated with the real session actor id from `assertCan`.
- `ContentLog.changedBy` mirrors the approving user.
- This applies to both approve and reject actions.

## 9. Resource resolver cache invalidation

`invalidateResolver()` is called on both `approvePipelineItem` and `rejectPipelineItem` so that approved resources appear immediately in resolver output and rejected items don't persist in cached views.

## 10. Observability

- `PipelineCityBreakdown` type now carries `queuedResources` and `duplicateResources` counters.
- Orchestrator log line updated to include resources in queue-decision summary.
- Reverification risk scoring: `HEALTH_DOCTORS` added to critical tier alongside `CONSULAR_SERVICE`, `VISA_SERVICE`, `CITY_REGISTRATION`.

## 11. Rollback

1. Set `PIPELINE_RESOURCE_LANE_ENABLED=false` (default).
2. Deploy; all resource-type items are silently dropped at queue time.
3. Schema change is additive (`ADD VALUE`); no rollback migration required.
4. Any RESOURCE `PipelineItem` rows already created remain benign in PENDING status.

## 12. Open items before flag activation (Winston checklist)

- [ ] Integration tests: RESOURCE dedup (URL match, title match, scope collision, scope isolation).
- [ ] Integration tests: RESOURCE approval path (scopeRegion defaulting, Resource row fields).
- [ ] Integration tests: rejection-memory suppression for RESOURCE type.
- [ ] Resource-intent source planning (pinned URLs for consular/bürgeramt/gov pages).
- [ ] Dashboard KPI slice for RESOURCE lane quality.
