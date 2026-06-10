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

## Execution Policy Snapshot (John)

- Sprint 1 is formally closed as of 2026-06-10 by John (closeout override with accepted risks).
- Sprint 2 implementation may proceed as controlled pre-gate execution.
- Rollout expansion remains controlled by post-close risk commitments listed below.
- Sprint 2 items can move to implementation-complete before Sprint 1 closes, but remain QA-gated for release.

## Sprint 1 Closure Decision (John - 2026-06-10)

Decision: Sprint 1 is closed.

Closure mode:

- Closed by product-owner override after implementation completion and web validation evidence.
- Remaining gate items are converted to mandatory post-close commitments with owners and due dates.

Accepted risks at close:

- Mobile manual UAT evidence was not complete at time of closure.
- Story 4.3 dashboard live/data-quality gate was not complete at time of closure.
- Cross-page declutter tasks were not fully complete at time of closure.

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

| Story                              | Status                   | Owner               | Build State                                                                     | QA Gate                                        | Analytics Gate                           | Blockers                               |
| ---------------------------------- | ------------------------ | ------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------- | -------------------------------------- |
| 1.1 Start Here orientation         | Ready for Review         | FE Web/Mobile       | Implemented (flagged)                                                           | Pending mobile/manual evidence                 | Partial (ingestion check pending)        | None                                   |
| 1.2 Focused shortlist + essentials | Ready for Review         | FE Web/Mobile       | Implemented (flagged)                                                           | Pending mobile/manual evidence                 | Partial (dashboard check pending)        | None                                   |
| 2.1 Next best action               | Done (Accepted Risk)     | FE Web/Mobile + API | Implemented in journey surfaces                                                 | Web UAT passed; mobile UAT follow-up committed | Partial (live ingestion check follow-up) | None (moved to post-close commitments) |
| 3.2 Action-first CTA               | Done (Accepted Risk)     | FE Web/Mobile       | Primary CTA hierarchy implemented                                               | Web UAT passed; mobile CTA parity follow-up    | Partial (variant panel check follow-up)  | None (moved to post-close commitments) |
| 2.3 Resume-first return            | Done (Accepted Risk)     | FE Web/Mobile + API | Resume prompt + reset flow implemented                                          | Web UAT passed; mobile cross-session follow-up | Partial (resume funnel checks follow-up) | None (moved to post-close commitments) |
| 4.3 Experiment baseline            | Done (Deferred Ops Gate) | Data + FE           | Events and track mapping implemented; dashboard deferred to post-close ops gate | Pending quality checks (post-close)            | Pending (post-close)                     | None (moved to post-close commitments) |

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

## Current Status Snapshot (2026-06-10)

### Sprint 1 Gate Track

- Web UAT passed for journey progression and CTA flow.
- Sprint 1 gate converted to post-close commitments under John override.
- Mobile manual UAT and Story 4.3 dashboard/data checks remain required as post-close commitments.
- Sprint 1 status: Closed.

### Sprint 2 Implementation Track

- Story 3.1 implemented in code across hub, category, and journey surfaces.
- Story 2.2 implemented in code with event save/remind and account-backed resource saves.
- Save control UX polish implemented (placement alignment + copy noise reduction).
- Sprint 2 implementation status: In progress, QA-gated for release.

### Sprint 2 Automated Evidence

- `pnpm -F web typecheck` passed.
- `pnpm -F web test -- src/modules/resources/__tests__/resolver.test.ts src/modules/engagement/__tests__/engagement.test.ts src/modules/community/__tests__/queries.integration.test.ts` passed.
- Result: 3 test files passed, 23 tests passed, 0 failed.

### Sprint 2 Remaining QA Gates

| Item                                                                | Owner          | Status | Due   | Evidence Target                                             |
| ------------------------------------------------------------------- | -------------- | ------ | ----- | ----------------------------------------------------------- |
| Screenshot bundle (hub, category, journey, profile Saved Resources) | Amelia + QA    | Open   | Day 1 | Attached screenshots in sprint-2-qa-validation-checklist.md |
| Mobile parity QA for save-control + related bridge                  | Amelia + QA    | Open   | Day 2 | Mobile run results in sprint-2-qa-validation-checklist.md   |
| Logged-out save redirect behavior                                   | FE Web + QA    | Open   | Day 1 | Step result in sprint-2-qa-validation-checklist.md          |
| Cross-device/session persistence for resource saves                 | FE Web + QA    | Open   | Day 2 | Session A/B proof notes + screenshots                       |
| Rapid-toggle optimistic state resilience                            | FE Web + QA    | Open   | Day 2 | Stress-check notes in Sprint 2 checklist                    |
| Reminder copy tone consistency on event cards                       | Sally + FE Web | Open   | Day 3 | UX signoff note                                             |

## Cross-Page Alignment Track (John + Sally)

| Surface                                               | UX Risk | Status      | Sprint         | Required Action                                                           |
| ----------------------------------------------------- | ------- | ----------- | -------------- | ------------------------------------------------------------------------- |
| Web city feed (`/[city]`)                             | High    | Open        | Sprint 1 close | Collapse secondary sections by default and reduce first-view card density |
| Mobile discover (`/(tabs)/index`)                     | High    | Open        | Sprint 1 close | Reduce control stack (chips/rail/tabs/lens) and simplify first viewport   |
| Mobile resources (`/resources`)                       | Medium  | In progress | Sprint 1 close | Keep progressive disclosure defaults and validate comprehension in UAT    |
| Web consular (`/[city]/consular-services`)            | Low     | Monitor     | Sprint 2       | Keep lean; only minor CTA clarity polish if needed                        |
| Web weekly events (`/[city]/indian-events-this-week`) | Low     | Monitor     | Sprint 2       | Keep lean; verify no conversion drop after feed changes                   |

## Sprint 1 Closure Checklist (Non-Negotiable)

1. Mobile manual UAT evidence complete for stories 2.1, 2.3, 3.2. (Moved to post-close commitment)
2. 4.3 dashboard live with baseline panels. (Moved to post-close commitment)
3. Event data-quality checks passing (completeness + null-rate thresholds). (Moved to post-close commitment)
4. Cross-page high-risk declutter tasks completed on web city feed and mobile discover. (Moved to post-close commitment)
5. Sprint 1 stories moved to Done / Done (Accepted Risk) / Done (Deferred Ops Gate). (Completed)

## Post-Close Commitments (Mandatory)

| Commitment                                              | Owner             | Due        | Status |
| ------------------------------------------------------- | ----------------- | ---------- | ------ |
| Mobile manual UAT evidence for 2.1/2.3/3.2              | Amelia + QA       | 2026-06-12 | Open   |
| 4.3 dashboard live with baseline panels                 | Data + FE         | 2026-06-13 | Open   |
| Event data-quality checks (completeness/null-rate)      | Data + FE         | 2026-06-13 | Open   |
| Cross-page declutter on web city feed + mobile discover | John + Sally + FE | 2026-06-14 | Open   |

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

- Sprint 2 execution continues immediately; post-close commitments above are mandatory and tracked to completion.

## Escalation Triggers

- If 2.1 slips, 2.3 and 3.2 become high risk.
- If 4.3 dashboard misses by end of Day 4, freeze rollout expansion.
- If mobile parity lags by more than one day, scope-cut non-critical polish before release.
