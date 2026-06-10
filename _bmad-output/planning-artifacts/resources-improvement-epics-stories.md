# IndLokal Resources Improvement - Epics and Stories

Date: 2026-06-10
Owner: Product (John)
Status: aligned to journey-first redefinition

## Single Source of Truth

To avoid repetition, these files are canonical and this file only defines execution deltas:

- Product strategy and sprint gates: `resources-improvement-two-sprint-plan.md`
- UX architecture and interaction blueprint: `resources-ux-redefinition-blueprint.md`
- Story execution ordering and engineering path map: `../implementation-artifacts/resources-improvement-story-sequence.md`

## Outcome Contract (applies to all stories)

Every story must improve at least one of:

- Time to first meaningful action
- Journey progression rate (2+ meaningful actions)
- Resource-to-community/event conversion
- 7-day resume rate

Guardrails:

- No route breakage for existing city paths
- No regression on existing conversion paths
- Feature-flag rollout with cohort control

## Epic 1: Journey Shell and Orientation

Goal: users know what to do next within seconds.

### Story 1.1 Start Here orientation module (evolved from persona quick-start)

Acceptance Criteria:

- Start Here appears as the first module with concise context and one primary path.
- Stage/persona selection updates recommendations in-session.
- Default state is understandable without opening filter controls.
- `resources_hub_viewed`, `resources_variant_exposed`, and first-action event are emitted.

### Story 1.2 Focused shortlist and essentials behavior (evolved from intent chips)

Acceptance Criteria:

- Initial recommendation set is constrained (5-7 items) and clearly prioritized.
- Advanced filtering moves into compact drawer/bottom-sheet interaction.
- Essentials never dead-end; fallback actions are always present.
- Filter and shortlist interactions emit decision telemetry.

### Story 1.3 Low-noise trust and freshness layer

Acceptance Criteria:

- Cards show one trust indicator and one freshness line only.
- `Needs review` treatment is visible but not visually dominant.
- Accessibility checks pass for contrast and non-color-only meaning.

## Epic 2: Progression and Resume

Goal: users continue instead of restarting.

### Story 2.1 Next best action in My Journey

Acceptance Criteria:

- My Journey presents one primary next action based on current state.
- Next-action block is stable on web and mobile.
- Action completion updates progression state in the same session.

### Story 2.3 Resume-first return state

Acceptance Criteria:

- Returning users land in resume context (not cold discovery) when progress exists.
- Resume module references in-progress or saved items with clear continue CTA.
- Resume telemetry supports 7-day continuation analysis.

### Story 2.2 Save and remind support loop

Acceptance Criteria:

- Save/remind are available only where they support next action momentum.
- State remains idempotent and consistent across refresh/reopen.
- Tracking distinguishes save intent vs reminder completion.

## Epic 3: Information to Real-World Action

Goal: move from reading to participation.

### Story 3.2 Action-first resource details (prioritized)

Acceptance Criteria:

- Each detail view has one clear primary CTA and secondary alternatives.
- CTA labels are stage-aware and consistent across web/mobile.
- First meaningful action rate increases for detail-page sessions.

### Story 3.1 Related communities/events bridge

Acceptance Criteria:

- Related modules appear after the primary action zone.
- Related links are relevance-ranked by city and journey context.
- Click-through telemetry distinguishes community vs event follow-through.

## Epic 4: Measurement and Quality

Goal: ship safely, learn quickly.

### Story 4.3 Experimentation and dashboard baseline

Acceptance Criteria:

- Outcome metrics are queryable by cohort and variant.
- Activation/progression/conversion/resume funnel is observable.
- Instrumentation quality checks are part of release gates.

### Story 4.1 Ranking policy with trust/freshness weighting

Acceptance Criteria:

- Ranking policy can demote low-confidence stale content.
- Ordering rationale is inspectable for debug/QA.
- Policy changes can be rolled out independently via flags.

### Story 4.2 Outdated feedback loop

Acceptance Criteria:

- Report stale action is easy to trigger from resource surfaces.
- Report payload includes resource, city, and timestamp metadata.
- Triage state is visible to Ops workflow.

## Priority by Sprint

Sprint 1 (Journey shell + clarity):

- 1.1, 1.2, 2.1, 3.2, 2.3, 4.3

Sprint 2 (momentum + conversion):

- 3.1, 2.2, 1.3 hardening, 4.1

Sprint 3+:

- 4.2 operational hardening and moderation feedback loops
