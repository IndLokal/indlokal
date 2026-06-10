# Resources Trust, Freshness, and Ops Plan

Date: 2026-06-10
Owner: Product + Platform + Content Ops
Status: Draft for next implementation track after current resources closeout commitments

## Document Authority

- This file is the active planning source for remaining Product Document Section 17 work.
- Strategy source: `../../docs/PRODUCT_DOCUMENT.md` Section 17.
- Implementation gap source: `../../docs/RESOURCE_SUPPLY_TRUST_AUDIT.md`.
- Active sprint execution remains in `../implementation-artifacts/resources-sprint-execution-board.md`.

## 1. What remains from Product Document Section 17

The following Section 17 requirements are still only partially implemented and now form the remaining resources operating-system track:

1. Transparent publishing on resources:

- formal trust bands
- source label contract
- last verified timestamp
- verification method / attribution clarity

2. Continuous refresh lifecycle:

- TTL computation from review cadence
- stale demotion
- archive/hide guardrails
- re-verification queue

3. Owned-content governance:

- enforce when original guides are allowed
- capture rationale for high-risk/high-confusion/high-frequency gaps

4. Journey-led supply operations:

- convert coverage gaps into owned backlog with SLA

5. KPI contract:

- operationalize Trusted Journey Resource Coverage and anti-metrics in dashboards/readouts

## 2. What is already done and should not be replanned

Done or materially present already:

- Scope-based resource resolver
- audience/stage tagging
- journey composition and density gate
- stale badge UI (`Fresh` / `Needs review`)
- low-noise trust proxy labels (`Official` / `Curated`)
- action links on resource surfaces
- review metadata fields in schema (`lastReviewedAt`, `reviewCadenceDays`, `isHidden`)
- admin tagging tools
- pipeline provenance and audit context

This plan only covers the delta from current implementation to full Section 17 behavior.

## 3. Delivery principle

Do not reopen the just-closed Sprint 1 / Sprint 2 UX lane.

Run this as the next implementation track after mandatory post-close commitments finish. It is an operating-system and trust/freshness track, not another UI-redesign sprint.

## 4. Workstreams

### Workstream A - Resource Trust Read Model and Surface Contract

Goal:
Make resource trust explicit, consistent, and non-misleading across hub, category, and journey surfaces.

Scope:

- Define resource trust read model:
  - `trustBand`
  - `sourceLabel`
  - `lastVerifiedAtDisplay`
  - `verificationMethod`
- Map existing `Resource.source`, provenance metadata, freshness status, and review timestamps into the read model.
- Render on:
  - web hub
  - web category
  - web journey
  - mobile parity only after web contract is stable
- Keep copy aligned to Section 17:
  - Strong Source
  - Source-Supported
  - Needs Verification

Not in scope:

- full freshness automation
- queue workflow

Exit gate:

- same resource shows same trust band/label across all web surfaces
- last verified is visible where data exists
- no over-claim wording in QA pass

### Workstream B - Freshness Lifecycle Automation

Goal:
Turn stale signaling into a real lifecycle system.

Scope:

- Compute TTL breach from `lastReviewedAt + reviewCadenceDays`
- Add lifecycle states/rules:
  - in TTL
  - stale + demoted
  - prolonged stale
  - hidden/archived
- Define grace window by cadence band
- Ensure journey-critical placements demote stale rows first
- Write auditable reasons for lifecycle changes

Not in scope:

- full queue assignment UX in v1

Exit gate:

- TTL-breached resources are automatically demoted
- prolonged stale rows can be auto-hidden under explicit guardrails
- resolver/ranking behavior matches lifecycle state

### Workstream C - Re-verification Queue and Ops SLA

Goal:
Give Ops a real queue instead of passive stale badges.

Scope:

- Create resource re-verification queue view and record shape
- Priority formula:
  - risk
  - traffic
  - staleness duration
  - journey criticality
- Add assignment and SLA fields
- Resolution actions:
  - verified
  - corrected
  - hidden
  - archived
