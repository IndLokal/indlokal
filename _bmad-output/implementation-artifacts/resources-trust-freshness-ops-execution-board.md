# Resources Trust, Freshness, and Ops Execution Board

Date: 2026-06-10
Program: IndLokal Resources Trust, Freshness, and Ops Track
Owner: Product + Platform + Content Ops + Data

## Canonical Inputs

- Track plan: `../planning-artifacts/resources-trust-freshness-ops-plan.md`
- Story sequencing: `resources-trust-freshness-ops-story-sequence.md`
- QA checklist: `resources-trust-freshness-ops-qa-checklist.md`
- Current resources board: `resources-sprint-execution-board.md`

## Execution Policy Snapshot (John)

- This track does not start until current mandatory post-close commitments on `resources-sprint-execution-board.md` are complete.
- This track is an operating-system follow-on lane, not a continuation of the closed UX sprint.
- Scope expansion to mobile occurs only after the web trust contract is stable.

## Track Goal

User and ops outcome:

- users can trust what they see on resource surfaces
- stale content is actively governed, not just labeled
- ops can identify, queue, and close trust/freshness gaps

Primary metrics:

- Trusted Journey Resource Coverage (up)
- stale resource exposure (down)
- percent resources within TTL (up)
- outdated correction turnaround (down)

## Story Board

| Story                                             | Status      | Owner                      | Build State                                                                                                 | QA Gate                                | Data/Ops Gate               | Blockers                                   |
| ------------------------------------------------- | ----------- | -------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------- | ------------------------------------------ |
| A1 Resource trust read model and surface contract | In Progress | FE-WEB + BE-PLATFORM + PM  | Core implementation complete, PR checklist in progress (`resources-wave1-slice1-pr-checklist.md`)           | Trust wording + cross-surface accuracy | Mapping contract approved   | Manual QA evidence + lint pending          |
| A2 Owned-content governance gate                  | In Progress | BE-PLATFORM + OPS + PM     | Core implementation + tests complete (`resources-wave1-slice2-pr-checklist.md`)                             | Admin workflow validation              | Governance rubric approved  | Manual QA evidence pending                 |
| B1 Freshness lifecycle automation                 | In Progress | BE-PLATFORM + FE-WEB       | Lifecycle projection + API/web integration implemented (`resources-wave2-b1-pr-checklist.md`)               | Lifecycle state correctness            | TTL/grace policy approved   | Manual QA evidence pending                 |
| B2 Re-verification queue and SLA                  | Completed   | BE-PLATFORM + OPS + FE-WEB | Queue model/service/cron/admin/actions/tests + migration implemented (`resources-wave2-b2-pr-checklist.md`) | Queue workflow validation              | SLA/priority model approved | Manual browser QA evidence pending         |
| C1 Journey-gap to supply ops loop                 | Not Started | OPS + DATA-ANALYTICS + PM  | Not started                                                                                                 | Backlog generation accuracy            | Ownership/SLA flow approved | Stable coverage + trust semantics required |
| C2 Section 17 KPI and dashboard contract          | Not Started | DATA-ANALYTICS + PM        | Not started                                                                                                 | Metric query validation                | Dashboard contract approved | Prior workstreams must stabilize           |

## Release Waves

### Wave 1

- A1 Resource trust read model and surface contract
- A2 Owned-content governance gate

Exit gate:

- resource trust contract is visible and consistent on web
- owned-content path is policy-gated in admin

### Wave 2

- B1 Freshness lifecycle automation
- B2 Re-verification queue and SLA

Exit gate:

- stale lifecycle rules are enforced
- queue exists for stale/high-risk resource review

### Wave 3

- C1 Journey-gap to supply ops loop
- C2 Section 17 KPI and dashboard contract

Exit gate:

- ops backlog is generated from journey gaps
- Section 17 leading indicators and anti-metrics are queryable

## No-Go Rules

Do not start this board if:

1. Mandatory post-close commitments on `resources-sprint-execution-board.md` are still open.
2. Story 4.3 dashboard baseline is still unreliable.
3. Ranking behavior from Story 4.1 is not yet validated in production-like conditions.

## Immediate Next Step

1. Clear current post-close commitments on `resources-sprint-execution-board.md`.
2. PM signs off Wave 1 trust vocabulary and governance rubric.
3. Move Story A1 to In Progress.
