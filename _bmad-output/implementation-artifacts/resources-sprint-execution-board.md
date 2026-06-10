# Resources Sprint Execution Board (One Page)

Date: 2026-06-10
Program: IndLokal Resources Journey-First Redefinition
Owner: Product + Design + Engineering + Data

## Canonical Inputs

- Strategy and gates: `../planning-artifacts/resources-improvement-two-sprint-plan.md`
- UX blueprint: `../planning-artifacts/resources-ux-redefinition-blueprint.md`
- Story contract: `../planning-artifacts/resources-improvement-epics-stories.md`
- Story sequencing: `resources-improvement-story-sequence.md`

## Sprint 1 Goal (Clarity + Progression)

User outcome: users understand what to do next quickly and complete at least one meaningful action.

Primary metrics:

- Time to first meaningful action (down)
- Journey progression rate (up)
- Dead-end rate (down)

### Sprint 1 Scope (Execution)

1. Story 1.1 Start Here orientation module
2. Story 1.2 Focused shortlist and smart essentials
3. Story 2.1 Next best action in My Journey
4. Story 3.2 Action-first resource detail CTA
5. Story 2.3 Resume-first return state
6. Story 4.3 Experimentation and dashboard baseline

## Sprint 1 Story Board

| Story                              | Status           | Owner               | Build State                                             | QA Gate                                         | Analytics Gate                                 | Blockers                                  |
| ---------------------------------- | ---------------- | ------------------- | ------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- | ----------------------------------------- |
| 1.1 Start Here orientation         | Ready for Review | FE Web/Mobile       | Implemented (flagged)                                   | Pending mobile/manual evidence                  | Partial (ingestion check pending)              | None                                      |
| 1.2 Focused shortlist + essentials | Ready for Review | FE Web/Mobile       | Implemented (flagged)                                   | Pending mobile/manual evidence                  | Partial (dashboard check pending)              | None                                      |
| 2.1 Next best action               | Conditional      | FE Web/Mobile + API | Implemented in journey surfaces                         | Web UAT passed; mobile UAT pending              | Partial (live ingestion check pending)         | Mobile parity evidence missing            |
| 3.2 Action-first CTA               | Conditional      | FE Web/Mobile       | Primary CTA hierarchy implemented                       | Web UAT passed; CTA focused QA pending          | Partial (variant panel check pending)          | CTA hierarchy signoff pending             |
| 2.3 Resume-first return            | Conditional      | FE Web/Mobile + API | Resume prompt + reset flow implemented                  | Web UAT passed; cross-session mobile QA pending | Partial (resume funnel checks pending)         | Mobile cross-session evidence missing     |
| 4.3 Experiment baseline            | Blocked          | Data + FE           | Events and track mapping implemented; dashboard pending | Pending quality checks                          | Blocked (dashboard + null-rate checks pending) | Dashboard build + live validation pending |

## Critical Path

1. Lock CTA policy and next-action rules.
2. Validate 3.2 action hierarchy with focused parity QA evidence.
3. Validate 2.3 resume behavior across session restart scenarios.
4. Close 4.3 dashboard + completeness checks (unblock).
5. Re-run full QA checklist and gate Sprint 1 release.

## Day-by-Day Standup Slice (Recommended)

Day 1:

- Complete CTA policy matrix v1 signoff.
- Confirm next-action scenario QA evidence.

Day 2:

- Run 3.2 web/mobile copy and hierarchy QA.
- Start dashboard panel wiring for new journey/CTA events.

Day 3:

- Execute 2.3 cross-session resume and reset validation.
- Fix any parity issues found in mobile QA.

Day 4:

- Data team finalizes dashboard queries and null-rate checks.
- Validate event completeness against live traffic.

Day 5:

- QA pass (web + mobile + accessibility + analytics).
- Sprint 1 go/no-go against metric gates.

## Definition of Green (Sprint 1 Exit)

- All Sprint 1 stories moved to Ready for Review or Done.
- No route regressions on city resource paths.
- Mobile and web parity achieved for core journey states.
- Dashboard shows activation/progression/conversion baselines with acceptable data quality.

## Latest UAT Readout (2026-06-10)

- Web UAT passed for journey progression and CTA flow.
- Mobile manual UAT remains required before rollout expansion.
- Analytics implementation is in code, but rollout expansion is blocked until dashboard and live data-quality checks pass.

## Escalation Triggers

- If 2.1 slips, 2.3 and 3.2 become high risk.
- If 4.3 dashboard misses by end of Day 4, freeze rollout expansion.
- If mobile parity lags by more than one day, scope-cut non-critical polish before release.
