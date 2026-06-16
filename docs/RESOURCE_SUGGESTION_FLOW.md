# Resource Suggestion Flow

**Part of:** [Submission and Suggestion Flows: Unified Policy](./SUBMISSION_AND_SUGGESTION_FLOWS.md)  
**Related specs:** PRD/TDD-0057 (unified suggestion intake), PRD/TDD-0056 (resource pipeline)  
**Status:** Deferred to v1.1 (Phase 2). Resource suggestion form will be visible but disabled in v1.0 hub until TDD-0056 (resource model + scope/region dedup) is finalized and implementation begins.

---

## 1. Overview

IndLokal accepts resource listings through the **resource suggestion** flow (submission flow is future scope). A resource is a service, provider, or utility of value to a community—e.g., legal aid clinic, job training workshop, childcare resource, translation service.

| Flow                    | Status   | Launch | Use Case                                                                                     |
| ----------------------- | -------- | ------ | -------------------------------------------------------------------------------------------- |
| **Resource suggestion** | Designed | v1.1   | Any user flags a missing resource with name, type, scope, and optional details               |
| **Resource submission** | Future   | v2     | Admin or resource provider creates resource with full profile and scope/region configuration |

**Key difference from community/events:** Resources are **not city-scoped**. A legal aid clinic serves Stuttgart + surrounding regions. The resource pipeline (TDD-0056) defines scope/region dedup rules independently.

**Note:** Implementation of this flow is blocked on TDD-0056 finalization. See § 12 (Integration Points) for dependencies.

---

## 2. Design Principles

### 2.1 Broad discovery + strict verification

Untrusted sources can flag resources; the platform verifies scope/region alignment and duplication before visibility.

### 2.2 Scope and region matter more than city

Resources are often regional. A tip mentioning "legal aid" might serve 5 cities. The pipeline must classify and dedup by scope boundaries (e.g., city vs metro vs state).

### 2.3 Suggestions feed the pipeline

All resource suggestions go into the pipeline discovery queue. The resource lane (when enabled) routes them for specialist review and publication.

### 2.4 Minimal upfront investment

Form collects essentials: name, type/category, scope, and contact link if available. Admins research and refine post-approval.

---

## 3. Entry Points

Members and guests reach the resource suggestion form from:

1. **Contribute hub** — `GET /contribute?type=resource` (auth optional, not city-specific)
2. **Resource browse page** — "Is there a resource we're missing?" callout (future)
3. **Direct URL** — `/contribute?type=resource`

**Naming convention:** Public UI, routes, app-layer services, analytics, and queue labels use **Contribute**. `SUGGEST_RESOURCE` and `RESOURCE_SUGGESTION` are legacy storage/API identifiers and should not leak into UI or new service names.

---

## 4. Resource Suggestion Flow

### Step 1 — Form Completion

**Route:** `GET /contribute?type=resource`  
**Context:** Not city-specific (resource scope is independent). Form may be in the global Contribute hub or a dedicated contribution page.

**Client form** collects:

| Field                           | Required    | Validation                                                                                                                                                  |
| ------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resource name                   | Yes         | 2–200 chars                                                                                                                                                 |
| Resource type/category          | Yes         | Dropdown: LEGAL_AID, HEALTH_CLINIC, JOB_TRAINING, CHILDCARE, TRANSLATION, HOUSING, FOOD_BANK, FINANCIAL_AID, EDUCATION, MENTORSHIP, TECHNICAL_SKILLS, OTHER |
| Scope                           | Yes         | HYPERLOCAL (single neighborhood), CITY, METRO (multi-city), STATE, NATIONAL, ONLINE                                                                         |
| Geographic area (if not online) | Conditional | City or region name(s) (free text or lookup)                                                                                                                |
| Short description               | No          | 0–500 chars; tip for ops/admin                                                                                                                              |
| Contact link (URL)              | No          | Website, phone number, or link for more info                                                                                                                |
| Your name (if auth)             | Auto-filled | Authenticated users auto-identified                                                                                                                         |
| Your email                      | Optional    | For follow-up if approved                                                                                                                                   |

