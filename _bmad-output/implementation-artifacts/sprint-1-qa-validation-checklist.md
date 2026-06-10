# Sprint 1 QA Validation Checklist (Resources Improvement)

Date: 2026-06-10
Scope: Story 1.1, 1.2, 1.3, 4.3
Validator: Amelia implementation pass + automated evidence checks

## 1. Automated Validation

### Build/Type Safety

- Web typecheck: pass
- Mobile typecheck: pass

### Implementation Evidence (Code Presence)

Story 1.1 and 1.2 (Persona + Intent + Essentials):

- Web persona and intent UI/events present in apps/web/src/app/[city]/resources/page.tsx
- Mobile persona and intent UI/events present in apps/mobile/app/resources/index.tsx

Story 1.3 (Trust/Freshness):

- Web trust/freshness badges present in:
  - apps/web/src/app/[city]/resources/page.tsx
  - apps/web/src/app/[city]/resources/journey/page.tsx
- Mobile trust/freshness badges + stale tracking present in:
  - apps/mobile/app/resources/index.tsx
  - apps/mobile/app/resources/journey.tsx
- Journey API freshness fields present in:
  - apps/web/src/app/api/v1/cities/[slug]/resources/journey/route.ts

Story 4.3 (Analytics baseline):

- Web event catalog updated in apps/web/src/lib/analytics/events.ts
- Mobile event catalog updated in apps/mobile/lib/analytics/events.ts
- Feature flags present in:
  - apps/web/src/lib/config/flags.ts
  - apps/mobile/lib/config/flags.ts
- Dashboard/event dictionary artifact authored in:
  - \_bmad-output/planning-artifacts/resources-analytics-baseline.md

## 2. Manual QA Matrix (Pending Run)

1. Web resources hub

- Verify persona chip toggling and filtered results
- Verify intent chip toggling and essentials fallback behavior
- Verify trust/freshness badge rendering on essentials + popular guides

2. Mobile resources screen

- Verify persona and intent chips behave consistently
- Verify essentials click tracking path and no UI regressions
- Verify trust/freshness badges render correctly on cards

3. Mobile journey screen

- Verify trust/freshness badges render from journey API
- Verify stale open event path does not break navigation

4. Cross-surface stability

- Verify existing routes unchanged
- Verify no broken links from category/popular/consular cards

## 2A. Manual QA Results (Web Run - 2026-06-10)

Environment:

- URL tested: http://localhost:3001/stuttgart/resources
- DB and app services running locally.

Passed:

1. Persona chips render and toggle state correctly.
2. Intent chips render and toggle state correctly.
3. Filtered context updates total guide count and visible modules.
4. Essentials section adapts under filtered context with fallback behavior.
5. Trust/freshness labels render on resources hub cards.
6. Journey trust/freshness labels render on web journey cards.
7. Route stability preserved (`/[city]/resources`, query-param overlays only).

Evidence highlights:

- Persona heading and chips visible (Choose your profile).
- Intent heading and chips visible (I need help with...).
- Context count change observed from baseline to filtered pages.
- Fresh/Needs review labels present on essentials and journey cards.

Pending (not executed in this run):

1. Mobile UI manual pass on device/emulator.
2. Accessibility evidence capture for Story 1.3 (contrast/labels).
3. Live analytics dashboard population checks for Story 4.3.

## 2B. Mobile QA Script (Device/Emulator)

Preconditions:

- API/web running on local dev server.
- Mobile app launched with selected city set to `stuttgart`.
- Test user state available for normal browsing.
- Flags enabled for resources intent/persona, resume, and CTA modules.

One-pass execution rule:

- Run the steps below in order without resetting the app unless a step fails.
- If any step fails, capture one screenshot and one short note, then stop and file the defect.
- If all steps pass, this run is sufficient evidence for the mobile manual gate on Stories 1.1, 1.2, 1.3, 2.1, 2.3, and 3.2.

Execution steps:

1. Open Resources screen.

