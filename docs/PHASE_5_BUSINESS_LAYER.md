# IndLokal — Phase 5: Business Layer (Product Document)

**Status: Designed / Not yet fully built (with pilot validation already shipped).** This is the product document for Phase 5 of the [IndLokal product strategy](PRODUCT_DOCUMENT.md). It follows [Phase 1](PHASE_1_DISCOVERY_FOUNDATION.md), [Phase 2](PHASE_2_JOURNEY_LAYER.md), [Phase 3](PHASE_3_PERSONALIZATION_LAYER.md), and [Phase 4](PHASE_4_ECOSYSTEM_LAYER.md).

**Current implementation context:** the [JITO Stuttgart Business Connect Pilot](JITO_STUTTGART_BUSINESS_CONNECT_PILOT.md), delivered via [PRD-0054](specs/PRD/0054-jito-stuttgart-business-connect-pilot.md) / [TDD-0054](specs/TDD/0054-jito-stuttgart-business-connect-pilot.md), is already live as an invite-only, manually reviewed, private workflow. It is treated here as **gate evidence and operational input**, not as a full Phase-5 Business product rollout.

> **The one-sentence thesis:** Phase 5 productizes trusted business participation on top of a dense, verified ecosystem graph: verified business identity, controlled business reach into journeys/communities, and paid value surfaces that remain curated, consented, and trust-gated.

> **This is a strategy/PRD-precursor document, not an implementation spec.** Aside from the shipped pilot, concrete Business Layer capabilities will be specified in new PRD/TDD pairs when this phase starts. This document defines scope, gates, sequencing, and non-negotiable trust/marketplace guardrails.

---

## Table of Contents

