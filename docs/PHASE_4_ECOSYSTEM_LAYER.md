# IndLokal — Phase 4: Ecosystem Layer (Product Document)

**Status: Partially implemented (pilot evidence live) / Full layer not yet built.** This is the product document for Phase 4 of the [IndLokal product strategy](PRODUCT_DOCUMENT.md). Where the [Phase 1 document](PHASE_1_DISCOVERY_FOUNDATION.md) records the trust/discovery base, the [Phase 2 document](PHASE_2_JOURNEY_LAYER.md) records the journey spine, and the [Phase 3 document](PHASE_3_PERSONALIZATION_LAYER.md) defines personalization, this document defines the Ecosystem Layer as the relationship graph that sits above them.

**As-built context already in place:** the [JITO Stuttgart Business Connect Pilot](JITO_STUTTGART_BUSINESS_CONNECT_PILOT.md) shipped via [PRD-0054](specs/PRD/0054-jito-stuttgart-business-connect-pilot.md) / [TDD-0054](specs/TDD/0054-jito-stuttgart-business-connect-pilot.md), proving a trusted, community-backed, invite-only collaboration workflow. It is treated here as a **Phase-4 signal and ops foundation**, not a full ecosystem product.

> **The one-sentence thesis:** Phase 4 activates IndLokal's dormant ecosystem hooks into a usable, trust-verified relationship graph (partner orgs, relationship edges, sponsor/collaboration intent, operator workflows) so later Business (Phase 5), Connect (Phase 6), and Intelligence (Phase 7) are built on real network density instead of assumptions.

> **This is a strategy/PRD-precursor document, not an implementation spec.** Outside of the shipped pilot ([PRD/TDD-0054](specs/PRD/0054-jito-stuttgart-business-connect-pilot.md)), concrete Phase-4 product capabilities will be specified as new PRD/TDD pairs when picked up. This document defines intent, scope, dependency gates, and operating guardrails.

---

## Table of Contents

