# Resources Trust, Freshness, and Ops QA Checklist

Date: 2026-06-10
Owner: QA + Product + Ops
Status: pending track start

## Canonical References

- Track board: `resources-trust-freshness-ops-execution-board.md`
- Track plan: `../planning-artifacts/resources-trust-freshness-ops-plan.md`

## Wave 1 - Trust Contract and Governance

### A1 Resource trust read model and surface contract

- [ ] Same resource shows same trust band on hub, category, and journey surfaces.
- [ ] Source label is visible and non-misleading.
- [ ] Last verified timestamp displays when available.
- [ ] Missing verification data degrades honestly.
- [ ] Web a11y check passes for trust/freshness semantics.

Evidence:

- [ ] Hub screenshots
- [ ] Category screenshots
- [ ] Journey screenshots
- [ ] Trust wording signoff

### A2 Owned-content governance gate

- [ ] Owned-content creation path requires rationale.
- [ ] Curated/non-owned path does not require irrelevant fields.
- [ ] Governance data is persisted and auditable.
- [ ] Admin validation errors are understandable.

Evidence:

- [ ] Admin create/edit screenshots
- [ ] Validation proof notes
- [ ] Audit log proof notes

## Wave 2 - Freshness Operating System

### B1 Freshness lifecycle automation

- [ ] TTL breach is computed correctly.
- [ ] Stale demotion applies correctly.
- [ ] Prolonged stale hide/archive guardrails behave as expected.
- [ ] Resolver/ranking reflects lifecycle state.

Evidence:

- [ ] Fixture-based proof notes
- [ ] Ranking/order screenshots
- [ ] Lifecycle transition notes

### B2 Re-verification queue and SLA

- [ ] Eligible stale resources enter queue.
- [ ] Priority order matches risk/traffic/staleness logic.
- [ ] Reviewer assignment and SLA fields save correctly.
- [ ] Queue resolution updates resource lifecycle state.

Evidence:

- [ ] Queue screenshots
- [ ] Resolution flow notes
- [ ] SLA sample rows

## Wave 3 - Supply Ops and Measurement

### C1 Journey-gap to supply ops loop

- [ ] Coverage report produces backlog rows.
- [ ] Priority logic is visible and understandable.
- [ ] Owner + SLA flow works.

### C2 Section 17 KPI and dashboard contract

- [ ] Trusted Journey Resource Coverage is queryable.
- [ ] Percent within TTL is queryable.
- [ ] Stale exposure rate is queryable.
- [ ] Anti-metrics are visible for review.

Evidence:

- [ ] Dashboard/readout screenshots
- [ ] Metric definition notes
- [ ] Sample query output notes

## Track Closure Gate

- [ ] All Wave 1 items passed
- [ ] All Wave 2 items passed
- [ ] All Wave 3 items passed
- [ ] No Sev1/Sev2 regression on resource surfaces
- [ ] Product + Ops signoff complete