### Step 2 — Server Action

`contributeResource()` in `src/app/actions/resources.ts`:

1. Validate form via Zod schema
2. Classify trust lane:
   - **Authenticated user with history** (≥3 prior suggestions, ≥1 approved) → IDENTIFIED_CONTRIBUTOR
   - **Authenticated user** → IDENTIFIED_CONTRIBUTOR
   - **Anonymous/light auth** → PUBLIC_UNTRUSTED
3. Run dedup check (if PIPELINE_RESOURCE_LANE_ENABLED):
   - Query resources with similar name (bigram ≥ 0.7)
   - Filter by overlapping scope (e.g., city resource vs metro—might overlap)
   - If strong match found: flag for dedup merge consideration (do not block submission)
4. Create `ContentReport` row:
   - `reportType: SUGGEST_RESOURCE`
   - `entityType: RESOURCE`
   - `sourceType: COMMUNITY_SUGGESTION`
   - `metadata: { name, type, scope, area, description, contactLink, suggestorEmail, trustLane, dupesFound? }`
5. Create `PipelineItem` (only if PIPELINE_RESOURCE_LANE_ENABLED):
   - `entityType: RESOURCE`
   - `sourceType: RESOURCE_SUGGESTION`
   - `suggestedData: { name, type, scope, area, description, contactLink }`
   - `confidence: 0.5` (typical for community suggestion; resources harder to verify)
   - `status: PENDING_REVIEW`
6. If PIPELINE_RESOURCE_LANE_DISABLED:
   - Suggestions are logged to ContentReport only (not queued for pipeline processing)
   - Emit `CONTRIBUTION_SUBMITTED_NO_QUEUE` (feature flagged off)
   - Send email: "Thanks for the tip! We'll review resource suggestions soon."
7. If PIPELINE_RESOURCE_LANE_ENABLED:
   - Emit `CONTRIBUTION_SUBMITTED` analytics event (entityType=RESOURCE, trustLane=...)
   - Send confirmation email: "Thanks! We'll review within 5 business days."

### Step 3 — Admin/Ops Review (When Resource Lane Enabled)

**Route:** `GET /admin/pipeline?entityType=RESOURCE`  
**View:** Resource discovery queue showing:

- Suggested resource name, type, scope
- Geographic area(s)
- Submitter trust lane badge
- Confidence score
- Any dedup warnings

**Actions:**

#### Approve

`approveResourceSuggestion(pipelineItemId)`:

1. Extract `suggestedData` from PipelineItem
2. Create `Resource` row (schema TBD by PRD/TDD-0056):
   - `name, type, description, scope, geographicAreas`
   - `providerId: null` (community-suggested; no provider account yet)
   - `status: PUBLISHED` (or PENDING_VERIFICATION per scope—deferred to 0056)
   - `metadata.suggestedBy: { email?, trustLane, approvedAt }`
   - `contactLink` (if provided)
3. Create `TrustSignal` with `signalType: ADMIN_VERIFIED` (if applicable per 0056)
4. Set `PipelineItem.status: RESOLVED` + `PipelineItem.resolvedAt: now`
5. Send email to suggester (if email captured): "Your resource tip was added! [View on IndLokal]"
6. Revalidate resource browse routes

#### Reject

`rejectResourceSuggestion(pipelineItemId, reason)`:

1. Set `PipelineItem.status: REJECTED` + `PipelineItem.rejectionReason: reason`
2. Emit analytics: `SUGGESTION_REJECTED` (entityType=RESOURCE, reason=...)
3. Optional email to suggester: "We couldn't add this resource. [Reason: outside coverage | duplicate | unable to verify | etc.]"

#### Merge with Existing Resource

`mergeResourceSuggestion(pipelineItemId, existingResourceId)`:

1. Link `PipelineItem` to existing `existingResourceId` as a duplicate source
2. Update existing resource's `metadata.suggestedDuplicates` with new data points
3. Set `PipelineItem.status: RESOLVED_DUPLICATE`
4. Emit analytics: `SUGGESTION_MERGED_WITH_EXISTING`

