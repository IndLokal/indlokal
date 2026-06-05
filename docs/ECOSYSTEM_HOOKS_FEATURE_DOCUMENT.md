# Ecosystem Hooks

_Founder and Product Head Direction - June 2026_

## 0. Document Type and Use

This is a product-direction document.

It defines:

- strategic intent,
- scope boundaries,
- operating principles,
- rollout and decision gates.

It does not define:

- database schema,
- API contracts,
- migration plans,
- component-level implementation.

Per workspace standards, non-trivial build work must be specified through PRD/TDD (and ADR where required) under [docs/specs/](specs/README.md) before implementation.

---

## 1. Executive Summary

We are not launching a separate Business or Connect product now.

We are upgrading the current product with ecosystem hooks: small, governed additions inside existing surfaces that improve quality now and make the graph future-ready.

Execution sequence:

1. keep today simple and trusted,
2. collect structured ecosystem signals,
3. measure real supply and intent,
4. only then decide whether dedicated expansion surfaces are justified.

This protects focus, trust, and execution speed.

---

## 2. Strategic Context

Our wedge remains correct: community and event discovery.

The near-term product must continue to win on:

- local discovery quality,
- trust and freshness,
- low-friction organizer workflows,
- strong admin governance.

Long term, opportunity extends beyond discovery into ecosystem coordination. We should prepare for that future without turning the product into a marketplace too early.

Ecosystem hooks are the bridge between those two realities.

---

## 3. Product Thesis

### 3.1 What we are doing

Strengthening the current product with structured ecosystem metadata and governed visibility.

### 3.2 What we are not doing

No business directory, sponsor marketplace, or networking product in this phase.

### 3.3 Why this is the right move now

- It improves current user value immediately.
- It de-risks future expansion with evidence.
- It keeps product complexity proportional to operational capacity.
- It aligns with existing trust and moderation architecture.

---

## 4. Product Principles

### 4.1 Discover stays simple

Public Discover remains activity-led, city-first, and low-noise.

### 4.2 Governed before exposed

Capture first, validate, then expose.

### 4.3 Signals before surfaces

Collect and validate ecosystem signals before creating dedicated product areas.

### 4.4 Trust is non-transferable

No hook can bypass existing moderation and trust controls.

### 4.5 Taxonomy discipline

Controlled vocabularies first. Free-text expansion only after operational maturity.

### 4.6 Instrument what drives decisions

If a future decision depends on a signal, that signal must be measurable in production.

---

## 5. Ecosystem Hooks Scope

Approved hooks for this direction:

| Hook                                  | Primary capture surface                 | Near-term benefit                                 | Long-term strategic value                       |
| ------------------------------------- | --------------------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| Organization type                     | Organizer, Admin                        | Better classification and moderation clarity      | Segmentation for future ecosystem surfaces      |
| Audience tags                         | Organizer, Admin                        | Better relevance and filtering                    | Better intent graph                             |
| Culture/language tags                 | Organizer, Admin                        | Better city-language matching and content quality | Better identity-aware discovery and SEO         |
| Sponsor/collaboration readiness       | Organizer/Host input with Admin control | Better partnership readiness visibility           | Foundation for future collaboration layer       |
| Business/professional event relevance | Event workflows, Admin review           | Better business-lens quality                      | Quantified business intent by city              |
| Event relationship roles              | Event workflows, Admin review           | Better event actor clarity                        | Early organization-event relationship graph     |
| Public trust indicators               | Admin-governed public labels            | Better user confidence                            | Stronger trust layer for future expansion       |
| Organizer and host insights           | Organizer and host consoles             | Better return behavior and profile quality        | Better operator-side health signals             |
| Admin ecosystem quality view          | Platform Admin                          | Better governance and backfill targeting          | City readiness visibility for scaling decisions |

---

## 6. Hard Non-Goals for This Phase

Not authorized in this phase:

- full business directory,
- sponsor lead-exchange marketplace,
- paid listing inventory,
- professional leader profile product,
- private messaging or social graph networking,
- payment or subscription surfaces tied to these hooks.

Any item above needs separate product approval through spec workflow.

---

## 7. Surface-Level Product Policy

### 7.1 Public Discover

- Show only approved, low-risk labels.
- Avoid card overload.
- Keep trust internals and moderation evidence private.

### 7.2 Organizer and Event Host

- Can submit metadata and readiness intent.
- Cannot self-verify trust indicators.
- Cannot override moderation outcomes.
- Should receive guided input to reduce spam and over-tagging.

### 7.3 Platform Admin

- Owns trust label governance and visibility controls.
- Can override classification and suppress misleading claims.
- Owns ecosystem quality monitoring and corrective action.

---

## 8. Taxonomy Direction (Controlled V1)

