# Submission and Suggestion Flows: Unified Policy

**Version:** 1.0 (2026-06-15)  
**Audience:** Operators, Engineers, Product  
**Related specs:** PRD/TDD-0057 (unified suggestion intake), PRD/TDD-0009 (community submission), PRD/TDD-0037 (event governance), PRD/TDD-0056 (resource pipeline)

---

## 1. Executive summary

IndLokal accepts listings through two high-level flows:

1. **Full submission** — organizer/submitter provides detailed profile + relationship intent
2. **Suggestion** — member flags something missing with minimal context

Both flows converge on **human review before public visibility**. This document defines the unified policy, routing logic, and per-entity-type operating procedures.

---

## 2. Core principles

### 2.1 Broad discovery + strict verification

Untrusted sources can flag missing listings; only strong evidence or operator relationship grants trust status. A missing event tip is as valuable as perfect data—the queue, not the form, gates publication.

### 2.2 Quality over volume

Every submission is a write to the platform graph. Duplicates, stale links, and incorrect details damage discovery. Human review is the backstop.

### 2.3 Minimal upfront investment

Forms ask for essentials only. Organizers refine profiles post-approval via their dashboard.

### 2.4 Transparent status

Submitters know their request is under review and what to expect.

### 2.5 Submission ≠ self-publishing

Submitters choose their relationship intent at intake time. The platform executes that intent on approval—not a reviewer override.

---

## 3. Terminology

| Term                         | Definition                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Full submission**          | User provides complete profile + relationship intent; queued for admin/specialist review before publication              |
| **Suggestion**               | Internal intake taxonomy for a user flagging a missing item with minimal context; queued for admin/specialist review     |
| **Contribute hub**           | User-facing Contribute entry where users choose entity type (community/event/resource) then branch to typed forms        |
| **User-facing route family** | `/contribute` for global intake and `/[city]/contribute` for city-scoped intake                                          |
| **Intake mode**              | SUBMIT (full profile) \| SUGGEST (minimal flag) \| REPORT (complaint about existing item)                                |
| **Trust lane**               | OPERATOR_TRUSTED (organizer/host) \| IDENTIFIED_CONTRIBUTOR (authenticated user) \| PUBLIC_UNTRUSTED (anon/light auth)   |
| **Ownership intent**         | What the submitter claims about their relationship (HELP_RUN, JUST_ADDING, HOSTING_THIS_EVENT, REPRESENT_PROVIDER, etc.) |
| **Publication gate**         | Human review required before item is discoverable by users                                                               |

**Naming convention:** Use **Contribute** for navigation, CTA labels, page titles, public routes, app-layer services, analytics, and ops queue labels. Existing `SUGGEST_*` and `*_SUGGESTION` enum/API identifiers are legacy storage and integration names; keep them only where changing them would require a data/API migration.

---

## 4. Universal routing policy

All submissions and suggestions follow this decision tree:

```
Intake received
├─ Extract entity type (COMMUNITY | EVENT | RESOURCE)
├─ Classify trust lane (OPERATOR_TRUSTED | IDENTIFIED_CONTRIBUTOR | PUBLIC_UNTRUSTED)
├─ Classify intake mode (SUBMIT | SUGGEST | REPORT)
│
├─ OPERATOR_TRUSTED + SUBMIT (organizer/host claiming authority)
│  └─ Queue: Operator-lane review (conditional moderation per entity)
│
├─ IDENTIFIED_CONTRIBUTOR + SUBMIT (authenticated user full profile)
│  └─ Queue: Admin submissions queue → human review → approve/reject
│
├─ PUBLIC_UNTRUSTED + SUGGEST (any user, minimal info, no claim)
│  └─ Queue: Pipeline discovery queue → admin review → approve/reject
│
├─ IDENTIFIED_CONTRIBUTOR + SUGGEST (authenticated user minimal flag)
│  └─ Queue: Pipeline discovery queue (possibly prioritized) → admin review
│
└─ Any + REPORT (complaint about existing item)
   └─ Queue: Content reports queue (moderation, not publication)
```

**Golden rule:** All paths that result in **public discoverable content** go through a **human review gate**. The gate's speed/rigor may vary by trust lane, but the gate exists always.

---

## 5. Per-entity-type overview

### 5.1 Community

**Full submission:** Organizer/member submits complete profile + relationship intent (HELP_RUN or JUST_ADDING).  
**Entry:** `/submit` (web) + `/api/v1/submissions/community` (mobile)  
**Queue:** Admin submissions queue  
**Approval:** Organizer gets claims authority (HELP_RUN) or community remains unclaimed (JUST_ADDING)  
**Detailed flow:** See [COMMUNITY_SUBMISSION_FLOW.md](./COMMUNITY_SUBMISSION_FLOW.md)