#### Escalate to Scope Specialist

`escalateResourceSuggestion(pipelineItemId, specialistUserId)`:

1. Assign review to resource specialist (if RESOURCE_SPECIALIST_ROLE_ENABLED)
2. Send notification: "New resource suggestion in [scope]: [name]. [Review]"
3. Set `PipelineItem.status: ESCALATED_TO_SPECIALIST`

---

## 5. Data Model

### Resources Table (Schema TBD by PRD/TDD-0056)

Placeholder; detailed schema deferred to resource pipeline spec.

| Field                    | Type     | Notes                                                           |
| ------------------------ | -------- | --------------------------------------------------------------- |
| `id`                     | UUID     | Primary key                                                     |
| `name`                   | String   | Resource name                                                   |
| `type`                   | Enum     | LEGAL_AID, HEALTH_CLINIC, JOB_TRAINING, ... (see form options)  |
| `description`            | String   | Details about resource                                          |
| `scope`                  | Enum     | HYPERLOCAL, CITY, METRO, STATE, NATIONAL, ONLINE                |
| `geographicAreas`        | JSON     | Array of cities/regions (e.g., ["Stuttgart", "Ludwigsburg"])    |
| `providerId`             | UUID     | Optional; foreign key to Provider (null if community-suggested) |
| `status`                 | Enum     | PUBLISHED \| PENDING_VERIFICATION \| REJECTED (details in 0056) |
| `contactLink`            | String   | URL for more information                                        |
| `metadata`               | JSON     | { suggestedBy?, approvedBy?, reviews?, tags?, ... }             |
| `createdAt`, `updatedAt` | DateTime | Timestamps                                                      |

### Pipeline Items (Resource suggestions)

| Field                                   | Type     | Notes                                                                                   |
| --------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `id`                                    | UUID     | Primary key                                                                             |
| `entityType`                            | Enum     | RESOURCE                                                                                |
| `sourceType`                            | Enum     | RESOURCE_SUGGESTION                                                                     |
| `suggestedData`                         | JSON     | { name, type, scope, geographicAreas, description, contactLink, ... }                   |
| `confidence`                            | Float    | 0–1; confidence of extraction/dedup                                                     |
| `status`                                | Enum     | PENDING_REVIEW \| RESOLVED \| REJECTED \| RESOLVED_DUPLICATE \| ESCALATED_TO_SPECIALIST |
| `resolvedResourceId`                    | UUID     | Foreign key to Resource (populated on approval/merge)                                   |
| `rejectionReason`                       | String   | Reason for rejection                                                                    |
| `createdAt`, `reviewedAt`, `resolvedAt` | DateTime | Timestamps                                                                              |

---

## 6. Deduplication Logic

Resource dedup is complex because **scope boundaries determine relevance**, not city alone.

### Exact matches

**Rule:** Same name + same scope + overlapping geographic areas → merge candidate.

**Algorithm:**

```
For each suggestion:
  Name bigram ≥ 0.9 (nearly exact)
  Scope = existing resource scope
  GeographicAreas overlap (e.g., both serve Stuttgart)
  → Flag for merge or reject as duplicate
```

### Soft matches

**Rule:** Similar name + same type + scope overlap + geographic regions overlap → escalate for review.

**Algorithm:**

```
Name bigram ≥ 0.7 (similar)
Type match (same category)
Scope ∈ [CITY, METRO, STATE] (regionality matches)
GeographicAreas ⊂ or ⊇ existing resource coverage
→ Alert operator: "Possible duplicate or overlapping coverage"
```

### No match

**Rule:** No existing resource matches criteria → approve as new resource.

---

## 7. Status Lifecycle

```
[Suggestion submitted]
      ↓
PENDING_REVIEW (in pipeline queue, if lane enabled)
      ├─ PUBLISHED (approved for discovery)
      ├─ REJECTED (not a fit)
      └─ RESOLVED_DUPLICATE (merged with existing resource)
```

If PIPELINE_RESOURCE_LANE_DISABLED, suggestions stay in ContentReport only; no lifecycle beyond storage.