### 8.1 Organization type

- Community
- Cultural Association
- Religious Organization
- Temple or Spiritual Group
- Student Group
- Professional Network
- Business Network
- Trade Organization
- Government or Consulate or Institution
- Event Host
- Service Provider
- Other

### 8.2 Audience tags

- Families
- Students
- Professionals
- Entrepreneurs
- Women
- Kids
- Seniors
- Newcomers
- Volunteers
- Artists
- Sports Enthusiasts

### 8.3 Culture/language tags

- Pan-Indian
- Telugu
- Tamil
- Kannada
- Malayalam
- Marathi
- Gujarati
- Punjabi
- Hindi
- Bengali
- Odia
- Rajasthani
- Assamese
- Other

Taxonomy changes require product-owner and admin-operability review.

---

## 9. Event and Trust Alignment Constraints

Ecosystem hooks must stay compatible with current event governance and trust models.

Directional constraints:

- relationship and relevance metadata do not alter moderation lane,
- public role labels must avoid organizer/host ambiguity,
- sponsor/partner claims may be gated for review before display,
- lifecycle and moderation truth remains the source for status communication.

Recommended event relationship roles for v1:

- Organizer
- Host
- Co-host
- Sponsor
- Speaker
- Venue Partner
- Partner Organization
- Volunteer Group
- Media Partner
- Supporting Organization

---

## 10. Data Direction (Conceptual Only)

This section sets product intent only.

### 10.1 Community/organization direction

Should support:

- type,
- audience and culture/language tags,
- readiness signals,
- trust-indicator references,
- completeness signals.

### 10.2 Event direction

Should support:

- business/professional relevance,
- relationship roles,
- trust-safe display metadata.

### 10.3 Future relationship shape (conceptual)

- source entity,
- relationship type,
- target entity,
- status,
- evidence,
- attribution,
- timestamps.

This document does not approve schema, migration, or API decisions.

---

## 11. Rollout Plan

### Phase A: Foundation and governance

- Add hooks to admin and accountable creation/edit surfaces first.
- Start internal data quality and taxonomy calibration.
- Keep public changes minimal.

Exit criteria:

- governance is stable,
- correction workflows are practical,
- no meaningful trust regressions.

### Phase B: Organizer/host readiness loop

- Add ecosystem-readiness capture and completeness guidance.
- Improve quality prompts and input guardrails.

Exit criteria:

- acceptable metadata quality,
- manageable review burden,
- improved organizer/host completion behavior.

### Phase C: Public light exposure

- Expose only approved, low-risk labels.
- Keep discover cards concise and readable.

Exit criteria:

- label quality validated,
- low misinformation risk,
- no discover clutter regression.

### Phase D: Insights and ecosystem-quality operations

- Expand organizer/host insight cards.
- Expand admin ecosystem quality view for city-level actioning.

Exit criteria:

- signals are decision-usable,
- not vanity metrics,
- stable instrumentation and interpretation.

### Phase E: Expansion gate

Decide whether dedicated Business or Connect surfaces are justified.

Decision inputs:

- business-lens adoption and conversion quality,
- city-level event supply depth and continuity,
- sponsor/collaboration readiness density,
- repeated unmet-intent search behavior,
- trust and moderation stability at higher exposure.

---

## 12. Success Criteria

This direction is successful when:

- Discover remains simple and trusted.
- Organizer and host workflows become more valuable and repeatable.
- Admin can identify and fix ecosystem quality gaps by city.
- Classification quality materially improves.
- Collaboration and business-intent signals become measurable and reliable.
- Expansion decisions are evidence-led, not pressure-led.

---

## 13. Risks and Mitigations

### Risk: Taxonomy noise and over-tagging

Mitigation: controlled vocabularies, input guidance, admin override paths.

### Risk: Public trust dilution from premature labels

Mitigation: approval-gated visibility and conservative public exposure rules.

### Risk: Operational burden rises faster than team capacity

Mitigation: phased rollout, city-level calibration, and hard non-goals.

### Risk: Strategic drift toward marketplace prematurely

Mitigation: explicit non-goals and Phase E decision gate requirements.

---

## 14. Open Product Decisions (for Follow-on PRDs)

- Which readiness labels are public by default versus approval-required?
- Which relationship-role claims require explicit review before display?
- What anti-spam and anti-over-tagging controls are mandatory in v1?
- What is the minimum actionable organizer/host insight set?
- What numeric thresholds should gate expansion decisions by city?

---

## 15. Product Head Recommendation

Run ecosystem hooks as a disciplined capability layer, not a feature checklist.

Execution order:

1. governance and quality first,
2. signals and instrumentation second,
3. expansion only after evidence.

This keeps IndLokal coherent now and strategically stronger later.
