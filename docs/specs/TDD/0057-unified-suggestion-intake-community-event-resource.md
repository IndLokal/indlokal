# TDD-0057: Unified Contribution Intake (Community, Event, Resource)

**Status:** Draft
**Linked PRD:** PRD-0057
**Depends on:** TDD-0009, TDD-0013, TDD-0037, TDD-0056
**Owner:** Engineering
**Created:** 2026-06-15

---

## 1. Summary

Implement a unified contribution architecture:

- One user-facing contribution entry surface (`/contribute` globally and `/[city]/contribute` in city context) with type selection.
- Typed server actions and schemas per entity type (community/event/resource).
- Shared intake envelope and analytics contract.
- Queue routing into existing moderation systems with no trust bypass.

Naming convention: use **Contribute** for routes, nav, CTA, page copy, app-layer services, components, analytics, and queue labels. Existing `SUGGEST_*` and `*_SUGGESTION` enum/API identifiers are legacy storage and integration names; keep them only where changing them would require a data/API migration.

## 2. Current-state gaps to address

1. Legacy `suggestCommunity` action is community-only while page copy implies broader support.
2. No dedicated event contribution action/source type for visitors.
3. Reports taxonomy still contains legacy `SUGGEST_*` values in persistence.

## 3. Proposed architecture

### 3.1 Routes and UI

- Add route: `app/contribute/page.tsx` for global contribution intake.
- Add route: `app/[city]/contribute/page.tsx` for city-scoped contribution intake.
- Replace single form with:
  - Step 1: type chooser (community/event/resource)
  - Step 2: render typed form component by `type`
- Support deep-link query params:
  - `?type=community`
  - `?type=event`
  - `?type=resource`

Global `/contribute` does not require a city picker step; community and event forms collect city inside the form when no city context exists.

### 3.2 Server actions

Introduce a new action module:

- `contributeListing()` as orchestrator with typed payload and schema dispatch
- or explicit actions:
  - `contributeCommunityListing()`
  - `contributeEventListing()`
  - `contributeResourceListing()`

Recommendation: explicit actions internally + one form-facing wrapper for cleaner validation and analytics.

## 4. Contracts and schemas

Add shared contribution contract in `packages/shared` (or extend existing submit contract):

```ts
entityType: 'COMMUNITY' | 'EVENT' | 'RESOURCE'
intakeMode: 'CONTRIBUTE'
citySlug: string
suggestedName: string
details?: string
reporterEmail?: string
sourceUrl?: string
ownershipIntent?: 'HELP_RUN' | 'JUST_ADDING' | 'HOSTING_THIS_EVENT' | 'SHARING_TIP' | 'REPRESENT_PROVIDER' | 'JUST_SUGGESTING'
```

Per-type minimum validation:

- COMMUNITY: suggestedName, citySlug
- EVENT: suggestedName, citySlug, at least one of `sourceUrl` or date/time hint in details
- RESOURCE: suggestedName, citySlug, suggested category hint optional

## 5. Data model changes

### 5.1 Report classification

Public/reporting-facing taxonomy should use contribution naming; persisted DB enums may retain legacy `SUGGEST_*` values until migration.

Additive migration option (v1.0, community + event only):

- `SUGGEST_EVENT` (NEW)
- `SUGGEST_RESOURCE` (DEFERRED to v1.1, pending TDD-0056 resource model)

Alternative (no enum expansion): keep one generic report type and store `entityType` in details/metadata. Not recommended due to analytics and queue ambiguity.

### 5.2 Pipeline source typing

Current `PipelineSourceType` includes `COMMUNITY_SUGGESTION` only.

Additive enum values (v1.0, community + event only):

- `EVENT_SUGGESTION` (NEW)
- `RESOURCE_SUGGESTION` (DEFERRED to v1.1, pending TDD-0056 resource model)

Keep `COMMUNITY_SUGGESTION` unchanged for backward compatibility.

### 5.3 Queue payload shape

Pipeline item creation per entity type should include:

