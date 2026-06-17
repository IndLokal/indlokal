# Resources Trust, Freshness, and Ops Architecture Handoff

Date: 2026-06-10
Owner: Winston (System Architect)
Scope line: \_bmad-output resources trust/freshness/ops track only
Source set:

- \_bmad-output/planning-artifacts/resources-trust-freshness-ops-plan.md
- \_bmad-output/implementation-artifacts/resources-trust-freshness-ops-execution-board.md
- \_bmad-output/implementation-artifacts/resources-trust-freshness-ops-story-sequence.md
- \_bmad-output/implementation-artifacts/story-a1-resource-trust-read-model-and-surface-contract.md
- \_bmad-output/implementation-artifacts/story-a2-owned-content-governance-gate.md
- \_bmad-output/implementation-artifacts/story-b1-freshness-lifecycle-automation.md
- \_bmad-output/implementation-artifacts/story-b2-reverification-queue-and-sla.md
- \_bmad-output/implementation-artifacts/story-c1-journey-gap-to-supply-ops-loop.md
- \_bmad-output/implementation-artifacts/story-c2-section-17-kpi-dashboard-contract.md
- \_bmad-output/implementation-artifacts/resources-trust-freshness-ops-qa-checklist.md

## 0) Current-State Baseline (What exists now)

1. Resource read path exists and is centralized in apps/web/src/modules/resources/resolver.ts.
2. Resource persistence already has freshness-adjacent fields in apps/web/prisma/schema.prisma:

- lastReviewedAt
- reviewCadenceDays
- isHidden
- hiddenReason
- source
- metadata

3. Admin create/edit path already exists in apps/web/src/app/admin/(dashboard)/data/actions.ts and apps/web/src/components/admin/ResourceForm.tsx.
4. Resource web surfaces exist at:

- apps/web/src/app/[city]/resources/page.tsx
- apps/web/src/app/[city]/resources/[category]/page.tsx
- apps/web/src/app/[city]/resources/journey/page.tsx

5. Journey coverage engine exists in apps/web/src/modules/journeys/coverage.ts, but no supply backlog persistence/ownership yet.
6. Canonical analytics event registry exists in apps/web/src/lib/analytics/events.ts, but Section 17 KPI contract fields are not yet complete.
7. Existing queue patterns are present (NotificationOutbox and PipelineItem), which should guide implementation style, idempotency, and cron processing patterns.

## 1) Architecture Decision Summary by Wave

### Wave 1 (A1 + A2): Contract Before Automation

Build first:

1. A1 Resource trust read model and surface contract.
2. A2 Owned-content governance gate.

Why first:

1. Current trust UI is proxy-based and not contract-stable across surfaces.
2. Freshness automation without explicit trust/governance semantics risks incorrect demotion or over-claiming.
3. A2 blocks policy drift by forcing rationale before owned-content writes.

Decision:

- No lifecycle automation in Wave 1.
- Ship one shared resolver/API trust projection and one governance gate in admin writes.

### Wave 2 (B1 + B2): Lifecycle Enforcement + Ops Queue

Build second:

1. B1 TTL and lifecycle automation in backend.
2. B2 Re-verification queue with assignment/SLA and resolution actions.

Why second:

1. B2 depends on deterministic stale classification from B1.
2. Queue quality requires stable lifecycle states and auditable transitions.

Decision:

- Implement lifecycle evaluation in resolver/service layer first.
- Queue ingestion and SLA handling second, fed by lifecycle output.

### Wave 3 (C1 + C2): Operational Loop + KPI Contract

Build third:

1. C1 Journey-gap to supply backlog generation and ownership.
2. C2 KPI dashboard contract and anti-metrics.

Why third:

1. C1 priority model depends on trust/freshness behavior already stable.
2. C2 metrics should observe final behavior, not moving intermediate rules.

Decision:

- Keep C1/C2 thin and operational.
- Reuse existing coverage/readout patterns, avoid analytics platform rewrite.

## 2) Target Module Boundaries and Data Flow

## 2.1 Ownership boundaries

1. Resource read projection and ranking:

- apps/web/src/modules/resources/resolver.ts
- Add sibling modules (same folder): trust-read-model.ts, freshness-lifecycle.ts.

2. Public API surface:

- apps/web/src/app/api/v1/cities/[slug]/resources/route.ts
- apps/web/src/app/api/v1/cities/[slug]/resources/journey/route.ts

3. Admin write/governance path:

- apps/web/src/app/admin/(dashboard)/data/actions.ts
- apps/web/src/components/admin/ResourceForm.tsx

4. Reverification queue service and cron:

