# IndLokal Resources UX Redefinition Blueprint (Sally)

Date: 2026-06-10
Owner: UX + Product + Engineering
Scope: Web + Mobile resources experience
Constraint: Additive rollout behind flags, no route breakage

## 1. User Jobs to Win

### First 2 minutes

- Understand what to do now in this city context.
- See 3-5 high-confidence options without scanning long lists.
- Complete one meaningful action quickly.
- Trust that recommended items are current and credible.

### First 7 days

- Build and revisit a personal shortlist.
- Move from browsing to at least one completed real-world task.
- Receive clear next best actions at each revisit.
- Resume progress without re-filtering from scratch.

## 2. Target End-to-End Flow

1. Entry: show a compact context header and one primary call to action.
2. Orient: collect only 2 setup inputs (life stage, primary intent).
3. Shortlist: present 5-7 focused items grouped by urgency/confidence.
4. Act: each card has one primary action and optional save.
5. Continue: post-action panel proposes the next step and shows progress.
6. Resume: return users land in in-progress state, not full discovery.

## 3. Screen Architecture and Module Order

1. Context Header

- City, stage, intent, and resume indicator.
- Purpose: establish orientation immediately.

2. Quick Path Selector

- Two lightweight controls for stage and intent.
- Purpose: reduce ambiguity before list exposure.

3. Recommended Now

- Top three high-confidence items.
- Purpose: front-load decision quality and speed.

4. Essential Actions

- Foundational tasks with clear urgency.
- Purpose: reduce missed critical steps.

5. Full Results Stream

- Searchable/sortable deeper list.
- Purpose: support exploration without polluting first view.

6. Saved and In Progress

- Persistent strip for continuity.
- Purpose: reinforce return behavior and completion momentum.

7. Related Community and Events

- Stage-aware links to people and live activities.
- Purpose: bridge from information to action.

8. Feedback and Stale Reporting

- Lightweight report flow.
- Purpose: improve trust quality over time.

## 4. Interaction Model (Less Clutter)

- Replace chip-heavy UI with a compact filter drawer.
- Keep only two persistent controls on canvas: Sort and Scope.
- Group advanced filters inside drawer sections with clear labels.
- Show one-line filter summary with Edit action.
- Add one-tap mode switch: Best for me vs Explore all.
- Save preference context after first meaningful interaction.
- Provide clear reset to baseline.

## 5. Content and Trust Hierarchy

- Card order: title, one-line value, primary action, trust line, freshness line, secondary metadata.
- Confidence language: Strong source, Source-supported, Needs review.
- Freshness format: Updated X days ago with validity window where available.
- Demote low-confidence items by default.
- Explain ranking once at section level, not on every card.
- Cap each card to one trust indicator and one freshness line.
- Empty states must include fallback actions.

## 6. Mobile-Specific UX Rules

- Single-column modular layout.
- First viewport reserved for orientation and recommendations.
- Filter drawer implemented as bottom sheet.
- Secondary metadata behind progressive reveal.
- Minimum 44x44 touch targets.
- Semantic headings and accessible labels on all actionable controls.
- Trust/freshness cannot rely on color alone.
- Dynamic type support with graceful truncation.

## 7. UX Validation Plan (Phased)

### Phase 0: orientation panel

Flag: resources_orient_panel_v1

- Test: 5 moderated first-click sessions.
- Success: first meaningful click within 30 seconds.

### Phase 1: shortlist behavior

Flag: resources_shortlist_v1

- Test: comprehension + action initiation comparison vs control.
- Success: uplift in action initiation.

### Phase 2: resume and continue

Flag: resources_resume_continue_v1

- Test: 7-day mini-diary cohort.
- Success: measurable resume usage and repeat visits.

### Phase 3: trust and freshness layer

Flag: resources_trust_freshness_v1

- Test: trust confidence pulse and stale report behavior.
- Success: increased trust score, healthy stale-report signal.

## 8. Metrics and Guardrails

Primary metrics:

- Time to first meaningful action.
- Journey progression rate (2+ meaningful actions).
- Resource-to-community/event action conversion.
- 7-day return for resources users.

Guardrails:

- No drop in route-level engagement.
- No regression in existing conversion paths.
- No platform-specific UX fragmentation of the IA model.