1. [Why Phase 4, and Why After Phase 3](#1-why-phase-4-and-why-after-phase-3)
2. [What the Ecosystem Layer Is (Precise Definition)](#2-what-the-ecosystem-layer-is-precise-definition)
3. [Foundation Already in Place](#3-foundation-already-in-place)
4. [Scope: In / Out](#4-scope-in--out)
5. [Core Ecosystem Capabilities](#5-core-ecosystem-capabilities)
6. [The Ecosystem Graph Model](#6-the-ecosystem-graph-model)
7. [User Experience & Surfaces](#7-user-experience--surfaces)
8. [Information Architecture (Overlay, Not Fork)](#8-information-architecture-overlay-not-fork)
9. [Data & Schema Plan](#9-data--schema-plan)
10. [Operations & Workflow](#10-operations--workflow)
11. [Dynamic vs Curated Ecosystem Views](#11-dynamic-vs-curated-ecosystem-views)
12. [SEO & Discoverability Strategy](#12-seo--discoverability-strategy)
13. [Sparsity & Quality Guardrails](#13-sparsity--quality-guardrails)
14. [Success Metrics](#14-success-metrics)
15. [Sequenced Build Plan](#15-sequenced-build-plan)
16. [Risks & Mitigations](#16-risks--mitigations)
17. [Explicitly Out of Scope (Deferred to Phase 5+)](#17-explicitly-out-of-scope-deferred-to-phase-5)
18. [Exit Criteria -> Phase 5](#18-exit-criteria---phase-5)

---

## 1. Why Phase 4, and Why After Phase 3

Phase 1 made trusted city discovery work. Phase 2 made transition journeys composable. Phase 3 defines repeated individual relevance. But none of those layers, by themselves, create a **dense relationship ecosystem** between communities, institutions, professional networks, sponsors, and operator entities.

Phase 4 exists to solve that missing middle:

> _"I can find communities and events, but how are these organizations related?"
> "Which institutional nodes are credible partners in this city?"
> "Can we operationalize collaboration and sponsorship without becoming a noisy marketplace?"_

Why now:

1. **Dependency sequencing:** Business and Connect are explicitly gate-driven in strategy section 12; they are weak without an ecosystem graph.
2. **Low-cost leverage:** the schema already contains `organizationType`, `RelationshipEdge`, `PARTNER_ORG_ADMIN`, and outreach models; the work is activation and operations, not greenfield data architecture.
3. **Pilot evidence exists:** JITO Stuttgart shows curated business-intent workflows can run safely under community trust gates.
4. **Compounding value:** ecosystem density improves journeys now, enables Business later, and is the substrate for Intelligence eventually.

---

## 2. What the Ecosystem Layer Is (Precise Definition)

The Ecosystem Layer is the trust-verified relationship graph of diaspora-relevant nodes and edges, projected into operator and user-facing surfaces where useful.

```
Ecosystem Layer = h(verified nodes, typed relationships, collaboration intent, trust gates)
                -> ecosystem views + operator workflows + journey enrichments
```

**It IS:**

- Relationship activation over verified entities.
- A graph of organizations, communities, events hosts, and partner institutions.
- A bridge between consumer journey demand and partner/operator supply.
- Deterministic and auditable before any automation.

**It is NOT:**

- A public marketplace.
- A self-serve sponsorship exchange.
- Connect productization (Phase 6).
- A replacement for moderation/verification trust gates.

---

## 3. Foundation Already in Place

### 3.1 Structural primitives already live

| Primitive                                   | Current state                 | Phase-4 role                               |
| ------------------------------------------- | ----------------------------- | ------------------------------------------ |
| `organizationType`                          | Live, partially used          | Segment and surface ecosystem node kinds   |
| `RelationshipEdge`                          | Live model, sparse population | Core graph edge model                      |
| `PARTNER_ORG_ADMIN` role path               | Present in RBAC model         | Partner-org operational identity           |
| Outreach CRM models                         | Live                          | Manual collaboration/sponsor workflows     |
| Trust layer (claim/moderation/verification) | Live                          | Absolute gate for all ecosystem visibility |

### 3.2 Demand-side substrate from prior phases

- Phase 2 journey interactions identify where ecosystem nodes are missing.
- Phase 3 (when shipped) will produce stronger intent signals for partnership demand.

### 3.3 Shipped pilot proof

The [JITO Stuttgart Business Connect Pilot](JITO_STUTTGART_BUSINESS_CONNECT_PILOT.md) validates key ecosystem assumptions:

- Invite-only, community-scoped access works.
- Organizer-led curation works (`COMMUNITY_ADMIN` workflow).
- Manual review is a strong trust gate.
- Structured intent capture creates usable matching signals.
- Admin oversight can stay read-only while organizers own decisions.

---

## 4. Scope: In / Out

### 4.1 In scope (Phase 4)

1. Partner-org activation model (community-linked parent entities, role-scoped operations).
2. Relationship-edge population and governance (typed, explainable, auditable edges).
3. Sponsor/collaboration-intent capture and ops-assisted matching workflows.
4. Ecosystem-aware journey enrichment where density supports it.
5. Community-scoped organizer operations for ecosystem workflows.
6. Admin oversight surfaces and audits for graph health and trust posture.
7. Coverage/density tooling for ecosystem readiness by metro.

### 4.2 Out of scope (deferred)

- Public business directory features (Phase 5).
- Productized two-sided introductions (Phase 6).
- Automated matching engines and auto-intros.
- Monetized Business/Connect packaging.
- Open, searchable lead board.

---

## 5. Core Ecosystem Capabilities

### 5.1 Partner-org graph activation

Enable partner organizations as first-class ecosystem nodes with scoped ownership and ties to communities/resources/events.

### 5.2 Relationship edge operations

Grow and maintain typed edges (`SISTER_CHAPTER`, `CO_HOSTED`, `PARENT_CHILD`, `SAME_ORGANIZER`, `RELATED_COMMUNITY`) through pipeline suggestions plus human confirmation.

### 5.3 Collaboration and sponsor intent

Capture and process collaboration/sponsor intent through curated workflows, not public exchange mechanisms.

### 5.4 Pilot-based workflow standardization

Generalize what works in JITO pilot operations (invite-only, confirmation, manual review, status lifecycle, notes discipline) into reusable ecosystem ops patterns.

### 5.5 Ecosystem observability

Track node verification, edge density, collaboration outcomes, and trust incidents as layer health metrics.

---

## 6. The Ecosystem Graph Model

### 6.1 Conceptual model

```
EcosystemNode {
  kind: community | partner_org | institution | business_group | sponsor_candidate
  trust: claimState + verification + moderation status
  city/metro scope
}

EcosystemEdge {
  type: sister_chapter | co_hosted | parent_child | same_organizer | related
  confidence
  provenance (pipeline_suggested | operator_confirmed)
  updatedAt
}
```

### 6.2 Principles

1. **Trust-gated visibility:** no unverified high-prominence nodes.
2. **Human-confirmed critical edges:** high-impact relationships require operator confirmation.
3. **Composable projections:** journey, admin, and future business/connect surfaces read from the same graph.
4. **No duplicate stores:** additive fields and read models only.

---

## 7. User Experience & Surfaces

### 7.1 As built (pilot)

- Invite-only Business Connect landing and submit flow for JITO Stuttgart.
- Organizer workspace at `/organizer/business-connect`.
- Admin oversight at `/admin/business-connect`.
- No public discovery entry points.

### 7.2 Phase-4 target surfaces

- Ecosystem-aware context modules on relevant city/journey experiences (when density gate passes).
- Organizer tools for relationship/intent operations.
- Internal ecosystem health dashboards.

### 7.3 Interaction model

- Operator-led first.
- Curated, minimal, explainable status workflows.
- Explicitly not social/marketplace UX.

---

## 8. Information Architecture (Overlay, Not Fork)

Phase 4 overlays existing IA; it should not fork canonical city/community/event/resource URLs.

```
Canonical (unchanged):
  /[city]/
  /[city]/communities/[slug]
  /[city]/events/[slug]
  /[city]/resources

Ecosystem/ops additions:
  /organizer/business-connect          (pilot live)
  /admin/business-connect              (pilot live)
  ecosystem graph/operator views       (phase-4 planned, internal/operator-first)
```

Pilot routes remain noindex where invite-only/private by design.

---

## 9. Data & Schema Plan

### 9.1 As-built reality

Pilot persistence already exists:

- `BusinessConnectSubmission`
- `BusinessConnectInvite`

This is valid Phase-4 ecosystem evidence, not yet a generalized public business graph product.

### 9.2 Additive Phase-4 candidates

| Candidate                             | Purpose                   | Constraint                   |
| ------------------------------------- | ------------------------- | ---------------------------- |
| Relationship edge provenance metadata | Better auditability       | Additive only                |
| Partner-org linkage fields            | Parent-child grouping     | No IA disruption             |
| Collaboration readiness fields        | Ops triage quality        | Consent + trust gated        |
| Ecosystem coverage read models        | Metro readiness decisions | Rebuildable from source data |

No heavyweight new content system is required.

---

## 10. Operations & Workflow

1. **Coverage audit first:** measure node and edge density by metro/persona context.
2. **Operator playbook:** standardize invite/review/status/notes patterns from pilot.
3. **Trust operations:** keep manual review for high-stakes collaboration flows.
4. **Escalation path:** organizer-owned decisions with admin oversight and auditable updates.

---

## 11. Dynamic vs Curated Ecosystem Views

**Default:** dynamic projections over verified graph data.

**Curated overlays:** only where ecosystem density is high and operator value is clear (for example, flagship city ecosystem maps or institutional relationship summaries).

Curated does not mean manually authored data silos; it means pinned projection logic over shared graph data.

---

## 12. SEO & Discoverability Strategy

- Private/invite-only flows remain noindex and non-discoverable by default.
- Public ecosystem discoverability should happen only for trust-verified, policy-approved surfaces.
- Canonical content pages stay primary authority pages.
- Avoid doorway-page sprawl and thin "partner" pages.

---

## 13. Sparsity & Quality Guardrails

1. No ecosystem module is promoted in a metro until minimum node+edge density is met.
2. Sparse ecosystems degrade gracefully (show trusted baseline, no fake completeness).
3. No auto-introduction or auto-match.
4. No uncited relationship claims.
5. Trust incidents trigger rollback/feature gating by metro.

---

## 14. Success Metrics

| Metric                                                   | What it proves                         |
| -------------------------------------------------------- | -------------------------------------- |
| Verified ecosystem node count per metro                  | Supply is real, not nominal            |
| Relationship-edge density per metro                      | Graph is becoming usable               |
| Edge confirmation rate                                   | Human trust gate is active             |
| Manual sponsor/collaboration matches completed           | Ops value exists before productization |
| Pilot workflow quality (confirmation, review throughput) | Curated flow is operationally viable   |
| Trust incident rate                                      | Safety posture is intact               |

---

## 15. Sequenced Build Plan

| Step | Work                                                | Status  |
| ---- | --------------------------------------------------- | ------- |
| 0    | Pilot and evidence baseline (JITO)                  | Done    |
| 1    | Ecosystem coverage audit framework                  | Planned |
| 2    | Relationship-edge operations and provenance         | Planned |
| 3    | Partner-org operational activation model            | Planned |
| 4    | Curated sponsor/collaboration ops expansion         | Planned |
| 5    | Ecosystem-aware journey enrichments in dense metros | Planned |
| 6    | Gate review for Phase 5 Business entry              | Planned |

---

## 16. Risks & Mitigations

| Risk                                       | Likelihood | Impact | Mitigation                                          |
| ------------------------------------------ | ---------- | ------ | --------------------------------------------------- |
| Thin graph density                         | Medium     | High   | Metro-level promotion gates + focused backfill      |
| Premature business-product drift           | High       | High   | Keep Phase-4 scope strict; defer to Phase-5 gates   |
| Trust regression from automation           | Medium     | High   | Manual review remains default for high-stakes flows |
| Organizer overload                         | Medium     | Medium | Tight workflow design, templates, status discipline |
| Privacy/GDPR failure in collaboration data | Low        | High   | Consent-by-design, limited exposure, audit logs     |

---

## 17. Explicitly Out of Scope (Deferred to Phase 5+)

- Public business profile catalog.
- Self-serve paid business features.
- Two-sided intro marketplace UX.
- Connect Pro productization.
- Intelligence monetization surfaces.

---

## 18. Exit Criteria -> Phase 5

Phase 4 is done enough to unlock Phase 5 when:

1. At least one metro has a trust-verified, operationally maintained ecosystem graph with usable edge density.
2. Collaboration/sponsor workflows show repeated manual success with low trust incidents.
3. Organizer and admin governance for ecosystem operations is stable and auditable.
4. Evidence supports Business gate entry conditions (strategy section 12.1), rather than hypothetical demand.

Meeting these means Business can launch from a real substrate, not a speculative feature set.

---

_This document defines Phase 4 intent with current implementation context. For strategy-level rationale and gates, see [PRODUCT_DOCUMENT.md](PRODUCT_DOCUMENT.md). For shipped pilot evidence that informs this phase, see [JITO_STUTTGART_BUSINESS_CONNECT_PILOT.md](JITO_STUTTGART_BUSINESS_CONNECT_PILOT.md)._