- New module family under apps/web/src/modules/resources/reverification/
- New cron route under apps/web/src/app/api/cron/resources/reverification/route.ts

5. Journey gap backlog service:

- Extend apps/web/src/modules/journeys/coverage.ts read output
- New backlog mapper module under apps/web/src/modules/journeys/ops-backlog.ts
- New cron route under apps/web/src/app/api/cron/resources/gap-backlog/route.ts

6. KPI readouts:

- New read model under apps/web/src/modules/resources/ops-readout.ts
- Admin dashboard page in admin dashboard area (data/ops section).

## 2.2 End-to-end flow

### A1 read flow

1. Resolver loads applicable resources.
2. trust-read-model projects each row into:

- trustBand
- sourceLabel
- lastVerifiedAtDisplay
- verificationMethod

3. APIs serialize this object unchanged.
4. Hub/category/journey surfaces render this object directly with no local re-interpretation.

### A2 write flow

1. Admin create/edit submits mode: curated vs owned.
2. If owned, governance validator enforces rationale fields.
3. Action persists governance metadata on Resource.metadata.
4. Action writes ContentLog entry for auditability.
5. Resolver cache invalidated, pages revalidated.

### B1 lifecycle flow

1. Lifecycle evaluator computes ttlDueAt = lastReviewedAt + reviewCadenceDays.
2. Evaluator derives state:

- IN_TTL
- STALE_DEMOTED
- PROLONGED_STALE
- HIDDEN_ARCHIVED

3. Resolver ranking and filtering apply state:

- demote stale in order
- optional hide for prolonged stale under guardrails

4. Lifecycle transitions are logged with reason.

### B2 queue flow

1. Scheduled job scans stale/prolonged candidates.
2. Upserts reverification queue row with deterministic idempotency key.
3. Priority score computed from risk + traffic + staleness + journey criticality.
4. Ops uses admin queue UI to assign owner and SLA.
5. Resolution action updates resource state and queue row atomically.

### C1 backlog flow

1. Weekly job runs city/persona coverage generation.
2. THIN gaps map to backlog rows with priority rubric.
3. Backlog row assigned owner + SLA.
4. Ops page shows weekly due/overdue and completion status.

### C2 KPI flow

1. ops-readout pulls from Resource, queue, backlog, and interactions.
2. Dashboard exposes Section 17 KPIs and anti-metrics.
3. Release review uses fixed query contract and sample validation set.

## 3) Data Model Changes and Migration Strategy (Additive First)

Guiding rule:

- Additive schema changes only unless unavoidable.
- Keep existing fields and behavior readable during rollout.

## 3.1 Wave 1 schema plan

A1 and A2 can ship with zero required table migrations if fields are stored in metadata and read-projected.

Recommended additive optional columns (preferred over long-term metadata drift):

1. Resource.trustBand enum ResourceTrustBand (default NEEDS_VERIFICATION)
2. Resource.sourceLabel string nullable
3. Resource.verificationMethod string nullable
4. Resource.ownedGovernanceRequired boolean default false

If not added in Wave 1, store these in metadata keys under a single namespace:

- metadata.trust
- metadata.governance

## 3.2 Wave 2 schema plan

Additive lifecycle columns on Resource:

1. freshnessState enum ResourceFreshnessState default IN_TTL
2. ttlDueAt datetime nullable
3. staleSinceAt datetime nullable
4. demotedAt datetime nullable
5. archivedAt datetime nullable
6. lifecycleReason string nullable

Additive reverification queue table:

- ResourceReverificationQueue
  - id
  - resourceId
  - status (OPEN, ASSIGNED, RESOLVED, DISMISSED)
  - priorityScore
  - riskScore
  - trafficScore
  - stalenessScore
  - criticalityScore
  - ownerUserId nullable
  - slaDueAt nullable
  - resolutionAction nullable
  - resolutionNotes nullable
  - firstQueuedAt
  - lastStateChangedAt
  - createdAt
  - updatedAt
- Indexes:
  - status + priorityScore desc
  - ownerUserId + status
  - slaDueAt + status
  - resourceId unique for OPEN/ASSIGNED semantics (enforced via service rule if partial unique not used)

## 3.3 Wave 3 schema plan

Additive journey gap backlog table:

- JourneySupplyBacklog
  - id
  - weekStartDate
  - citySlug
  - persona
  - stage
  - gapType
  - severityScore
  - trafficScore
  - trustGapScore
  - priorityScore
  - status (OPEN, IN_PROGRESS, DONE, DROPPED)
  - ownerUserId nullable
  - slaDueAt nullable
  - sourceCoverageSnapshot json
  - createdAt
  - updatedAt
