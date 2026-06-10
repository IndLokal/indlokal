# IndLokal Resources Experience - Product Redefinition (Web + Mobile)

Date: 2026-06-10
Owner: Product + Engineering + Design
Horizon: 2 sprints (progressive rollout, no route breakage)

## 1) Core Product Problem Framing

Resources feels like a directory, not a guided experience.

What is broken for users:

- Users land in a content pile, not a clear "what should I do next" flow.
- City context exists in routes, but journey context is weak inside the experience.
- Resource detail pages rarely create momentum into communities/events/actions.
- Mobile and web expose similar content but different decision quality, so trust and progression are inconsistent.
- The current scope optimizes components (chips, badges, instrumentation), not user outcomes (clarity, completion, return).

Product-level diagnosis:

- We are shipping modules.
- Users need an operating path.

## 2) New Experience Principles

1. Journey over inventory: every screen must answer "next best action," not just "more options."
2. City-first continuity: keep existing city routes and SEO surfaces, but add journey scaffolding inside them.
3. Action-or-drop: if an item cannot move a user forward, it should not be prominent.
4. One mental model across web and mobile: same IA, same stage language, same progression states.
5. Progressive disclosure: show only what is needed for the current stage, then unlock deeper detail.
6. Resume by default: users should return to an in-progress path, not restart discovery.
7. Evidence without clutter: trust/freshness should support decisions, not compete with primary actions.

## 3) New Information Architecture (Resources)

### Top-Level Structure

1. Start Here
   - Persona + stage entry, one explicit recommended path.
2. My Journey
   - Current stage, completed steps, next step, saved items, reminders.
3. Explore by Topic
   - Search/filter index for users who need breadth, with strong relevance defaults.
4. Community & Events
   - Action surfaces tied to the journey stage (join, attend, ask, apply).
5. Help & Trust
   - Source context, reporting stale info, escalation/support pathways.

### Navigation Model (Web + Mobile)

- Web:
  - Keep existing city resource routes intact.
  - Add a persistent journey rail: Start Here -> My Journey -> Explore -> Community & Events.
  - Resource detail becomes a decision page: one primary next action, secondary alternatives.
- Mobile:
  - Mirror same 5-section IA via bottom tabs + in-flow cards.
  - Default landing = My Journey if user has prior activity; otherwise Start Here.
  - Persist in-progress state for instant resume.

### Compatibility Constraints (non-negotiable)

- No big-bang rewrite; ship behind flags per city/persona cohorts.
- Preserve existing city URLs and current route contracts.
- Introduce IA as an overlay layer first, then migrate internals incrementally.

## 4) Prioritized Outcomes and Metrics (replace feature scope)

Primary outcomes:

1. Clarity: users quickly understand what to do next.
2. Momentum: users complete multi-step progress in one session.
3. Continuity: users resume and continue within 7 days.
4. Conversion: resources drive real actions into community/events.

North-star metric:

- Journey Progression Rate = % users completing at least 2 meaningful actions in a journey window.

Supporting metrics (priority order):

1. Time-to-first-meaningful-action (target down).
2. Multi-step completion rate (target up).
3. Resource-to-community/event action conversion (target up).
4. 7-day journey resume rate (target up).
5. Dead-end rate (sessions with no meaningful action, target down).

Decision rule:

- Features that do not move these outcome metrics are deprioritized, even if they improve UI polish.

## 5) Two-Sprint Execution Model (User-Facing Milestones)

## Sprint 1: Journey Shell + Clarity (Weeks 1-2)

Milestone users feel:

- "I know where to start and what my next step is."

Deliver as user-visible changes:

1. Launch new IA shell on web + mobile for one priority city cohort.
2. Add Start Here and My Journey with explicit next-action cards.
3. Convert resource detail into action-first layout (single primary CTA).
4. Enable resume state (return users land back in in-progress journey).

Success gate to move on:

- Clear reduction in dead-end rate and faster time-to-first-meaningful-action vs baseline.

## Sprint 2: Momentum + Conversion (Weeks 3-4)

Milestone users feel:

- "This experience helps me finish what I started and connect to real people/events."

Deliver as user-visible changes:

1. Add stage-aware recommendations in My Journey.
2. Tight resource-to-community/event linking at key decision points.
3. Add lightweight save/remind loop where it directly supports next actions.
4. Expand rollout from pilot city cohort to next-city cohort if Sprint 1 gates hold.

Success gate:

- Significant uplift in Journey Progression Rate and resource-to-action conversion.

## 6) Risks and Hard Tradeoffs

1. Route safety vs IA ambition
   - Tradeoff: preserving route compatibility limits structural refactors in first two sprints.
2. Cross-platform parity vs speed
   - Tradeoff: perfect parity slows shipping; we align core IA/logic first, polish parity second.
3. Relevance quality vs implementation simplicity
   - Tradeoff: rule-based next actions may feel less personalized initially, but are safer and faster to validate.
4. Instrumentation depth vs delivery focus
   - Tradeoff: enough telemetry for outcome decisions, not a full analytics rebuild.
5. Breadth vs progression
   - Tradeoff: reducing visible options may feel restrictive, but is necessary to improve completion.

Explicit non-goals for this 2-sprint window:

- No full taxonomy overhaul.
- No wholesale ranking/personalization engine rewrite.
- No city-route redesign or SEO URL migration.