- `entityType`
- `sourceType` typed as above
- `cityId`
- `rawContent`
- `extractedData` with type-safe starter payload
- `submittedBy` when authenticated
- `confidence: number` (0–1, see § 5.5 Confidence scoring)
- `dupCandidatesFound: number` (count of potential duplicate matches from dedup check)

**Transaction semantics (CRITICAL):** ContentReport + PipelineItem must be created **atomically** in a single database transaction. If PipelineItem creation fails, the entire contribution is rolled back and user sees error (fail-fast). No async retry in v1.0.

### 5.4 Event rejection reason (NEW)

Add `EventRejectionReason` enum to Event model to distinguish between organizer-created events rejected by policy vs. contribution-sourced events rejected for unverifiability:

```typescript
enum EventRejectionReason {
  POLICY_VIOLATION = 'POLICY_VIOLATION', // Organizer event violates policy
  UNVERIFIABLE = 'UNVERIFIABLE', // Contribution unverifiable or low confidence
  DUPLICATE = 'DUPLICATE', // Merged with existing event
  SPAM = 'SPAM', // Flagged as spam or abuse
  OUTSIDE_COVERAGE = 'OUTSIDE_COVERAGE', // Event outside geographic coverage
  NULL = 'NULL', // Not rejected
}
```

Populate when `Event.moderationState` transitions to REJECTED. Allows operators and event creators to understand **why** rejection occurred.

### 5.5 Confidence scoring

All contributions receive a confidence score (0–1) indicating likelihood of accuracy and operator trust in the contribution source:

```typescript
enum ConfidenceLevel {
  VERIFIED = 0.95, // Organizer/host-submitted (high trust)
  STRONG = 0.8, // Authenticated user + verified data source (website URL provided)
  MODERATE = 0.6, // Authenticated user + no source verification
  LOW = 0.4, // Anonymous user or public untrusted source
  UNCONFIRMED = 0.2, // Edge case (e.g., rejected contributions, unclear intent)
}
```

Use confidence in:

- Admin UI filtering ("Show only STRONG confidence or above")
- Auto-merge dedup candidates with confidence ≥ 0.8 (future phase)
- Analytics and dashboard bucketing ("Approval rate by confidence tier")

## 6. Routing and moderation behavior

### 6.1 Community contribution (v1.0)

- Continue current pattern:
  - Create ContentReport row with `reportType=SUGGEST_COMMUNITY`
  - Create PipelineItem row with entityType COMMUNITY and sourceType COMMUNITY_SUGGESTION
  - Run synchronous dedup check; if duplicate found, flag in PipelineItem metadata
  - **Transaction:** Both records created atomically; if PipelineItem fails, entire contribution rolled back

### 6.2 Event contribution (v1.0, NEW)

- Create ContentReport row with `reportType=SUGGEST_EVENT`
- Create PipelineItem row with entityType EVENT and sourceType EVENT_SUGGESTION
- Run synchronous dedup check; if duplicate found, flag for merge consideration
- Create Event row with `moderationState: PENDING_REVIEW` (not yet publishable)
- Event lands in event moderation workflow; operator reviews PipelineItem and decides: approve → set Event.moderationState to PUBLISHED, or reject → set to REJECTED with EventRejectionReason
- **Transaction:** All three records (ContentReport, PipelineItem, Event placeholder) created atomically

### 6.3 Resource contribution (v1.1+, DEFERRED)

- **Deferred pending TDD-0056 resource model spec.**
- When implemented: Create ContentReport + PipelineItem for RESOURCE_SUGGESTION
- Resource contribution form entry point will be visible in hub but **disabled** in v1.0 ("Coming soon" message)
- Waiting for: resource scope/region dedup rules, provider model, resource status lifecycle from TDD-0056

## 7. API and module touchpoints

Likely touched files/modules:

- `app/contribute/page.tsx`
- `app/[city]/contribute/page.tsx`
- `components/contribute/*` (shared hub and typed contribution forms)
- `app/actions/reports.ts` (replace/extend legacy `suggestCommunity`)
- `modules/submit/service.ts` (optional shared service for contribution flows)
- `modules/pipeline/types.ts` and queue builders
- `prisma/schema.prisma` enums (`ReportType`, `PipelineSourceType`)
- admin reports and pipeline list filters/chips