- Uniqueness:
  - unique weekStartDate + citySlug + persona + stage + gapType

No destructive change required in this track.

## 3.4 Migration rollout strategy

1. Deploy schema first, no behavior change.
2. Backfill jobs populate nullable/new fields from existing Resource rows.
3. Enable read projection fallback logic (new field, else metadata, else honest null).
4. Enable write paths.
5. Enable lifecycle/queue cron jobs.
6. Enable dashboard queries after one full weekly cycle of data.

Rollback safety:

- New columns/tables are additive and nullable/defaulted, so old code remains valid.

## 4) API and UI Contract List by Story (A1..C2)

## A1 Resource trust read model and surface contract

API contracts:

1. Extend Resource API response from apps/web/src/app/api/v1/cities/[slug]/resources/route.ts with:

- trustBand
- sourceLabel
- lastVerifiedAtDisplay
- verificationMethod
- freshnessStateDisplay (derived, optional in Wave 1)

2. Extend journey resources API response from apps/web/src/app/api/v1/cities/[slug]/resources/journey/route.ts with same trust object.

UI contracts:

1. Hub page renders trust and verification fields from API/resolver projection only.
2. Category page renders same fields (no local trust label helper divergence).
3. Journey page renders same fields (replace type-based Official/Curated helper).
4. Null/unknown fields display explicit non-overclaim fallback copy.

## A2 Owned-content governance gate

Write contracts:

1. Resource form adds fields for owned path:

- contentMode (CURATED, OWNED)
- governanceRationale
- riskClass
- confusionClass
- frequencyClass
- alternativesConsidered

2. Server action validates required governance fields only when contentMode is OWNED.
3. Persist governance payload under metadata.governance (or dedicated columns if added).
4. Write ContentLog audit event with entityType resource and governance decision summary.

UI contracts:

1. Conditional field visibility for owned mode.
2. Clear validation copy in admin form.
3. Admin detail/readout shows governance metadata and audit trace.

## B1 Freshness lifecycle automation

Service contracts:

1. New lifecycle evaluator function computes TTL and freshness state deterministically.
2. Resolver ranking consumes freshness state for demotion order.
3. Hidden/archive behavior requires explicit guardrail conditions and reason.

API contracts:

1. Include freshness state and ttlDueAt in resource serialization.
2. Preserve backward-compatible shape for existing clients.

UI contracts:

1. Replace simple stale badge logic with state-driven display.
2. Surface lifecycle reason where relevant in admin.

## B2 Re-verification queue and SLA

Service contracts:

1. Queue upsert service with idempotency key per resource + state bucket.
2. Priority calculator function with explicit weighted inputs.
3. Resolution handler updates queue and resource lifecycle atomically.

API/admin contracts:

1. Admin queue list endpoint (or server action read) with filters:

- status
- owner
- overdue
- priority band

2. Admin actions:

- assign owner
- set/update SLA
- resolve as verified/corrected/hidden/archived

UI contracts:

1. Queue table with deterministic sort by priority then overdue.
2. SLA chip states: on-track, due-today, overdue.
3. Resolution modal/form requiring notes when hidden/archived.

## C1 Journey-gap to supply ops loop

Service contracts:

1. Weekly gap generator from journey coverage output.
2. Dedup key by week/city/persona/stage/gapType.
3. Priority rubric persisted with score breakdown.

API/admin contracts:

1. Ops backlog read contract:

- week
- city
- persona
- stage
- gap summary
- priority
- owner
- SLA

2. Actions:

- assign owner
- set SLA
- mark done/dropped with reason

UI contracts:

1. Weekly backlog page grouped by city and persona.
2. Gap details show originating coverage counts and gaps text.

## C2 Section 17 KPI and dashboard contract

Readout contract (queryable metrics):

1. Trusted Journey Resource Coverage.
2. Percent resources within TTL.
3. Stale exposure rate.
4. Outdated correction turnaround.
5. Trust-band action rate.
6. Anti-metrics:

- hidden/archive overuse rate
- unresolved overdue queue rate
- owned-content-without-rationale rate (must stay zero)

UI contracts:

1. Admin KPI page with metric definitions, current value, trailing period, and sample query links.
2. Release-review section with anti-metric thresholds and pass/fail indicator.

## 5) Risk Register and Rollback Strategy

## 5.1 Risks

1. Cross-surface drift risk (A1)

- Cause: trust labels still computed in page-specific helpers.
- Mitigation: single read-model projection in resolver/API, no local trust derivation.

2. Over-claim trust wording risk (A1)

- Cause: inferred labels where provenance is weak.
- Mitigation: strict fallback to Needs Verification and QA wording signoff gate.