1. [Why Phase 5, and Why Only After Phase 4](#1-why-phase-5-and-why-only-after-phase-4)
2. [What the Business Layer Is (Precise Definition)](#2-what-the-business-layer-is-precise-definition)
3. [Foundation Already in Place](#3-foundation-already-in-place)
4. [Scope: In / Out](#4-scope-in--out)
5. [Core Business Capabilities](#5-core-business-capabilities)
6. [The Business Graph Model](#6-the-business-graph-model)
7. [User Experience & Surfaces](#7-user-experience--surfaces)
8. [Information Architecture (Overlay, Not Marketplace Fork)](#8-information-architecture-overlay-not-marketplace-fork)
9. [Data & Schema Plan](#9-data--schema-plan)
10. [Operations, Trust & Governance](#10-operations-trust--governance)
11. [Curated-First vs Self-Serve Expansion](#11-curated-first-vs-self-serve-expansion)
12. [SEO & Discoverability Strategy](#12-seo--discoverability-strategy)
13. [Safety, Privacy & Consent Guardrails](#13-safety-privacy--consent-guardrails)
14. [Success Metrics](#14-success-metrics)
15. [Sequenced Build Plan](#15-sequenced-build-plan)
16. [Risks & Mitigations](#16-risks--mitigations)
17. [Explicitly Out of Scope (Deferred to Phase 6+)](#17-explicitly-out-of-scope-deferred-to-phase-6)
18. [Exit Criteria -> Phase 6](#18-exit-criteria---phase-6)

---

## 1. Why Phase 5, and Why Only After Phase 4

Business participation has high upside and high trust risk. Launching too early creates a low-quality directory or lead board that damages user trust and ecosystem credibility.

Phase 5 only makes sense once Phase 4 has done its job:

1. **Verified supply exists:** enough credible business/institutional nodes are present.
2. **Relationship context exists:** business entities sit within a meaningful ecosystem graph.
3. **Demand is proven:** journey and ecosystem interactions show real business-intent signals.
4. **Ops evidence exists:** manual, curated workflows have shown repeat value and low incident rates.

The JITO pilot contributes directly to (3) and (4), but does not, by itself, satisfy full market-density requirements for Business launch.

---

## 2. What the Business Layer Is (Precise Definition)

The Business Layer is the trust-verified, curated participation surface for businesses and business-relevant organizations to engage the diaspora ecosystem without turning IndLokal into an open marketplace.

```
Business Layer = b(verified business identity, ecosystem context, curated reach controls, trust governance)
               -> business profiles + controlled placement + measurable outcomes
```

**It IS:**

- Verified business identity and role-backed participation.
- Controlled, context-relevant business visibility in ecosystem/journey surfaces.
- Curated lead and collaboration pathways with explicit review gates.
- A monetizable B2B layer (Business Pro) when value is proven.

**It is NOT:**

- A public classifieds board.
- Open self-serve lead scraping.
- Auto-matching or auto-introductions.
- A generic payments marketplace.

---

## 3. Foundation Already in Place

### 3.1 Existing building blocks

| Foundation                                               | Current state  | Phase-5 use                            |
| -------------------------------------------------------- | -------------- | -------------------------------------- |
| Trust layer (claim/moderation/verification)              | Live           | Gate business visibility and authority |
| RBAC and scoped operations                               | Live           | Business operator governance           |
| Ecosystem hooks (`organizationType`, `RelationshipEdge`) | Live/expanding | Context for business relevance         |
| Outreach/ops workflows                                   | Live           | Curated matching and quality control   |
| Journey and discovery demand signals                     | Live           | Evidence of business-intent demand     |

### 3.2 Pilot proof already shipped

The JITO pilot has validated:

- Invite-only business intake under community authority.
- Double opt-in confirmation and manual review lifecycle.
- Structured intent capture with consent controls.
- Private handling and no public exposure by default.

These are foundational operating patterns for Business Layer trust posture.

### 3.3 What is still missing for full Phase 5

- Metro-scale verified business supply density.
- Standardized verification/badge workflow for business entities.
- Productized business reach surfaces with clear policy and pricing boundaries.
- Evidence that curated outcomes are repeatable beyond one pilot context.

---

## 4. Scope: In / Out

### 4.1 In scope (Phase 5)

1. Verified business profile model and workflow.
2. Business eligibility and trust-badge issuance workflow.
3. Controlled business visibility in relevant journey/ecosystem contexts.
4. Curated lead/collaboration management surfaces for operators.
5. Business Pro packaging and billing readiness (gated rollout).
6. Governance and abuse-handling policies for business participation.

### 4.2 Out of scope (deferred)

- Productized introductions marketplace (Phase 6 Connect).
- Self-serve open lead exchange.
- Automated matching and negotiation flows.
- Public ranking auction/ad exchange mechanics.
- Intelligence productization surfaces (Phase 7).

---

## 5. Core Business Capabilities

### 5.1 Verified business identity and profile

Business entities can participate only after verification and trust checks, with clear provenance of who controls the profile.

### 5.2 Context-controlled business reach

Business presence appears where context justifies it (relevant journeys/ecosystem segments), never as broad spam exposure.

### 5.3 Curated business intent intake

Carry forward proven pilot patterns: structured intent capture, consent controls, confirmation, and review lifecycle.

### 5.4 Operator-grade review and lifecycle

Status workflow, notes, and auditability remain central. High-stakes decisions are operator-owned with admin oversight.

### 5.5 Monetization readiness (Business Pro)

Paid packaging only after demonstrated value, low incident rates, and stable trust governance.

---

## 6. The Business Graph Model

### 6.1 Conceptual model

```
BusinessNode {
  identity: verified/legal profile
  trust: verification + moderation state
  ecosystemContext: linked communities/partner org edges
  intentSignals: offerings + looking_for + geography + industry
}

BusinessInteraction {
  source: journey | ecosystem | curated intake
  status: reviewed lifecycle state
  outcome: manual match, declined, archived, etc.
}
```

### 6.2 Principles

1. **Trust before reach:** no verified trust, no prominent visibility.
2. **Context before scale:** placements are context-scoped, not blanket distribution.
3. **Human-controlled high-stakes actions:** especially intros and sensitive sharing.
4. **Composable data model:** one graph supports future Connect and Intelligence layers.

---

## 7. User Experience & Surfaces

### 7.1 As-built pilot surface (today)

- Invite-only JITO landing + submit routes.
- Organizer review workspace.
- Admin read-only oversight.
- Private submissions; no public business listing.

### 7.2 Phase-5 target business surfaces

- Verified business profile surfaces (policy- and trust-gated).
- Controlled placement in relevant ecosystem/journey contexts.
- Operator review and quality control workspaces.
- Business participation metrics and account health views.

### 7.3 UX stance

- Trust-first and curated.
- Explicitly anti-spam and anti-marketplace noise.
- User value over inventory volume.

---

## 8. Information Architecture (Overlay, Not Marketplace Fork)

Phase 5 should extend existing IA and private ops routes, not fork into a separate marketplace architecture.

```
Canonical base stays:
  /[city]/
  /[city]/journeys/[persona]
  /[city]/communities/[slug]
  /[city]/events/[slug]

Private ops/business surfaces:
  /organizer/business-connect     (pilot live)
  /admin/business-connect         (pilot live)
  additional business ops/profile routes (phase-5 planned)
```

No open, indexable lead board is introduced.

---

## 9. Data & Schema Plan

### 9.1 As-built baseline from pilot

Pilot data persistence already exists and is useful:

- `BusinessConnectSubmission`
- `BusinessConnectInvite`
- confirmation/status/notes lifecycle fields

### 9.2 Additive Phase-5 candidates

| Candidate                                  | Purpose                     | Constraint                       |
| ------------------------------------------ | --------------------------- | -------------------------------- |
| Verified business profile model extensions | Identity and trust state    | Additive, policy-first           |
| Business eligibility and badge metadata    | Controlled visibility gates | Auditable workflow               |
| Business engagement read models            | Outcome measurement         | Rebuildable, not source-of-truth |
| Billing linkage fields (Business Pro)      | Monetization readiness      | Isolated, reversible rollout     |

Avoid major schema churn until gates are met.

---

## 10. Operations, Trust & Governance

1. **Verification pipeline:** define and enforce business verification policy.
2. **Review lifecycle discipline:** preserve structured status + notes operations.
3. **Authority model:** community-scoped organizer actions with admin oversight.
4. **Incident response:** report, triage, and remediate abuse quickly.
5. **Consent governance:** maintain explicit consent and data-sharing boundaries.

JITO pilot workflow should be treated as the reference operating baseline.

---

## 11. Curated-First vs Self-Serve Expansion

**Default:** curated-first, operator-mediated Business Layer.

Self-serve expansion can be considered only after:

- repeated high-quality outcomes,
- low abuse rates,
- reliable verification workflows,
- and clear economic value.

This preserves trust and avoids premature marketplace dynamics.

---

## 12. SEO & Discoverability Strategy

- Keep private/intake routes noindex.
- Any public business surface must be quality-dense and verification-forward.
- Canonical city/community/journey pages remain primary discovery rails.
- Do not create thin, keyword-stuffed business listing pages.

---

## 13. Safety, Privacy & Consent Guardrails

1. No public read API for sensitive submissions.
2. Explicit consent capture; no pre-checked legal boxes.
3. Data sharing only within reviewed, relevant match contexts.
4. GDPR controls for withdrawal/access/erasure requests.
5. Analytics on non-sensitive structured properties only.
6. No AI auto-approval or auto-introduction for high-stakes business actions.

---

## 14. Success Metrics

| Metric                                      | What it proves                   |
| ------------------------------------------- | -------------------------------- |
| Verified business profile count (per metro) | Supply maturity for launch       |
| Business profile trust pass rate            | Verification quality             |
| Business-context engagement rate            | Relevance of placements          |
| Curated match completion rate               | Real-world utility               |
| Review throughput + SLA adherence           | Operational viability            |
| Consent compliance and incident rate        | Safety posture is healthy        |
| Pilot-to-scaled conversion quality          | Transferability beyond one pilot |

---

## 15. Sequenced Build Plan

| Step | Work                                                        | Status  |
| ---- | ----------------------------------------------------------- | ------- |
| 0    | Pilot evidence baseline (JITO)                              | Done    |
| 1    | Define Business verification and badge workflow             | Planned |
| 2    | Build verified business profile capability (operator-first) | Planned |
| 3    | Controlled business reach in dense ecosystem contexts       | Planned |
| 4    | Business outcome metrics and governance hardening           | Planned |
| 5    | Business Pro pricing/billing rollout (gated)                | Planned |
| 6    | Gate review for Connect readiness (Phase 6)                 | Planned |

---

## 16. Risks & Mitigations

| Risk                                 | Likelihood | Impact | Mitigation                                            |
| ------------------------------------ | ---------- | ------ | ----------------------------------------------------- |
| Premature launch with thin supply    | Medium     | High   | Enforce strategy gate thresholds before exposure      |
| Trust damage from low-quality actors | Medium     | High   | Verification, moderation, and strict review workflows |
| Marketplace spam dynamics            | High       | High   | Curated-first model, no open board, scoped visibility |
| Policy/GDPR missteps                 | Low        | High   | Explicit consent design + auditable operations        |
| Overfitting to one pilot context     | Medium     | Medium | Multi-context validation before broad rollout         |

---

## 17. Explicitly Out of Scope (Deferred to Phase 6+)

- Productized introductions and matching marketplace UX.
- Automated two-sided negotiation flows.
- Connect Pro and intro acceptance pipelines.
- Intelligence/insights monetization layer.

---

## 18. Exit Criteria -> Phase 6

Phase 5 is done enough to unlock Phase 6 when:

1. Business verification and trust governance are stable at metro scale.
2. Business participation yields repeated, measurable, low-incident outcomes.
3. Controlled business reach shows genuine user and partner value.
4. Strategy section 12.2 Connect entry-gate prerequisites are evidenced, not assumed.

That is the point where introductions can be responsibly productized into Connect.

---

_This document defines Phase 5 intent with shipped pilot context. For strategy-level gate logic, see [PRODUCT_DOCUMENT.md](PRODUCT_DOCUMENT.md). For the implemented pilot foundation, see [JITO_STUTTGART_BUSINESS_CONNECT_PILOT.md](JITO_STUTTGART_BUSINESS_CONNECT_PILOT.md)._# IndLokal — Phase 5: Business Layer (Product Document)

**Status: Designed / Not yet built as a product (with pilot validation signals live).** This is the product document for Phase 5 of the [IndLokal product strategy](PRODUCT_DOCUMENT.md). Where [Phase 4](PHASE_4_ECOSYSTEM_LAYER.md) defines the ecosystem graph substrate, this document defines how IndLokal Business is launched only when the strategy gates are met.

**As-built context already in place:** the [JITO Stuttgart Business Connect Pilot](JITO_STUTTGART_BUSINESS_CONNECT_PILOT.md) is implemented via [PRD-0054](specs/PRD/0054-jito-stuttgart-business-connect-pilot.md) / [TDD-0054](specs/TDD/0054-jito-stuttgart-business-connect-pilot.md). It validates curated, trust-gated business-intent capture and manual matching workflow. It does **not** mean the Business layer is launched.

> **The one-sentence thesis:** Phase 5 productizes trusted business value on top of a verified ecosystem graph: credible business presence, journey-aligned reach, and operator-supervised outcomes, while preserving IndLokal's trust posture and avoiding premature marketplace behavior.

> **This is a strategy/PRD-precursor document, not an implementation spec.** Outside of the shipped pilot ([PRD/TDD-0054](specs/PRD/0054-jito-stuttgart-business-connect-pilot.md)), concrete Phase-5 capabilities require new PRD/TDD specs. This document defines scope, gate criteria, sequencing, and non-negotiable trust constraints.

---

## Table of Contents

1. [Why Phase 5, and Why Only After Phase 4](#1-why-phase-5-and-why-only-after-phase-4)
2. [What the Business Layer Is (Precise Definition)](#2-what-the-business-layer-is-precise-definition)
3. [Foundation Already in Place](#3-foundation-already-in-place)
4. [Scope: In / Out](#4-scope-in--out)
5. [Core Business Capabilities](#5-core-business-capabilities)
6. [The Business Data/Trust Model](#6-the-business-datatrust-model)
7. [User Experience & Surfaces](#7-user-experience--surfaces)
8. [Information Architecture (Overlay, Not Marketplace Fork)](#8-information-architecture-overlay-not-marketplace-fork)
9. [Data & Schema Plan](#9-data--schema-plan)
10. [Operations & Governance](#10-operations--governance)
11. [Curated-First vs Self-Serve](#11-curated-first-vs-self-serve)
12. [Privacy, Consent & Legal Posture](#12-privacy-consent--legal-posture)
13. [Trust & Safety Guardrails](#13-trust--safety-guardrails)
14. [Success Metrics](#14-success-metrics)
15. [Sequenced Build Plan](#15-sequenced-build-plan)
16. [Risks & Mitigations](#16-risks--mitigations)
17. [Explicitly Out of Scope (Deferred to Phase 6+)](#17-explicitly-out-of-scope-deferred-to-phase-6)
18. [Exit Criteria -> Phase 6](#18-exit-criteria---phase-6)

---

## 1. Why Phase 5, and Why Only After Phase 4

The strategy is explicit: Business is not a date-based launch; it is a gate-based launch (strategy section 12.1). If launched before graph density, trust maturity, and demand proof, Business becomes a thin directory or noisy lead board and damages credibility.

Phase 5 exists to answer:

> _"Can verified businesses get meaningful reach into diaspora journeys and communities?"
> "Can we turn curated business demand into repeatable, trusted outcomes?"
> "Can this be monetized without compromising trust and community quality?"_

Why only after Phase 4:

1. **Dependency:** Business needs verified ecosystem supply and relationship context; otherwise profiles are empty shells.
2. **Trust-first requirement:** higher abuse/spam risk means moderation and verification workflows must be mature first.
3. **Demand proof:** manual curated workflows (including JITO pilot evidence) must show repeated value before productization.
4. **Monetization readiness:** billing and entitlement rails must exist before Business Pro packaging.

---

## 2. What the Business Layer Is (Precise Definition)

The Business Layer is a trust-verified set of business-facing capabilities that connect relevant businesses to diaspora journeys and ecosystem demand in a curated, safety-first way.

```
Business Layer = b(verified business identity, ecosystem graph, journey demand, trust workflows)
               -> business presence + qualified reach + operator-supervised outcomes
```

**It IS:**

- Verified business identity and profile quality.
- Contextual reach into trusted journey/ecosystem surfaces.
- Curated, measurable demand/engagement outcomes.
- Monetization via Business Pro only after gate maturity.

**It is NOT:**

- Open marketplace mechanics.
- Public lead exchange board.
- Unverified self-serve listing system.
- Automated matching/introductions (Phase 6 territory).

---

## 3. Foundation Already in Place

### 3.1 Structural prerequisites

| Foundation                                                              | Current state                | Business-layer use                          |
| ----------------------------------------------------------------------- | ---------------------------- | ------------------------------------------- |
| Trust layer (verification, moderation, claim)                           | Live                         | Gate all business visibility and prominence |
| Ecosystem hooks (`organizationType`, relationships, roles)              | Live but partially activated | Relationship context for business relevance |
| Journey demand signals (Phase 2 live, Phase 3 planned)                  | Partially live               | Audience-intent routing and relevance       |
| Outreach/ops workflows                                                  | Live                         | Curated high-trust business operations      |
| Pilot data model (`BusinessConnectSubmission`, `BusinessConnectInvite`) | Live                         | Demand validation and workflow evidence     |

### 3.2 Pilot evidence relevant to Business

JITO pilot proves:

- Invite-only business intake can maintain quality.
- Organizer-scoped review workflows are viable.
- Double opt-in plus manual review reduces low-quality submissions.
- Status lifecycle and notes produce actionable matching context.

Pilot limitations (important):

- No public business profile surface.
- No business monetization.
- No automated matching.
- No generalized multi-metro business layer.

---

## 4. Scope: In / Out

### 4.1 In scope (Phase 5)

1. Verified business profiles with clear trust status and quality bars.
2. Business relevance projection into journeys/communities where contextually appropriate.
3. Business Pro capability packaging and entitlement model.
4. Verified-badge and moderation workflow for business entities.
5. Curated business demand operations backed by measurable quality outcomes.
6. Business analytics readouts for performance and trust safety.

### 4.2 Out of scope (deferred)

- Productized introduction network UX (Phase 6).
- Open two-sided marketplace behavior.
- Auto-introductions or AI-driven match decisions.
- Payments/transaction rails between third parties.
- Broad public business directory expansion without trust controls.

---

## 5. Core Business Capabilities

### 5.1 Verified business presence

Profiles are only prominent when verification/trust criteria are satisfied; unverified or low-confidence entities do not get premium exposure.

### 5.2 Journey-aligned reach

Business entities appear in context where they are genuinely useful to a user's journey stage/persona, never as generic ad-like inserts.

### 5.3 Business intent operations

Capture, triage, and curate business opportunities with structured workflows and explicit consent handling.

### 5.4 Business Pro packaging

Monetizable business feature set (visibility, qualified reach, selected operational support) only after gate thresholds are met.

### 5.5 Quality and abuse controls

Trust scoring, moderation, and reporting are built into the business workflow from day one of launch.

---

## 6. The Business Data/Trust Model

### 6.1 Conceptual model

```
BusinessNode {
  identity: legal/business signals + verification state
  context: city/metro + organizationType + ecosystem links
  trust: moderation status + claim/verification history
  relevance: journey/persona/stage fit signals
}

BusinessOutcome {
  type: qualified_engagement | curated_match | sponsored_activation
  provenance: operator_curated | policy_approved
  quality: acceptance/satisfaction/dispute markers
}
```

### 6.2 Core principles

1. **Verification before amplification.**
2. **Contextual relevance over broad exposure.**
3. **Operator-auditable state transitions.**
4. **Same graph, multiple projections (no parallel silos).**

---

## 7. User Experience & Surfaces

### 7.1 As-built today (pre-Phase-5)

- JITO invite-only submission and review surfaces (`/jito-stuttgart/business-connect`, `/organizer/business-connect`, `/admin/business-connect`).
- No public Business surface.

### 7.2 Phase-5 target surfaces

- Business profile and trust indicators in approved contexts.
- Business visibility modules in relevant journey/ecosystem views.
- Operator and admin business governance surfaces.
- Business Pro account and capability management.

### 7.3 UX posture

- Utility-first, not promotional-first.
- Trust cues visible and explicit.
- Curated pathways before any self-serve expansion.

---

## 8. Information Architecture (Overlay, Not Marketplace Fork)

Business features layer onto existing IA and ecosystem operations; they should not create a disconnected marketplace product.

```
Canonical discovery/journey IA remains primary.
Business layer adds contextual business surfaces and operator/admin governance views.
Pilot private routes remain invite-only/noindex where appropriate.
```

No homepage-wide business promotion until gate thresholds and quality metrics are stable.

---

## 9. Data & Schema Plan

### 9.1 Current implemented base

- `BusinessConnectSubmission`
- `BusinessConnectInvite`

These provide trusted demand-capture and curation evidence.

### 9.2 Additive Phase-5 candidates

| Candidate                                  | Purpose                                    | Constraint                             |
| ------------------------------------------ | ------------------------------------------ | -------------------------------------- |
| Verified business profile model extensions | Public-safe business identity and metadata | Trust-gated and moderation-aware       |
| Business relevance linkage fields          | Journey/ecosystem contextual projection    | Additive and auditable                 |
| Business Pro entitlement records           | Monetization and capability gating         | No pay-to-bypass trust controls        |
| Business outcome telemetry model           | Quality and ROI measurement                | Privacy-safe, non-sensitive by default |

No schema should create an uncontrolled public listing path.

---

## 10. Operations & Governance

1. **Business gate check (blocking):** apply strategy section 12.1 gate criteria per launch metro.
2. **Verification workflow:** define SLAs and role responsibilities for business verification.
3. **Moderation policy:** enforce content/claims standards before profile amplification.
4. **Operator workflows:** keep manual review authority for high-risk actions.
5. **Admin oversight:** independent read/approval visibility with audit trails.

---

## 11. Curated-First vs Self-Serve

**Default at launch:** curated-first.

Why:

- Trust risk is highest in business contexts.
- Signal quality is still maturing.
- Operator review produces training data for future automation.

**Self-serve expansion:** only when abuse rates, dispute rates, and profile quality metrics remain within defined bounds over sustained periods.

---

## 12. Privacy, Consent & Legal Posture

- Consent remains explicit for submitted business-intent data.
- Data sharing remains purpose-bound and minimal.
- GDPR rights flow (access/erasure/withdrawal) is retained for business submissions.
- Sensitive free-text handling is restricted in analytics and operational exports.
- Legal posture follows the same trust-first standard as pilot workflows.

---

## 13. Trust & Safety Guardrails

1. No verified badge without verification workflow completion.
2. No pay-to-rank bypass of trust and relevance rules.
3. No auto-published high-impact claims.
4. No auto-introductions.
5. No public read path for private submission data.
6. Incident-based rollback/gating by metro when needed.

---

## 14. Success Metrics

| Metric                                                 | What it proves                          |
| ------------------------------------------------------ | --------------------------------------- |
| Verified business profile count (quality-filtered)     | Supply is credible                      |
| Business profile completeness + verification pass rate | Operational quality is real             |
| Journey-context business engagement rate               | Relevance is useful, not noise          |
| Curated business outcomes completed                    | Business value exists before automation |
| Business Pro conversion + retention                    | Monetization is value-backed            |
| Abuse/dispute rate                                     | Trust posture is preserved              |
| Time-to-review/decision SLA                            | Operations can scale responsibly        |

---

## 15. Sequenced Build Plan

| Step | Work                                                  | Status  |
| ---- | ----------------------------------------------------- | ------- |
| 0    | Pilot evidence baseline (JITO workflow)               | Done    |
| 1    | Gate validation against strategy section 12.1         | Planned |
| 2    | Business verification + moderation workflow hardening | Planned |
| 3    | Business profile model and governance surfaces        | Planned |
| 4    | Contextual journey/ecosystem business projection      | Planned |
| 5    | Business Pro packaging + entitlement rails            | Planned |
| 6    | Scale review and prep for Phase 6 gate                | Planned |

---

## 16. Risks & Mitigations

| Risk                                              | Likelihood | Impact | Mitigation                                           |
| ------------------------------------------------- | ---------- | ------ | ---------------------------------------------------- |
| Launching before gate maturity                    | Medium     | High   | Enforce explicit gate review with no exceptions      |
| Trust erosion via low-quality profiles            | Medium     | High   | Verification-first + moderation SLAs                 |
| Marketplace drift                                 | Medium     | High   | Keep curated-first scope and out-of-scope boundaries |
| Monetization pressure distorting ranking          | Medium     | High   | No pay-to-rank without trust/relevance constraints   |
| Operational overload                              | Medium     | Medium | Stepwise rollout, templates, SLA instrumentation     |
| Privacy/legal mishandling of business intent data | Low        | High   | Consent controls + limited data exposure + audits    |

---

## 17. Explicitly Out of Scope (Deferred to Phase 6+)

- Productized intro/match network.
- Connect Pro relationship workflow productization.
- Fully open self-serve marketplace behavior.
- Intelligence packaging from business graph outcomes.

---

## 18. Exit Criteria -> Phase 6

Phase 5 is done enough to unlock Phase 6 when:

1. Business gate criteria remain satisfied in live operation (not just pre-launch checks).
2. Verified business supply and contextual engagement are healthy across at least one launch metro.
3. Curated business outcomes are repeatable with low dispute/abuse rates.
4. Operator and trust workflows scale with auditability and acceptable SLAs.
5. Evidence supports Connect gate entry criteria (strategy section 12.2) from real operations.

Meeting these means Connect can be productized from proven behavior, not speculative design.

---

_This document defines Phase 5 intent with current implementation context. For gating rules and full capability ladder, see [PRODUCT_DOCUMENT.md](PRODUCT_DOCUMENT.md). For ecosystem preconditions, see [PHASE_4_ECOSYSTEM_LAYER.md](PHASE_4_ECOSYSTEM_LAYER.md). For shipped pilot evidence, see [JITO_STUTTGART_BUSINESS_CONNECT_PILOT.md](JITO_STUTTGART_BUSINESS_CONNECT_PILOT.md)._