## 8. Analytics and observability

Emit canonical events:

- `CONTRIBUTION_STARTED`
- `CONTRIBUTION_SUBMITTED`
- `CONTRIBUTION_REVIEWED`

Required properties (all events):

- `entityType` (COMMUNITY | EVENT | RESOURCE)
- `citySlug`
- `isAuthenticated`
- `trustLane` (PUBLIC_UNTRUSTED | IDENTIFIED_CONTRIBUTOR | OPERATOR_TRUSTED)
- `confidence` (0–1 score; see § 5.5)

Additional properties:

- `CONTRIBUTION_SUBMITTED`: `dupCandidatesFound` (count), `sourceUrl?` (if provided)
- `CONTRIBUTION_REVIEWED`: `reviewDecision` (APPROVED | REJECTED | MERGED), `reviewLatencySeconds`, `dedupResolution` (NONE | MERGED | ESCALATED_FOR_REVIEW)

Operational dashboards:

- **Submission funnel:** submissions started vs submitted vs reviewed, by entity type
- **Approval rate:** by entity type, trust lane, and confidence tier
- **Latency:** P50/P90/P99 review time by entity type and confidence
- **Dedup effectiveness:** % of contributions with dupCandidatesFound > 0; % of those merged vs escalated vs rejected
- **Confidence distribution:** histogram of contribution confidence scores
- **Submitter segments:** approval rate by trust lane (organizer vs contributor vs public)

## 9. Feature flags

Add flags:

- `UNIFIED_CONTRIBUTION_INTAKE_ENABLED` (default false) — enables hub + community + event contribution forms and queues
- `UNIFIED_CONTRIBUTION_INTAKE_RESOURCE_LANE` (default false) — enables resource contribution form (v1.1+, gated on TDD-0056)

Rollout behavior:

- `UNIFIED_CONTRIBUTION_INTAKE_ENABLED=false`: existing community-only contribution UX remains.
- `UNIFIED_CONTRIBUTION_INTAKE_ENABLED=true`: Contribute hub + community + event forms enabled. Resource tab visible but disabled ("Coming soon").
- `UNIFIED_CONTRIBUTION_INTAKE_RESOURCE_LANE=true` (requires TDD-0056 locked): resource contribution form enabled (v1.1 phase).

## 10. Migration and rollout sequence

### Phase 1 (v1.0 - Community + Event contributions, ~2-3 weeks)

1. **Database schema:** Add enums (SUGGEST_EVENT to ReportType, EVENT_SUGGESTION to PipelineSourceType), add EventRejectionReason to Event, add confidence field to PipelineItem. Regenerate Prisma client.
2. **Backend:** Implement `contributeCommunityListing()`, `contributeEventListing()` server actions with synchronous dedup and atomic transaction semantics. Land behind `UNIFIED_CONTRIBUTION_INTAKE_ENABLED` flag.
3. **Frontend:** Implement typed Contribute hub (`/contribute` and `/[city]/contribute` with type chooser) and typed forms (community, event). Resource tab present but disabled ("Coming soon"). Land behind same flag.
4. **Admin UI:** Update pipeline review queue to show entity type badges, confidence scores, dedup flags, EventRejectionReason enum selector for event rejection.
5. **Analytics:** Instrument canonical events (CONTRIBUTION_STARTED, CONTRIBUTION_SUBMITTED, CONTRIBUTION_REVIEWED) with extended schema (trust lane, confidence, dedup context).
6. **Staging:** QA end-to-end community + event flows. Test dedup logic (synchronous blocks duplicates, PipelineItem creation rolls back on error).
7. **Rollout:** Enable `UNIFIED_CONTRIBUTION_INTAKE_ENABLED` in Stuttgart, monitor metrics for 1 week (approval rate, latency, dedup rate, confidence distribution).
8. **Expand:** Rollout to all active cities once Stuttgart metrics are healthy.

