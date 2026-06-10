# Resources Sprint Execution Board (One Page)

Date: 2026-06-10
Program: IndLokal Resources Journey-First Redefinition
Owner: Product + Design + Engineering + Data

## Canonical Inputs

- Strategy and gates: `../planning-artifacts/resources-improvement-two-sprint-plan.md`
- UX blueprint: `../planning-artifacts/resources-ux-redefinition-blueprint.md`
- Story contract: `../planning-artifacts/resources-improvement-epics-stories.md`
- Story sequencing: `resources-improvement-story-sequence.md`
- Sprint 1 QA checklist: `sprint-1-qa-validation-checklist.md`
- Sprint 2 QA checklist: `sprint-2-qa-validation-checklist.md`

## Sprint 1 Goal (Clarity + Progression)

User outcome: users understand what to do next quickly and complete at least one meaningful action.

Primary metrics:

- Time to first meaningful action (down)
- Journey progression rate (up)
- Dead-end rate (down)

### Sprint 1 Scope (Execution)

1. Story 1.1 Start Here orientation module
2. Story 1.2 Focused shortlist and essentials behavior
3. Story 2.1 Next best action in My Journey
4. Story 3.2 Action-first resource details
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

## Sprint 2 Slice QA/UAT (2026-06-10)

Scope validated:

- Story 3.1 Related communities and events bridge (hub, category, journey).
- Story 2.2 Save and remind support loop (event save/remind + account-backed resource save).
- UX polish fix: repeated per-card resource-save helper copy removed.

Automated QA evidence:

- `pnpm -F web typecheck` passed.
- `pnpm -F web test -- src/modules/resources/__tests__/resolver.test.ts src/modules/engagement/__tests__/engagement.test.ts src/modules/community/__tests__/queries.integration.test.ts` passed.
- Result: 3 test files passed, 23 tests passed, 0 failed.

Manual UAT spot-check status:

- Resource cards on journey and category pages now show a single clean save control (no repeated helper sentence per card).
- Hub essentials cards continue to show save controls without repeated helper text.
- Related communities/events bridge and event save controls remain present across hub/category/journey surfaces.

Open UAT follow-ups:

- Capture screenshot evidence for Sprint 2 slices in next QA pass (hub/category/journey with save + related bridge visible).
- Verify reminder UX copy tone consistency for event cards in a dedicated content polish pass.

## Cross-Page Alignment Track (John + Sally)

| Surface                                               | UX Risk | Status      | Sprint         | Required Action                                                           |
| ----------------------------------------------------- | ------- | ----------- | -------------- | ------------------------------------------------------------------------- |
| Web city feed (`/[city]`)                             | High    | Open        | Sprint 1 close | Collapse secondary sections by default and reduce first-view card density |
| Mobile discover (`/(tabs)/index`)                     | High    | Open        | Sprint 1 close | Reduce control stack (chips/rail/tabs/lens) and simplify first viewport   |
| Mobile resources (`/resources`)                       | Medium  | In progress | Sprint 1 close | Keep progressive disclosure defaults and validate comprehension in UAT    |
| Web consular (`/[city]/consular-services`)            | Low     | Monitor     | Sprint 2       | Keep lean; only minor CTA clarity polish if needed                        |
| Web weekly events (`/[city]/indian-events-this-week`) | Low     | Monitor     | Sprint 2       | Keep lean; verify no conversion drop after feed changes                   |

## Sprint 1 Closure Checklist (Non-Negotiable)

1. Mobile manual UAT evidence complete for stories 2.1, 2.3, 3.2.
2. 4.3 dashboard live with baseline panels.
3. Event data-quality checks passing (completeness + null-rate thresholds).
4. Cross-page high-risk declutter tasks completed on web city feed and mobile discover.
5. Sprint 1 stories moved from Conditional/Blocked to Ready for Review or Done.

## Sprint 1 Handover

Current owner: John.

Next step in the chain:

1. Amelia / FE-MOBILE + QA runs the one-pass mobile QA script in `sprint-1-qa-validation-checklist.md` and closes the mobile manual UAT evidence for stories 2.1, 2.3, and 3.2.
2. DATA-ANALYTICS closes 4.3 by making the dashboard live and passing completeness / null-rate checks.
3. John reviews the evidence, marks Sprint 1 green, and only then hands Sprint 2 kickoff to the next delivery owner.

Required evidence from Amelia:

- 1 Resources screenshot showing persona/intent plus trust/freshness.
- 1 Resources resume screenshot, or a note stating `No existing progress to resume`.
- 1 Journey screenshot showing next-action card plus progress state.
- 1 short note confirming no runtime errors observed.

Handover rule:

- Do not start Sprint 2 implementation until both the mobile evidence and dashboard gate are green.

## Escalation Triggers

- If 2.1 slips, 2.3 and 3.2 become high risk.
- If 4.3 dashboard misses by end of Day 4, freeze rollout expansion.
- If mobile parity lags by more than one day, scope-cut non-critical polish before release.