- Add backlog and overdue summary

Exit gate:

- every stale resource above threshold enters queue
- high-risk stale items have an owner and SLA

### Workstream D - Owned Content Governance Gate

Goal:
Prevent ad hoc original-content sprawl while allowing necessary guides.

Scope:

- Add required rationale for owned resource creation/edit
- Capture:
  - why curation is insufficient
  - risk/confusion/frequency class
  - alternative sources considered
- Enforce only for owned/curated-original content path
- Add audit visibility for governance decisions

Exit gate:

- no owned resource is created without rationale
- editors can distinguish curated entry vs owned guidance path cleanly

### Workstream E - Journey Gap to Supply Ops Loop

Goal:
Close the missing loop between coverage reporting and content operations.

Scope:

- turn coverage gaps into weekly city x persona x stage backlog
- add priority using:
  - traffic
  - severity
  - stage criticality
  - trust gap
- assign owner and SLA
- produce weekly report for active cities

Exit gate:

- READY/THIN coverage report directly feeds ops backlog
- high-priority gaps are visible and owned

### Workstream F - KPI and Dashboard Contract

Goal:
Make Section 17 measurable as an operating layer.

Scope:

- define Trusted Journey Resource Coverage readout
- add dashboard contract for:
  - % resources within TTL
  - % with provenance metadata
  - stale exposure rate
  - outdated correction turnaround
  - trust-band action rate
  - anti-metrics
- keep this as a narrow ops dashboard extension, not a full analytics rewrite

Exit gate:

- all leading indicators in Section 17.3 are queryable
- anti-metrics are visible for release review

## 5. Recommended implementation order

Run in this order because each layer de-risks the next:

1. Workstream A - Trust read model
2. Workstream D - Owned content governance gate
3. Workstream B - Freshness lifecycle automation
4. Workstream C - Re-verification queue
5. Workstream E - Journey-gap ops loop
6. Workstream F - KPI/dashboard contract

Reasoning:

- A and D define the product and governance contract first.
- B changes system behavior and should not ship without clear contract.
- C depends on B producing actionable stale states.
- E depends on stable coverage and trust/freshness semantics.
- F should instrument the final operating model, not a moving target.

## 6. Suggested release waves

### Wave 1 - Trust contract

Includes:

- Workstream A
- Workstream D

Target outcome:

- resources become honest and inspectable
- content creation path gains policy discipline

### Wave 2 - Freshness operating system

Includes:

- Workstream B
- minimal Workstream C

Target outcome:

- stale content is actively managed, not just labeled

### Wave 3 - Supply ops and measurement closeout

Includes:

- remainder of Workstream C
- Workstream E
- Workstream F

Target outcome:

- Section 17 becomes operationally sustainable and measurable

## 7. Dependencies and blockers

Hard dependencies:

- current post-close Sprint 1 and Sprint 2 commitments must finish first
- no concurrent reopening of resources UX shell decisions

Implementation dependencies:

- resolver/ranking hooks for freshness states
- admin data actions/forms for governance fields
- ops-facing queue/dashboard capacity
- analytics/data readout support

## 8. No-go rules

Do not start this track if:

- Sprint 1/Sprint 2 post-close commitments are still open
- current resource save/ranking surfaces are still unstable
- analytics baseline from Story 4.3 is not reliable enough to judge outcomes

## 9. Definition of done for this track

This track can be considered implemented when:

1. Resource cards show formal trust contract, not proxy-only labels.
2. Last verified/freshness lifecycle is real and enforceable.
3. Re-verification queue exists with owner + SLA.
4. Owned content creation is policy-gated.
5. Coverage gaps flow into ops backlog weekly.
6. Trusted Journey Resource Coverage and anti-metrics are queryable.

## 10. Immediate next step

First close the mandatory post-close commitments on the current resources board.
After that, start Wave 1 planning as the next active BMAD implementation lane under this file.