- Expected: screen loads without crash; persona and intent chip groups visible when flags enabled.
- Result: [ ] Pass [ ] Fail
- Notes:

2. Persona chip toggle behavior.

- Action: Tap `Student`, then tap again to clear.
- Expected: resource groups and counts visibly adjust on select and revert on clear.
- Result: [ ] Pass [ ] Fail
- Notes:

3. Intent chip toggle behavior.

- Action: Tap `Housing`, then switch to `Visa`.
- Expected: visible content pivots by intent; no UI overlap or stale state glitches.
- Result: [ ] Pass [ ] Fail
- Notes:

4. Essentials fallback behavior.

- Action: choose a narrow persona+intent combination.
- Expected: essentials still render using fallback source if filtered essentials are sparse.
- Result: [ ] Pass [ ] Fail
- Notes:

5. Trust/freshness badges on Resources cards.

- Expected: each card shows trust label (`Official`/`Curated`) and freshness label (`Fresh`/`Needs review`).
- Result: [ ] Pass [ ] Fail
- Notes:

6. Resume prompt and CTA behavior.

- Action: if resume card is visible, tap `Continue next step`; if not visible, note `No existing progress` and continue.
- Expected: resume card, when present, opens Journey without error and shows a clear next-step CTA.
- Result: [ ] Pass [ ] Fail [ ] Not applicable
- Notes:

7. Journey navigation and badges.

- Action: open Journey from Resources screen.
- Expected: journey cards render trust/freshness badges; no rendering errors.
- Result: [ ] Pass [ ] Fail
- Notes:

8. Next-action and mark-complete behavior.

- Action: on Journey, use `Continue next step`, then `Mark complete` on the next-action card.
- Expected: next-action state updates immediately; progress count changes without crash or stale UI.
- Result: [ ] Pass [ ] Fail
- Notes:

9. Reset progress behavior.

- Action: tap `Reset` on Journey after at least one completion.
- Expected: progress clears immediately and resume state is removed on return to Resources.
- Result: [ ] Pass [ ] Fail
- Notes:

10. Stale open path safety.

- Action: open at least one `Needs review` resource link.
- Expected: link opens without crash; user remains in stable app state on return.
- Result: [ ] Pass [ ] Fail
- Notes:

11. Basic analytics smoke check.

- Action: perform one persona click, one intent click, one essentials click.
- Expected: no client errors; telemetry calls remain non-blocking.
- Result: [ ] Pass [ ] Fail
- Notes:

Exit criteria for mobile evidence signoff:

- All applicable steps marked Pass.
- No crashes, stuck states, or broken navigation.
- Resume, next-action, mark-complete, and reset behavior confirmed in one run.

Artifacts to attach:

- 1 screenshot from Resources screen showing persona/intent + trust/freshness.
- 1 screenshot from Resources screen showing resume card, or a short note stating `No existing progress to resume`.
- 1 screenshot from Journey screen showing next-action card + progress state.
- 1 short note confirming no runtime errors observed.

## 3. Acceptance Gate Summary

Story 1.1 Start Here orientation module

- Criteria status: complete in code
- QA status: ready for review (web verified; mobile manual run pending)

Story 1.2 Focused shortlist and essentials behavior

- Criteria status: complete in code
- QA status: ready for review (web verified; mobile manual run pending)

Story 1.3 Low-noise trust and freshness layer

- Criteria status: complete in code
- QA status: in progress (web visual QA passed; accessibility evidence + mobile visual QA signoff pending)

Story 4.3 Experimentation and dashboard baseline

- Criteria status: event contract and emitters complete
- QA status: in progress (requires live dashboard build + data quality checks on traffic)

## 4. Remaining Work Before Sprint 1 Close

1. Run the one-pass mobile QA script above and attach the listed evidence.
2. Execute accessibility checks for Story 1.3 surfaces.
3. Build and validate baseline analytics dashboard from resources-analytics-baseline.md.
4. After the above, transition Story 1.3 and 4.3 to Ready for Review.
