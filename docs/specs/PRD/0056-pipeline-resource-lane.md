# PRD-0056: Pipeline Resource Lane

**Status:** Accepted
**Linked:** ADR-0007 (resource scope/resolution model), ADR-0006 (pipeline is ETL), PRD/TDD-0026, -0030
**Owner:** PM (John) · Architect (Winston) · Engineer (Amelia)
**Created:** 2026-06-10

---

## 1. Why

Resources (visa guides, city-registration info, consular services, tax, housing, health) are the highest-trust, highest-risk content IndLokal holds. They are also currently the hardest content type to discover, maintain, and grow because there is no automated ingestion path — every resource is authored manually.

As of Phase 2, the platform has a proven, governed pipeline (extraction → dedup → review queue → approval → ContentLog) used for events and communities. This PRD directs that resources enter the platform through the same pipeline rather than a separate subsystem.

## 2. Problem statement

- Resources are bottlenecked at manual admin entry.
- Official/gov/institutional pages exist and are crawlable; there is no path to ingest them.
- Operating two separate ingestion systems would split governance, ops load, and reliability budgets.

## 3. Goals

| Goal                             | Acceptance criterion                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| G1: Automated discovery          | Pipeline can extract RESOURCE items from relevant pages                                          |
| G2: One trust/governance system  | Resources enter, are moderated, and are logged through same pipeline infra as events/communities |
| G3: No false merges across scope | Dedup respects scope (CITY, METRO, STATE, COUNTRY, GLOBAL, DISTRICT) and scopeRegion             |
| G4: Human approval required      | No resource auto-approves; humans must approve before content is visible                         |
| G5: Rollout safety               | RESOURCE lane is flag-gated; code deploy can precede migration safely                            |

## 4. Non-goals

- Separate pipeline, separate queue, separate moderation UI.
- Auto-approve for resources at any confidence level (risk profile is too high).
- Replacing manual admin resource authoring (admin forms remain the primary authored path).

## 5. Acceptance criteria

- [ ] `PipelineEntityType.RESOURCE` exists in schema with migration applied.
- [ ] LLM extraction produces RESOURCE payloads with: title, description, cityName, resourceType, scope, scopeRegion, audiences, lifecycleStage, url, validUntil, isOfficialSource.
- [ ] Approved RESOURCE pipeline item creates a `Resource` row with correct scope/scopeRegion/audiences/lifecycleStage derived from city context and LLM output.
- [ ] Dedup compares resources on canonical URL and title similarity scoped by (scope, scopeRegion) tuple — not city alone.
- [ ] Previously rejected RESOURCE items are suppressed by rejection-memory helper on subsequent runs.
- [ ] Admin pipeline page renders RESOURCE items distinctly with type/audience/stage/url fields visible.
- [ ] `pipelineResourceLaneEnabled` flag defaults to OFF; enabling requires `PIPELINE_RESOURCE_LANE_ENABLED=true` env var.
- [ ] Approve/reject pipeline actions record real session user id in `PipelineItem.reviewedBy` and `ContentLog.changedBy`.
- [ ] `PipelineCityBreakdown` type includes `queuedResources` and `duplicateResources` counters.
- [ ] Resource resolver cache is invalidated on approve/reject.

## 6. Rollout gates

1. Run migration `20260610213000_add_pipeline_resource_lane` in staging.
2. Run `pnpm -F web db:generate` in all environments.
3. Enable `PIPELINE_RESOURCE_LANE_ENABLED=true` in staging only; verify RESOURCE items appear in queue.
4. Verify dedup and approval end-to-end: approve a test item, confirm Resource row created with correct scope.
5. Enable in production after 1 week staging soak.

## 7. Open / deferred

- [ ] Resource-specific source planning: add resource-intent pinned URLs (consular, bürgeramt, etc.) to pipeline source config.
- [ ] Dashboard slice for RESOURCE lane KPIs (approval rate, duplicate suppression rate, stale rates post-ingestion) — Winston requirement.
- [ ] Integration tests for RESOURCE dedup and approval paths — Winston requirement; schedule before flag activation.
- [ ] Structured rejection-reason taxonomy for resources.