**Suggestion:** Member flags missing community with name + optional details.  
**Entry:** `/contribute?type=community` (global) or `/[city]/contribute?type=community` (city context)  
**Queue:** Pipeline (sourceType: COMMUNITY_SUGGESTION)  
**Approval:** Community published as UNVERIFIED or UNCLAIMED per admin decision

---

### 5.2 Event

**Full submission:** Host creates event (organizer event or independent event host submission).  
**Entry:** Organizer workspace `/organizer/events/new` or host form  
**Queue:** Event moderation queue (PENDING_REVIEW state)  
**Approval:** Published if PUBLISHED state set (organizer-trusted) or conditionally published (host needs review)  
**Detailed flow:** See [EVENTS_AND_LIFECYCLE.md](./EVENTS_AND_LIFECYCLE.md)

**Suggestion:** Member flags missing event (NEW in this flow).  
**Entry:** `/contribute?type=event` (global) or `/[city]/contribute?type=event` (city context)  
**Queue:** Pipeline (sourceType: EVENT_SUGGESTION)  
**Approval:** Event created and queued for event moderation review before PUBLISHED state

---

### 5.3 Resource

**Full submission:** Admin authors resource via data console (current practice).  
**Entry:** `/admin/data/resources` (direct creation, high trust)  
**Queue:** Direct DB write (no review for trusted admins)

**Suggestion:** Member flags missing resource (NEW in this flow).  
**Entry:** `/contribute?type=resource` when enabled; resource contribution is not inherently city-scoped  
**Queue:** Pipeline (sourceType: RESOURCE_SUGGESTION) + flagged for PRD/TDD-0056 resource lane when enabled  
**Approval:** Resource created and queued for review before visibility (if resource lane enabled)

---

## 6. Data model alignment

All submissions/suggestions create records in:

- `ContentReport` (for community/event/resource suggestions, plus abuse reports)
- `PipelineItem` (for all community and event suggestions; for resource suggestions when PIPELINE_RESOURCE_LANE_ENABLED)
- `Community` / `Event` / `Resource` (only on approval)

### 6.1 Key enums

**ReportType** (deprecated for submissions, kept for backward compat):

- `SUGGEST_COMMUNITY` → suggests entity COMMUNITY
- `SUGGEST_EVENT` → suggests entity EVENT (new)
- `SUGGEST_RESOURCE` → suggests entity RESOURCE (new)
- `STALE_INFO`, `BROKEN_LINK`, `INCORRECT_DETAILS` → complaints about existing items
- `OTHER` → freeform feedback

**PipelineSourceType**:

- `COMMUNITY_SUGGESTION` → community suggestion
- `EVENT_SUGGESTION` → event suggestion (new)
- `RESOURCE_SUGGESTION` → resource suggestion (new)
- Other types: web scrape, calendar feed, etc.

**PipelineEntityType**:

- `COMMUNITY`
- `EVENT`
- `RESOURCE`

---

## 7. Queue and moderation destinations

| Intake                  | Entity    | Queue                   | Owner              | Gate                                         |
| ----------------------- | --------- | ----------------------- | ------------------ | -------------------------------------------- |
| SUGGEST                 | COMMUNITY | Pipeline discovery      | Ops/admin          | Human review (72h SLA)                       |
| SUGGEST                 | EVENT     | Pipeline event queue    | Ops/admin          | Human review (event moderation rules)        |
| SUGGEST                 | RESOURCE  | Pipeline resource queue | Ops/admin          | Human review (resource policy)               |
| SUBMIT (community full) | COMMUNITY | Admin submissions       | Admin              | Human review (72h SLA)                       |
| SUBMIT (host/organizer) | EVENT     | Event moderation        | Admin/ops          | Conditional (organizer trust vs host review) |
| SUBMIT (admin)          | RESOURCE  | Direct → visibility     | Admin              | N/A (trusted actor)                          |
| REPORT                  | Any       | Content reports         | Ops/trust & safety | Triage (not publication)                     |

---

## 8. Ownership intent and approval outcomes

### 8.1 Community

**Submitter declares at intake:**

- "I help run this" (HELP_RUN) → on approval: organizer gets authority
- "I'm sharing this" (JUST_ADDING) → on approval: community published, unclaimed, claimable by anyone

### 8.2 Event

**Submitter declares at intake (for suggestions only; organizer events skip this):**

- "I'm hosting this" → on approval: event created, creator marked as host (if not yet host-registered)
- "I'm sharing a tip" → on approval: event created, attributed to pipeline (not a personal host)

### 8.3 Resource

**Submitter declares at intake:**

- "I represent this provider" → on approval: resource marked with provider trust signal (future phase)
- "I'm sharing a tip" → on approval: resource created, marked as suggestion-sourced

