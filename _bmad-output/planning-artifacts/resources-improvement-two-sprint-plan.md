# IndLokal Resources Experience - Product Redefinition (Web + Mobile)

Date: 2026-06-10
Owner: Product + Engineering + Design
Horizon: 2 sprints (progressive rollout, no route breakage)

## Document Authority

- This file is the single source of truth for sprint gates, sequencing policy, and execution reality.
- Problem framing and product scope are owned by `resources-improvement-prd-one-pager.md`.
- UX IA and interaction details are owned by `resources-ux-redefinition-blueprint.md`.
- Story acceptance criteria are owned by `resources-improvement-epics-stories.md`.
- Story-level order and owner tags are owned by `../implementation-artifacts/resources-improvement-story-sequence.md`.

## 1) Execution Purpose

Run the resources redefinition in two controlled sprints with strict closure gates before expansion.

What this file owns:

1. Sprint outcomes and gate criteria.
2. Recovery policy and no-go constraints.
3. Cross-surface execution priorities and rollout controls.

What this file does not own:

1. Full PRD problem/scope narrative.
2. Detailed UX interaction specification.
3. Per-story acceptance details.

## 2) Sprint Outcomes and Gates

Sprint 1 user outcome:

- Users can start quickly, get a clear next action, and resume progress.

Sprint 1 gate to proceed:

1. Time-to-first-meaningful-action improves versus baseline.
2. Dead-end rate declines versus baseline.
3. Mobile manual UAT evidence complete for 2.1, 2.3, and 3.2.
4. Story 4.3 dashboard and data-quality gates are passing.

Sprint 2 user outcome:

- Users convert from resources into real participation loops.

Sprint 2 gate to expand rollout:

1. Journey progression rate improves versus Sprint 1 baseline.
2. Resource-to-community/event conversion improves.
3. No Sev1/Sev2 regressions in pilot surfaces.

## 3) Delivery Constraints

1. Preserve city routes and SEO URL behavior.
2. Keep rollout additive and behind feature flags.
3. Do not expand cohort while Sprint 1 remains open.
4. Prioritize proof (UAT + data quality) over net-new scope.

## 4) Risks and Tradeoffs (Execution)

1. Route safety limits structural refactors in this window.
2. Core parity comes before polish parity.
3. Deterministic next-action logic is preferred before deeper personalization.
4. Telemetry must be enough for decisions, not a full analytics rebuild.

## Deferred Track Reference

Content-ops and freshness-governance work is intentionally separated from Sprint 1/2 execution and tracked in:

- `phase-3-content/resources-content-structure-and-freshness-plan.md`

## 5) Execution Reality Reset (2026-06-10)

Current truth:

- Sprint 1 is not closed.
- Stories 2.1, 2.3, and 3.2 are implemented in code but remain conditional until mobile UAT and parity evidence are complete.
- Story 4.3 remains blocked by live dashboard readiness and post-deploy data quality checks.
- Sprint 2 stories (3.1, 2.2, 4.1) are not ready to execute at full speed until Sprint 1 gates are passed.

Delivery policy from this point:

- No rollout expansion before Sprint 1 closure gates pass.
- No new major feature lanes until 4.3 is unblocked.
- Prioritize proof (UAT + analytics quality) over additional implementation volume.

## 6) Four-Week Recovery Schedule (John)

### Week 1 - Sprint 1 Closure Sprint (stabilize and prove)

Scope:

1. Complete mobile manual UAT for 2.1, 2.3, 3.2 with evidence artifacts.
2. Finalize CTA and next-action policy matrix signoff.
3. Ship dashboard MVP panels for 4.3 and validate event ingestion.
4. Run focused UX crowding audit on other key surfaces:
   - web city feed (`/[city]`)
   - web consular services (`/[city]/consular-services`)
   - web weekly events (`/[city]/indian-events-this-week`)
   - mobile discover tab (`/(tabs)/index`)

Exit gates:

- Mobile UAT evidence complete for 2.1, 2.3, 3.2.
- Dashboard panels live for activation/progression/conversion/resume.
- Event dimension completeness >= 95% and required-field null-rate <= 5%.

### Week 2 - Controlled Pilot + Defect Burn

Scope:

1. Pilot one city/persona cohort under flags.
2. Fix all Sprint 1 functional and UX defects found in pilot.
3. Accessibility closeout for trust/freshness and CTA/resume modules.

Exit gates:

- Dead-end rate improvement vs baseline.
- Time-to-first-meaningful-action improvement vs baseline.
- No Sev1/Sev2 defects on pilot surfaces.

### Week 3 - Sprint 2 Narrowed Build

Scope:

1. Story 3.1 related communities/events at decision points only.
2. Story 2.2 lightweight save/remind (MVP only).
3. Story 1.3 hardening closeout.
4. Apply declutter fixes to high-risk non-resources surfaces (Sally track):
   - web city feed density reduction
   - mobile discover control stack reduction

Exit gates:

- Related module and save/remind telemetry queryable.
- No regression in task completion from declutter changes.

### Week 4 - Sprint 2 Hardening + Expansion Decision

Scope:

1. Story 4.1 ranking adjustments under controlled flag.
2. One experiment lane per surface max (avoid overlapping tests).
3. Decide whether to expand to second city cohort.

Exit gates:

- Journey progression rate uplift vs Week 2 pilot.
- Resource-to-community/event conversion uplift.
- Ranking regression within agreed tolerance.

## 7) Cross-Page UX Priority Track (Sally)

Risk ratings:

- High: web city feed (`/[city]`), mobile discover (`/(tabs)/index`)
- Medium: mobile resources (`/resources`)
- Low: web resources (`/[city]/resources`), web consular, web weekly events

Sprint 1 close actions (must-do):

1. Web city feed: default-collapse lower-priority sections and cap visible cards.
2. Web city feed: enforce one primary CTA per section.
3. Mobile discover: hide non-essential controls by default and remove control overload.
4. Mobile discover: move city chips to horizontal rail and simplify first viewport.

Sprint 2 actions (next):

1. Web city feed sticky mini-nav and merged exploration blocks.
2. Mobile discover state persistence and microcopy tuning.
3. Mobile resources metadata compression and interaction polish.

## 8) Governance and Rollout Controls

Cadence:

1. Daily execution standup (blockers + gate status).
2. Twice-weekly QA/Data checkpoint (UAT evidence + dashboard health).
3. Weekly formal go/no-go review (Product, Eng, QA, Data).

Rollout rules:

1. Continue canary/limited cohort while Sprint 1 remains open.
2. Freeze expansion immediately if data quality gates fail.
3. Expansion allowed only after all Sprint 1 closure gates are green.