---

## 8. Feature Flag Strategy

**`PIPELINE_RESOURCE_LANE_ENABLED`:**

- When false (default): Resource suggestions collected in ContentReport; no pipeline queue; no admin UI
- When true: Full resource lane active; suggestions queued for admin review; Resources table populated

**Rationale:** Resource model (scope/region dedup) is complex. Decoupling suggestion intake from queue processing allows staged rollout.

---

## 9. Transparency and Communication

**Community suggester (resource suggestion):**

- Immediate (lane disabled): "Thanks for the tip! We'll review resource suggestions soon."
- Immediate (lane enabled): "Thanks! We'll review within 5 business days."
- Approved: "Your resource tip was added! [View on IndLokal]"
- Rejected: "We couldn't add this resource. [Reason: outside coverage | duplicate | unable to verify | etc.]"
- Merged: "This resource matches one already on IndLokal."

---

## 10. Analytics and Observability

**Key events:**

- `RESOURCE_CONTRIBUTION_SUBMITTED` — user contributes a resource tip
- `RESOURCE_SUGGESTION_APPROVED` — admin approves suggestion
- `RESOURCE_SUGGESTION_REJECTED` — admin rejects suggestion
- `RESOURCE_SUGGESTION_MERGED` — suggestion merged with existing resource

**Canonical properties:**

- `resourceId` (if created), `resourceName`, `resourceType`, `scope`
- `sourceType` (COMMUNITY_SUGGESTION)
- `trustLane` (for suggestions)
- `status` (suggestion lifecycle)
- `reviewLatencySeconds` (time from suggestion to approval/rejection)

**Dashboards:**

- Resources created per week, by scope and type
- Suggestion approval rate by trust lane
- Duplicate suppression rate
- Time-to-review SLA tracking
- Coverage gaps by scope (e.g., "legal aid" widely suggested but few approved)

---

## 11. Routes and Files Reference

| Route                                     | File                                                      | Purpose                                                                                        |
| ----------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GET /contribute?type=resource`           | `src/app/contribute/page.tsx` or future typed child route | Resource suggestion form (not city-scoped)                                                     |
| Server action                             | `src/app/actions/resources.ts`                            | `contributeResource()`                                                                         |
| `GET /admin/pipeline?entityType=RESOURCE` | `src/app/admin/(dashboard)/pipeline/page.tsx`             | Resource suggestion review queue (lane-gated)                                                  |
| Server actions                            | `src/app/admin/(dashboard)/actions.ts`                    | `approveResourceSuggestion()`, `rejectResourceSuggestion()`, `mergeResourceSuggestion()`, etc. |
| Validation schemas                        | `src/lib/validation.ts`                                   | `contributeResourceSchema`                                                                     |

---

## 12. Non-Goals (MVP)

- Resource submission form (only suggestions)
- Provider account management (future phase)
- Resource verification/rating (scope of TDD-0056)
- Bulk import from external resource directories (future pipeline ingestion)
- Geo-proximity search optimization (search is out of scope)

---

## 13. Integration Points

**Depends on:**

- Content pipeline infrastructure (ContentReport, PipelineItem tables, dedup logic)
- Feature flag service (PIPELINE_RESOURCE_LANE_ENABLED)
- Admin dashboard (pipeline review UI)

**Blocked by:**

- PRD/TDD-0056 (Resource model and scope/region dedup rules)—resource suggestion form design will align with 0056 once spec is locked

---

## 14. Future Enhancements

- **Resource submission form:** Admins or providers can create resources directly with full profile
- **Provider account management:** Resources linked to provider accounts; providers can manage/update their resources
- **Resource verification workflow:** Trust signals per scope (e.g., city-level verification vs state-level)
- **Crowd-sourced reviews:** Users can review/rate resources (similar to community reviews)
- **Coverage gap analysis:** Dashboard showing under-resourced communities or categories
- **Integration with external directories:** Import resources from trusted sources (e.g., local government databases, NGO registries)
- **Scope/region hierarchy:** Visual editor for defining resource geographic coverage (not just freetext cities)