### Phase 2 (v1.1 - Resource contributions, ~4 weeks after TDD-0056 locked)

1. **Gate:** TDD-0056 (resource model + scope/region dedup) must be approved and implementation started before this phase.
2. **Backend:** Implement `contributeResourceListing()` action per TDD-0056 scope/region dedup rules.
3. **Frontend:** Implement resource contribution form and schema; enable resource tab in hub.
4. **Admin UI:** Add resource pipeline queue filtering by scope and confidence.
5. **Metrics:** Add resource-specific dashboards (approval rate by scope, dedup effectiveness, coverage gaps).
6. **Rollout:** Enable `UNIFIED_CONTRIBUTION_INTAKE_RESOURCE_LANE` flag gradually across cities.

### Phase 3 (v2 - Advanced features, ~6 weeks later)

- Confidence-based admin UI filtering and auto-merge workflows
- Resource provider self-service submission form
- Bulk import from external directories

## 11. Backout

**Phase 1 backout (v1.0):**

1. Disable `UNIFIED_CONTRIBUTION_INTAKE_ENABLED` feature flag.
2. Keep additive enum and schema changes in place (no data migration rollback needed; they are forward-compatible).
3. Fallback to current community-only contribution behavior automatically.

**Phase 2 backout (v1.1, resource contributions):**

1. Disable `UNIFIED_CONTRIBUTION_INTAKE_RESOURCE_LANE` feature flag.
2. Resource contribution form becomes inaccessible; hub shows "Coming soon" again.
3. Existing resource contributions in queue remain (not deleted), visible in pipeline admin if flag is manually re-enabled for investigation.

## 12. Test plan

### 12.1 Unit

- Zod parsing for each typed contribution form.
- Routing decision helper tests by entity type.

### 12.2 Integration

- Community contribution creates expected report + pipeline records.
- Event contribution creates expected report + event pipeline record.
- Resource contribution creates expected report + resource pipeline record.
- Duplicate guard for similar names in same city.

### 12.3 UI

- Deep-link preselection (`?type=`).
- Validation errors per typed lane.
- Success state copy and analytics emission.

### 12.4 Regression

- Existing `/submit` flow remains unchanged.
- Existing organizer/host event creation remains unchanged.

## 13. Resolved implementation questions (from architecture review)

1. ✅ **Pipeline transaction semantics:** Both ContentReport + PipelineItem must be created **synchronously in a single transaction**. No async retry in v1.0; fail fast if PipelineItem creation fails (entire contribution rolls back).
2. ✅ **Event rejection reason:** Add EventRejectionReason enum to Event model (POLICY_VIOLATION, UNVERIFIABLE, DUPLICATE, SPAM, OUTSIDE_COVERAGE, NULL) for operator clarity.
3. ✅ **Resource contributions v1.0 scope:** Deferred to v1.1 (Phase 2). TDD-0056 resource model must be locked first. Resource tab in hub is visible but disabled in v1.0.
4. ✅ **Confidence scoring:** Defined enum (VERIFIED 0.95, STRONG 0.80, MODERATE 0.60, LOW 0.40, UNCONFIRMED 0.20). Used in analytics, admin filtering, future auto-merge workflows.
5. ✅ **Dedup context in analytics:** Extended analytics event schema to capture dupCandidatesFound, dedupResolution (NONE | MERGED | ESCALATED_FOR_REVIEW) for observability.

## 14. Validation checklist (before coding begins)

- [ ] Confirm pipeline architecture: dedup is synchronous, ContentReport + PipelineItem are created transactionally
- [ ] Confirm Event model supports moderationState REJECTED + EventRejectionReason enum
- [ ] Confirm PipelineItem supports confidence field (float 0–1)
- [ ] Confirm analytics infrastructure supports extended event schema (trust lane, confidence, dedup context)
- [ ] Lock v1.0 scope: community + event contributions only; resource deferred to v1.1
- [ ] Schedule 30-min sync with engineering lead to validate assumptions
- [ ] Create admin UI mockups showing: entity type badges, confidence scores, dedup flags, EventRejectionReason selector
