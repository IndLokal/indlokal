# IndLokal Resources Improvement - Technical Architecture

Date: 2026-06-10
Architect: Winston
Status: Proposed
Inputs: resources-improvement-prd-one-pager.md, resources-improvement-epics-stories.md, resources-improvement-story-sequence.md

## 1. Architecture Intent

Design a low-risk evolution of the current Resources stack from directory-style browsing to guided, intent-first progression while preserving:

- existing city route contracts
- existing SEO surfaces
- existing resolver-based scope logic
- web/mobile parity for critical journey behavior

This architecture intentionally extends current modules instead of introducing a new service boundary.

## 2. Existing System Baseline

Primary implementation surfaces:

- Web resources hub: apps/web/src/app/[city]/resources/page.tsx
- Web journey page: apps/web/src/app/[city]/resources/journey/page.tsx
- Resources resolver: apps/web/src/modules/resources/resolver.ts
- Resources API: apps/web/src/app/api/v1/cities/[slug]/resources/route.ts
- Journey API: apps/web/src/app/api/v1/cities/[slug]/resources/journey/route.ts
- Mobile resources screen: apps/mobile/app/resources/index.tsx
- Mobile journey screen: apps/mobile/app/resources/journey.tsx
- Web analytics event catalog: apps/web/src/lib/analytics/events.ts
- Mobile analytics event catalog: apps/mobile/lib/analytics/events.ts

Baseline strengths:

- robust scope resolution (CITY, METRO, STATE, COUNTRY, GLOBAL)
- consular-jurisdiction filtering already implemented
- journey and essentials scaffolding already present
- existing analytics infrastructure on both clients

## 3. Target Architecture (Incremental)

### 3.1 Layered Model

1. Presentation layer

- Web route components and mobile screens render resources and journey blocks.
- New modules: persona quick-start, intent chips, smart essentials, next-best-action, related communities/events.

2. Application orchestration layer

- A new resources-journey orchestration module (inside apps/web/src/modules/resources/ or sibling module) computes:
  - persona-intent context normalization
  - smart essentials list
  - next-best-action selection
  - related entities composition

3. Data retrieval layer

- Existing resolver remains the source for resource retrieval and scope fallback.
- Community and event query modules are invoked for relation composition.

4. API contract layer

- Extend existing city resources and journey endpoints with optional, additive response blocks.
- Preserve backward compatibility for current clients.

5. Instrumentation and experiment layer

- Centralize new event names in web/mobile analytics catalogs.
- Add variant metadata for experiment analysis.

### 3.2 Compatibility Rule

All endpoint changes are additive. Existing consumers that ignore new fields continue to function unchanged.

## 4. Domain Decisions

### 4.1 Persona and Intent Context

Introduce canonical context object used across web/mobile and APIs:

- citySlug
- persona (STUDENT, FAMILY, EMPLOYEE, FOUNDER, NEWCOMER)
- intent (ANMELDUNG, HOUSING, HEALTH, VISA, TAX, JOBS)
- lifecycleStage (PRE_ARRIVAL, FIRST_30_DAYS, FIRST_90_DAYS, SETTLED, ANYTIME)

Context is optional. If absent, existing generic resources flow remains.

### 4.2 Smart Essentials Selection

Compute top essentials with deterministic ranking:

- hard filters: city scope fallback via resolver, optional persona/intent mapping
- score dimensions:
  - essential flag
  - priority
  - freshness weight
  - lifecycle stage fit
  - trust/verification weight

### 4.3 Next-Best-Action

Derive one primary action from:

- current completion state
- lifecycle ordering
- score tie-breaker (urgency, legal-critical steps first)

Fallback behavior:

- if insufficient confidence, return top essential with explicit fallback reason.

### 4.4 Related Communities and Events

Compose relations using:

- city scope
- persona tags / audience affinity
- lifecycle relevance
- recency for events

Return max N cards per module with stable ordering.

## 5. API Architecture

### 5.1 GET /api/v1/cities/:slug/resources

Current endpoint remains primary list endpoint.

Add optional query params:

- persona
- intent
- includeEssentials=true
- includeRelated=true
- experimentVariant

Add optional response blocks:

- context
- essentials
- related
- debug (gated by non-prod)

### 5.2 GET /api/v1/cities/:slug/resources/journey

Extend response with:

- nextBestAction
- progressSummary
- resumeHint

