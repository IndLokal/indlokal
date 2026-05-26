# PRD-0024: Scoped pipeline source strategy and run observability

- **Status:** Draft
- **Owner:** Founders
- **Reviewers:** PM, Eng Lead
- **Linked:** TDD-0024, PRD/TDD-0013, PRD-0023

## 1. Problem

As we scale city/region onboarding, pipeline runs must be deterministic per scope and observable per shard.

Without explicit scope strategy and run-level scope persistence:

- scoped runs pull noisy/non-local sources,
- failures are hard to isolate by region,
- and rollout to regions such as NRW becomes operationally brittle.

## 2. Users & JTBD

- **Ops owner:** run targeted scope and trust run outputs.
- **Admin reviewer:** receive cleaner region-relevant queue items.
- **Engineer:** add next region without changing orchestrator primitives.

## 3. Success Metrics

- Scoped runs include only relevant CITY/REGION pinned strategies.
- Run history stores requested `regionIds` and `citySlugs` for every scoped run.
- No scope model expansion beyond `GENERIC|CITY|REGION`.

## 4. Scope

- Keep scope primitives minimal (`GENERIC`, `CITY`, `REGION`).
- Enforce scoped pinned filtering in orchestrator.
- Persist scope arrays on pipeline run records.
- Keep DB source defaults + runtime parsing aligned to the same primitives.

## 5. Out of Scope

- New scope kinds.
- New extraction model behavior.
- New admin UI surfaces.

## 6. User Stories

- As an operator, when I run `region=berlin`, only Berlin-relevant pinned sources are fetched.
- As an operator, I can inspect run history and see exactly what scope was requested.
- As an engineer, adding NRW requires config updates, not orchestrator redesign.

## 7. Acceptance Criteria (Gherkin)

```text
Given a scoped run with regionIds and/or citySlugs
When source planning executes
Then pinned strategies are filtered by CITY/REGION scope hints
And GENERIC strategies are excluded from that scoped run.

Given a pipeline run completes
When run history is persisted
Then scopeRegionIds and scopeCitySlugs are saved on the run record.

Given source defaults are validated
When strategy scope is parsed
Then only GENERIC|CITY|REGION values are accepted.
```

## 8. UX

- No net-new UX.
- Existing pipeline/admin flows benefit from cleaner scoped queue quality.

## 9. Risks & Open Questions

- Incorrect hint metadata can underfetch; requires disciplined source curation.
- Scope persistence fields are additive and safe, but require migration deploy discipline.