---

## 9. Deduplication and collision handling

### 9.1 Community

**At submission time:** Similarity check (name bigram ≥ 0.7) against active communities in city → hard block if collision detected  
**In queue:** Pipeline dedup logic against extracted communities (URL + title similarity)  
**Post-approval:** Admin can manually merge or reactivate if needed

### 9.2 Event

**At suggestion time:** No collision check (events are temporal, same name OK in same city)  
**In queue:** Pipeline dedup logic: exact URL match, exact date/time + venue match, or title bigram + venue similarity ≥ 0.7  
**Post-approval:** Admin can manually merge if duplicates slip through

### 9.3 Resource

**At suggestion time:** No collision check  
**In queue:** Pipeline dedup logic scoped by (scope, scopeRegion) tuple—not city alone (resources span geo levels)  
**Post-approval:** Admin can manually merge or hide stale duplicate

---

## 10. Communication and transparency

All submissions/suggestions receive:

1. **Confirmation email** (immediate): "Your [entity] suggestion was received. We review within 72 hours."
2. **Status change email** (on decision): "Approved + live" or "Rejected + reason" (public suggestions) or outcome varies (full submissions)
3. **In-app status badge** (future phase): "Under review", "Approved", "Rejected" visible to submitter

---

## 11. Analytics and observability

**Canonical events** (all flows):

- `CONTRIBUTION_STARTED` — form opened
- `CONTRIBUTION_SUBMITTED` — form submitted
- `CONTRIBUTION_REVIEWED` — admin/ops decision (approve/reject/merge)

**Required properties (all events):**

- `entityType` (COMMUNITY | EVENT | RESOURCE)
- `trustLane` (OPERATOR_TRUSTED | IDENTIFIED_CONTRIBUTOR | PUBLIC_UNTRUSTED)
- `citySlug`
- `isAuthenticated`
- `confidence` (0–1 score; see TDD-0057 for confidence tier definitions)

**Additional properties:**

- `CONTRIBUTION_SUBMITTED`: `dupCandidatesFound` (count of potential duplicates detected), `sourceUrl?` (if provided)
- `CONTRIBUTION_REVIEWED`: `reviewDecision` (approve | reject | merge), `reviewLatencySeconds`, `dedupResolution` (NONE | MERGED | ESCALATED_FOR_REVIEW)

**Operational dashboards:**

- **Submission funnel:** suggestions started, submitted, reviewed by entity type
- **Approval rate:** by entity type, trust lane, confidence tier
- **Latency:** P50/P90/P99 review time by entity type and confidence
- **Dedup effectiveness:** % of suggestions with dupCandidatesFound > 0; % merged vs escalated vs rejected
- **Confidence distribution:** histogram of suggestion confidence scores by entity type
- **Submitter segments:** approval rate by trust lane (organizer vs contributor vs public)
- **Coverage gaps:** suggestions by category/entity type to surface underserved areas

---

## 12. Rollout and feature flags

**v1.0 (Community + Event suggestions only):**

- `UNIFIED_CONTRIBUTION_INTAKE_ENABLED` (default: false) → enables hub + community + event contribution forms and queues
  - Resource tab visible in hub but **disabled** ("Coming soon") until v1.1

**v1.1+ (Resource suggestions, pending TDD-0056):**

- `UNIFIED_CONTRIBUTION_INTAKE_RESOURCE_LANE` (default: false) → enables resource contribution form (requires TDD-0056 resource model approved)

Each flag is independent; community + event can ship in v1.0 while resource awaits TDD-0056 lock.

---

## 13. Related detailed documents

- [COMMUNITY_SUBMISSION_FLOW.md](./COMMUNITY_SUBMISSION_FLOW.md) — deep dive on community submission, claim flow, and admin review procedures
- [EVENTS_AND_LIFECYCLE.md](./EVENTS_AND_LIFECYCLE.md) — event model, governance lanes, and authority
- [docs/specs/PRD/0057-unified-suggestion-intake-community-event-resource.md](docs/specs/PRD/0057-unified-suggestion-intake-community-event-resource.md) — product spec for the Contribute hub and typed suggestion lanes
- [docs/specs/TDD/0057-unified-suggestion-intake-community-event-resource.md](docs/specs/TDD/0057-unified-suggestion-intake-community-event-resource.md) — technical design for implementation

---

## 14. Maintenance and updates

This document is the source of truth for submission/suggestion policy. Changes require:

1. Update this document.
2. Update related spec PRDs/TDDs if implementation impact.
3. Notify operators and engineering leads.
4. Pin version + date at top of document.

**Last updated:** 2026-06-16  
**Next review:** 2026-09-15 (post-launch metric review)