3. Governance friction risk (A2)

- Cause: blocking curated path with owned-only fields.
- Mitigation: conditional validation by contentMode only.

4. Lifecycle false positives risk (B1)

- Cause: bad TTL assumptions or null reviewed dates.
- Mitigation: fixture tests for null/edge dates and conservative default state.

5. Queue noise risk (B2)

- Cause: non-idempotent queue insertion or overly broad candidate scan.
- Mitigation: idempotent upsert keys + threshold filter + duplicate guard.

6. Ops overload risk (B2/C1)

- Cause: too many high-priority items without capacity.
- Mitigation: hard cap per weekly generation pass and priority threshold gate.

7. Metric trust risk (C2)

- Cause: dashboard numbers diverge from product behavior.
- Mitigation: metric definitions tied to source queries and sample validation fixtures.

## 5.2 Rollback strategy

1. Feature flags by wave:

- resourcesTrustContractEnabled
- resourcesOwnedGovernanceEnabled
- resourcesFreshnessLifecycleEnabled
- resourcesReverificationQueueEnabled
- resourcesGapBacklogEnabled
- resourcesSection17KpiEnabled

2. Rollback levels:

- Level 1: disable page-level rendering features, keep writes.
- Level 2: disable queue and lifecycle cron jobs.
- Level 3: disable write-time governance enforcement (read-only mode).

3. Data safety:

- Additive schema means rollback is code/flag only; no destructive migration required.

4. Recovery:

- Recompute lifecycle and queue rows from source Resource state after rollback/fix.

## 6) Developer Handoff Packet (Execution Sequence + Acceptance Gates)

Precondition gate (must pass before Wave 1 start):

1. resources-sprint-execution-board mandatory post-close commitments are complete.
2. Story 4.3 baseline dashboard reliability confirmed.
3. Resource ranking stability from prior sprint validated.

## 6.1 Implementation sequence

Wave 1 sequence:

1. Implement shared trust read model projection in resolver layer.
2. Extend both resource APIs with trust contract fields.
3. Refactor hub/category/journey pages to consume projected trust object.
4. Add owned-content governance fields and conditional validation in admin form/actions.
5. Add governance audit logging.
6. Execute Wave 1 QA checklist evidence collection.

Wave 2 sequence:

1. Add lifecycle schema fields and evaluator module.
2. Integrate lifecycle state into resolver ordering/filtering.
3. Add queue table/service and cron ingestion.
4. Build admin queue UI and assignment/SLA/resolution actions.
5. Add audit/event logging for lifecycle and queue transitions.
6. Execute Wave 2 QA checklist evidence collection.

Wave 3 sequence:

1. Add weekly gap backlog table/service from journey coverage.
2. Build ops backlog UI/actions for owner/SLA/status.
3. Add KPI readout module and dashboard page.
4. Validate anti-metrics and go/no-go review contract.
5. Execute Wave 3 QA checklist evidence collection.

## 6.2 Acceptance gates by wave

Wave 1 gate:

1. Same trust contract across hub/category/journey for same resource.
2. Owned-content path blocked without rationale; curated path unaffected.
3. Product/Ops signoff on vocabulary and governance rubric.

Wave 2 gate:

1. TTL and state transitions validated on fixtures.
2. Queue population deterministic and idempotent.
3. Assignment/SLA/resolution flow auditable end-to-end.

Wave 3 gate:

1. Coverage gaps generate backlog rows with no duplicate noise.
2. KPI and anti-metrics are queryable and sample-validated.
3. Product + Ops release review signoff complete.

## 6.3 Required tests for merge gates

1. Unit tests:

- trust-read-model mapping
- lifecycle evaluator edge cases
- queue priority scoring
- gap backlog dedup key builder

2. Integration tests:

- resource API contracts include trust/freshness fields
- admin governance validation and persistence
- queue resolution updates resource state
- KPI query snapshots for seeded fixtures

3. Regression tests:

- resolver behavior for scope and hidden rows remains correct
- existing journey coverage report parity preserved

## 6.4 Non-goals (to prevent scope creep)

1. No new generic workflow engine.
2. No full analytics platform rewrite.
3. No mobile expansion before web contract stabilizes.
4. No reopening closed sprint UX shell decisions.

## 7) Immediate Developer Start Checklist

1. Create ADR entry for this handoff under docs/specs/ADR if required by repo workflow.
2. Open implementation PR for Wave 1 only.
3. Land trust projection + governance gate behind flags.
4. Attach QA evidence per resources-trust-freshness-ops-qa-checklist.md.
5. Do not start Wave 2 until Wave 1 gate is signed off.