### 5.3 Mutation Endpoints (Phase 2)

Add new endpoints (or expand existing namespace):

- POST /api/v1/cities/:slug/resources/save
- DELETE /api/v1/cities/:slug/resources/save/:resourceId
- POST /api/v1/cities/:slug/resources/reminder
- DELETE /api/v1/cities/:slug/resources/reminder/:reminderId
- POST /api/v1/cities/:slug/resources/journey/complete
- POST /api/v1/cities/:slug/resources/journey/reset

### 5.4 Quality Endpoint (Phase 3+)

- POST /api/v1/cities/:slug/resources/report-outdated

Admin triage flows integrate with existing admin resources surfaces.

## 6. Data and Persistence Strategy

### 6.1 Progress State

Progress source of truth:

- authenticated users: server-backed completion state by user + city + step key
- unauthenticated users: local state fallback (existing mobile pattern), optional web local state

Sync policy:

- authenticated server state overrides local state
- reset action clears both server and client cache state

### 6.2 Save and Reminder

Save/reminder records should be idempotent by:

- userId + resourceId for save
- userId + resourceId + scheduleKey for reminder

### 6.3 Ranking Inputs

Use existing resource metadata plus new ranking dimensions:

- freshness score
- verification score
- policy penalty for stale resources

## 7. Experimentation Architecture

### 7.1 Variant Assignment

Assign variant at request/session level and pass through:

- API request metadata
- client render context
- analytics payloads

### 7.2 Experiment Surfaces

- persona module ordering
- intent chip ordering
- CTA hierarchy ordering
- essentials card layout

## 8. Analytics and Observability

### 8.1 Event Contract

Define mirrored event names in:

- apps/web/src/lib/analytics/events.ts
- apps/mobile/lib/analytics/events.ts

Must include properties:

- citySlug
- persona
- intent
- lifecycleStage
- resourceId (when applicable)
- moduleName
- ctaRank
- experimentVariant

### 8.2 Key Dashboards

- activation funnel: hub view to first meaningful action
- journey progression: stage and completion depth
- cross-surface conversion: resource to community/event
- retention: 7-day and 30-day return cohorts
- quality: stale exposures and report resolution time

### 8.3 Runtime Guardrails

- analytics failures are non-blocking
- relation and essentials modules fail open (hide module, preserve page)
- debug ranking metadata only available in non-production environments

## 9. Rollout Architecture

### 9.1 Feature Flags

Separate flags for:

- resources_persona_module
- resources_intent_chips
- resources_smart_essentials
- journey_next_best_action
- resources_related_modules
- resources_save_remind
- resources_ranking_v2
- resources_outdated_reporting

### 9.2 Rollout Stages

1. Internal dogfood
2. Single-city pilot (Stuttgart)
3. Multi-city metro rollout
4. General availability

### 9.3 Rollback Plan

- disable feature flag per module
- preserve baseline resolver/list rendering
- retain backward-compatible API shape

## 10. NFRs and Constraints

Performance:

- keep added module query overhead bounded
- use existing cache strategy where possible
- enforce per-module item limits

Reliability:

- no single module should break full resources page/screen render
- API additions should degrade gracefully when relation data unavailable

Security and privacy:

- no sensitive personal data in analytics payloads
- reminder and progress actions require authenticated user context

## 11. Delivery Mapping to Story Plan

Sprint 1 architecture focus:

- persona and intent orchestration in existing hub
- essentials computation path
- trust/freshness display contract
- baseline event schema completion

Sprint 2 architecture focus:

- journey next-best-action orchestration
- relation composition modules
- persistence mutation APIs (save/remind/progress)
- ranking policy v2

Sprint 3+ architecture focus:

- outdated reporting submission and admin triage integration

## 12. Open Technical Decisions

1. Should next-best-action logic live in resources module or a dedicated journeys orchestration module?
2. Should reminder delivery be in-app only initially, or include push/email in MVP?
3. Do we need server-side experiment assignment service, or client-assigned variant with server echo is sufficient?
4. What minimum freshness metadata completeness is required before ranking v2 goes to GA?

## 13. Architecture Recommendation

Proceed with a modular extension strategy inside the existing web/mobile monorepo boundaries. Do not split services. Keep API evolution additive and feature-flagged. Prioritize instrumentation and deterministic orchestration logic before personalization depth.
