# TDD-0052: Journey Layer v1 - composition engine, generalized API, first journey surface

- **Status:** Draft
- **Linked PRD:** PRD-0052
- **Linked ADR:** ADR-0011 (composition model), ADR-0007 (resource scope), ADR-0010 (discovery graph)
- **Owner:** Engineering (Phase 2)

## 1. Architecture overview

The Journey Layer is a **composition module** plus **presentation surfaces**. It introduces no new
data-access path: it orchestrates the existing resolver / community / event query layers and shapes their
output into a stage-ordered, action-ending `JourneyView` (ADR-0011 §2).

```
┌────────────────────────────┐   ┌────────────────────────────┐
│  Web /[city]/journeys/      │   │  /  + /[city]/ entry points │
│  [persona]/ (RSC page)      │   │  persona selector / strip   │
└──────────────┬─────────────┘   └──────────────┬─────────────┘
               │                                 │ navigate
               │           ┌─────────────────────┘
               ▼           ▼
   ┌────────────────────────────────────────────────┐
   │  GET /api/v1/cities/[slug]/journey?persona=…    │  (Node runtime)
   │   (generalizes resources/journey, PRD-0030)     │
   └───────────────────────┬────────────────────────┘
                           ▼
   ┌────────────────────────────────────────────────┐
   │  modules/journeys/compose.ts                    │
   │    composeJourney({persona, citySlug,           │
   │                    stage?, language?})          │
   │      ├─ rules: stage order, action-or-drop,     │
   │      │         essentials-lead, density gate    │
   │      └─ orchestrates ↓ (no new DB access)       │
   └───┬───────────────┬────────────────┬────────────┘
       ▼               ▼                ▼
  resolver        modules/community  modules/event      (ecosystem: empty stub, Phase 4)
  getResourcesForCity getCommunitiesByCity  event queries
  (audience+stage)   (personaSegments)   (PUBLISHED, persona cats)
```

New code lives under `apps/web/src/modules/journeys/`:

```
modules/journeys/
  index.ts            # public exports
  compose.ts          # composeJourney() - orchestration + rules
  personas.ts         # persona <-> ResourceAudience / personaSegment mapping, route slugs
  actions.ts          # resolveAction(block) -> ActionDescriptor | null  (action-or-drop)
  density.ts          # minimum-density gate evaluation
  types.ts            # JourneyView, JourneyStage, JourneyBlock, ActionDescriptor
  __tests__/
    compose.test.ts
    density.test.ts
    personas.test.ts
```

## 2. Data model changes

**None in v1.** Per ADR-0011 §6 the engine composes over existing tags:
`Resource.audiences[]` / `Resource.lifecycleStage[]` / scope fields, `Community.personaSegments[]` /
`Community.languages[]` / `Community.organizationType`, `Event` category + moderation state, and
`User.personaSegments[]` / `User.preferredLanguages[]` - all already shipped (ADR-0007, ADR-0010,
PRD/TDD-0051).

No migration. The only data-quality precondition is **tag coverage**, owned by PRD/TDD-0053 (hard
dependency). A thin, additive, nullable materialized `Journey` record is explicitly deferred (ADR-0011
§6) and is **not** part of this TDD.

## 3. API surface

### 3.1 Generalizing the existing seam

PRD/TDD-0030 shipped `GET /api/v1/cities/[slug]/resources/journey` - essentials-only **resources** grouped
by stage. We add the generalized, persona-aware, multi-entity endpoint:

```
GET /api/v1/cities/[slug]/journey?persona=FAMILY[&stage=FIRST_30_DAYS][&lang=en]
```

- The **resolver already supports the persona filter** we need - `ResolverOptions` in
  [`modules/resources/resolver.ts`](../../../apps/web/src/modules/resources/resolver.ts) accepts
  `{ audience, stage, essentialsOnly }`. The journey route just passes `audience: persona`. No resolver
  change is required for resources beyond wiring (optional: relax `essentialsOnly` so journeys include
  non-essential persona resources in later stages).
- **Back-compat:** the old `resources/journey` route stays and is unchanged (PRD-0030 consumers keep
  working). The new route is additive. If/when the mobile resources screen migrates, the old route can be
  marked deprecated in a later spec - not here.

### 3.2 Zod contract - `packages/shared/src/contracts/journeys.ts` (new)

Additive new module alongside `resources.ts` / `community.ts` / `events.ts`. Reuses existing enums
(`ResourceAudience`, `ResourceStage`) from `@indlokal/shared`; does not redefine them.

```ts
import { z } from 'zod';
import { ResourceAudience, ResourceStage } from './resources';

// Persona is the public, URL-facing vocabulary; it maps to one+ ResourceAudience
// values and personaSegment(s) internally (see modules/journeys/personas.ts).
export const JourneyPersona = z.enum([
  'STUDENT',
  'PROFESSIONAL',
  'FAMILY',
  'SKILLED_WORKER',
  'FOUNDER',
  'BUSINESS',
]);
export type JourneyPersona = z.infer<typeof JourneyPersona>;

export const JourneyActionKind = z.enum(['join', 'open_link', 'save', 'calendar', 'checklist']);

export const JourneyActionDescriptor = z.object({
  kind: JourneyActionKind,
  label: z.string(),
  href: z.string().nullable(), // canonical Phase-1 detail URL or official link
});

export const JourneyEntityKind = z.enum([
  'resource',
  'community',
  'event',
  'checklist',
  'ecosystem',
]);

export const JourneyBlock = z.object({
  entityKind: JourneyEntityKind,
  entityId: z.string().nullable(), // null for synthetic checklist steps
  title: z.string(),
  summary: z.string().nullable(),
  resolvedScope: z.string().nullable(), // which scope tier matched (resources)
  action: JourneyActionDescriptor, // INVARIANT: present (action-or-drop)
});

export const JourneyStageBlock = z.object({
  stage: ResourceStage,
  stageIndex: z.number().int(),
  blocks: z.array(JourneyBlock),
});

export const JourneyView = z.object({
  persona: JourneyPersona,
  citySlug: z.string(),
  language: z.string().default('en'),
  promoted: z.boolean(), // cleared the minimum-density gate
  stages: z.array(JourneyStageBlock), // canonical order, empty stages omitted
  blockCount: z.number().int(),
});
export type JourneyView = z.infer<typeof JourneyView>;
```

OpenAPI is regenerated from these schemas per ADR-0002 (Zod-as-contract).

### 3.3 Endpoint table

| Method | Path                                      | Auth   | Request                                        | Response                |
| ------ | ----------------------------------------- | ------ | ---------------------------------------------- | ----------------------- |
| GET    | `/api/v1/cities/[slug]/journey`           | public | query: `persona` (required), `stage?`, `lang?` | `JourneyView`           |
| GET    | `/api/v1/cities/[slug]/resources/journey` | public | (unchanged, PRD-0030)                          | stage-grouped resources |

### 3.4 Persona mapping (`modules/journeys/personas.ts`)

| Persona (URL slug)                | `ResourceAudience` filter | Community `personaSegment` filter | Notes                                          |
| --------------------------------- | ------------------------- | --------------------------------- | ---------------------------------------------- |
| `young-family` (FAMILY)           | `FAMILY`                  | family segment(s)                 | **launch journey**                             |
| `student` (STUDENT)               | `STUDENT`, `STUDENT_VISA` | student segment(s)                | follow-on                                      |
| `professional` (PROFESSIONAL)     | `EMPLOYEE`                | professional-network segment(s)   | follow-on                                      |
| `skilled-worker` (SKILLED_WORKER) | `NEWCOMER`, `EMPLOYEE`    | regional/newcomer segment(s)      | follow-on                                      |
| `founder` (FOUNDER)               | `FOUNDER`                 | founder/professional segment(s)   | follow-on; ecosystem block empty until Phase 4 |
| `business` (BUSINESS)             | `FOUNDER` (org-level)     | business/institutional segment(s) | composed guide only; gated, strategy §12       |

Persona slugs are canonical SEO URLs - **fixed here, kept stable** (resolves PRD-0052 §8 open question).
`composeJourney` maps a persona to its audience set and queries the resolver per audience (union, dedup
by entity id).

## 4. Composition logic (`modules/journeys/compose.ts`)

`composeJourney({ persona, citySlug, stage?, language? }) -> JourneyView`:

1. Resolve persona -> `{ audiences[], personaSegments[] }` (personas.ts).
2. **Resources** - for each audience, call `getResourcesForCity(citySlug, { audience, stage? })`; union +
   dedup by slug (resolver already dedups per call by scope specificity). Scope stacking and consular
   jurisdiction are inherited unchanged (ADR-0007).
3. **Communities** - `getCommunitiesByCity(citySlug, …)` filtered to `personaSegments` (+ optional
   `languages`); only verified/claimed lead for prominence (trust gate inherited, ADR-0008/0010).
4. **Events** - persona-relevant categories, `PUBLISHED` only (moderation axis inherited, ADR-0009),
   upcoming first.
5. **Ecosystem** - `[]` stub (Phase 4).
6. **Bucket by stage** into canonical order `PRE_ARRIVAL -> FIRST_30_DAYS -> FIRST_90_DAYS -> SETTLED ->
ANYTIME`. Resources carry `lifecycleStage[]` and appear in each stage they target; communities/events
   map to a stage heuristic (e.g. communities -> `FIRST_90_DAYS`/`SETTLED`, upcoming events -> nearest
   relevant stage) defined in compose.ts and unit-tested.
7. **Action-or-drop** (`actions.ts`) - `resolveAction(block)` returns an `ActionDescriptor` (join channel
   / open official link / save / calendar / checklist) or `null`. **A block with `null` action is
   dropped.** This is an invariant, asserted in `compose.test.ts`.
8. **Order within a stage** - `isEssential` + `priority desc` (matches PRD-0030), then verified
   communities, then soonest events.
9. **Degrade + collapse** - scope stacking fills thin stages with STATE/COUNTRY/GLOBAL resources; a stage
   with zero blocks after composition is omitted from `stages` (collapse).
10. **Density gate** (`density.ts`) - set `promoted = true` only if each non-empty stage clears the
    threshold (§8). `promoted` drives whether entry points advertise the journey; the page itself is
    always reachable by URL.

Composition is **deterministic and side-effect free** (no writes, no ML) - reproducible for the same
inputs and DB state (ADR-0011 §3).

## 5. Push / Email / Inbox triggers

None new in v1. The existing retention producers (PRD/TDD-0049, INBOX transport) may **later** target a
member's saved-journey city/persona - that is a follow-on, not this TDD. No new rows in
`EVENTS/notifications.md`.

New **analytics** events (add to `EVENTS/analytics.md`), emitted client-side on the journey surfaces and
mirrored to `UserInteraction` where a member is signed in (consistent with PRD/TDD-0048 search telemetry):

| Event                    | Properties                                                                |
| ------------------------ | ------------------------------------------------------------------------- |
| `journey_entry_click`    | `persona`, `citySlug`, `source` (`landing`/`city_strip`/`hub`)            |
| `journey_view`           | `persona`, `citySlug`, `language`, `blockCount`, `stageCount`, `promoted` |
| `journey_stage_view`     | `persona`, `citySlug`, `stage`, `stageIndex`                              |
| `journey_block_action`   | `persona`, `citySlug`, `stage`, `entityKind`, `actionKind`, `entityId`    |
| `journey_save`           | `persona`, `citySlug`                                                     |
| `journey_persona_switch` | `from`, `to`, `citySlug`                                                  |

`journey_block_action` is the conversion event tying journeys back to the Phase-1 access-channel/save
funnel (strategy §14).

## 6. Feature flags

| Flag                             | Default                    | Behavior                                                                                                    |
| -------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `JOURNEY_LAYER_ENABLED`          | `false`                    | Master kill-switch. Off: journey routes 404 / entry points hidden; zero impact on Phase 1.                  |
| `JOURNEY_CITY_PERSONA_ALLOWLIST` | `"stuttgart:young-family"` | Comma list of `city:persona` pairs allowed to render. Lets us launch exactly one journey and expand safely. |

Density gate (`promoted`) is data-driven and independent of the allowlist: a journey can be allowlisted
but un-promoted (reachable, not advertised) until coverage lands.

## 7. Observability

- **Logs/metrics:** `composeJourney` logs `{ persona, citySlug, blockCount, stageCount, promoted,
durationMs }`; counter on dropped-for-no-action blocks (watch for journeys silently starving).
- **Cache:** reuse the resolver's 60 s LRU for the resource leg; add a small composed-`JourneyView` LRU
  keyed `citySlug|persona|stage|lang` (60 s TTL), busted by the same `invalidateResolver()` admin-save
  hook plus community/event publish hooks (resolves PRD-0052 §8 caching question).
- **Sentry:** tag `journey.persona`, `journey.city`; alert if composed `blockCount === 0` for an
  allowlisted+promoted journey (means coverage regressed).
- **Density dashboard:** surface per-stage block counts per allowlisted journey for ops (feeds
  PRD/TDD-0053 supply prioritization).

## 8. Failure modes & fallbacks

- **Unknown / inactive city or persona** -> 404 from the route (validated against `JourneyPersona` enum +
  `City.isActive`).
- **Empty composition (no blocks)** -> route returns `JourneyView` with `stages: []`, `promoted: false`;
  page renders the honest "still building" state (PRD-0052 §7), never a blank/error.
- **Thin stage** -> degrade via scope stacking; collapse if still empty.
- **Minimum-density threshold (proposed):** a journey is `promoted` when **every non-empty stage has >= 2
  blocks and the journey has >= 6 blocks total**, with `PRE_ARRIVAL` + `FIRST_30_DAYS` non-empty.
  Confirm against the PRD/TDD-0053 Stuttgart x Family audit before launch (PRD-0052 §8 open question).
- **Downstream query failure (resolver/community/event)** -> compose returns partial `JourneyView` for
  the legs that succeeded + logs the failure; never 500s the whole page for one failed leg.
- **Flag off** -> routes 404, entry points hidden, Phase 1 untouched.

## 9. Test plan

- **Unit (`modules/journeys/__tests__`)**, following the `modules/resources/__tests__/resolver.test.ts`
  pattern:
  - `compose.test.ts` - stage ordering canonical; resources filtered by audience; communities by
    personaSegment; events `PUBLISHED` only; **action-or-drop invariant** (a no-action candidate never
    appears); essentials-lead ordering; empty-stage collapse; deterministic output for fixed input.
  - `density.test.ts` - gate thresholds (promoted vs not) at boundary counts.
  - `personas.test.ts` - persona -> audience/segment/slug mapping is total and stable.
- **Contract** - `JourneyView` Zod schema validates route output; OpenAPI regenerated and diffed.
- **Integration** - seed Stuttgart fixtures; assert `GET /api/v1/cities/stuttgart/journey?persona=FAMILY`
  returns multi-entity, stage-ordered, all-blocks-actionable; assert old `resources/journey` route is
  byte-for-byte unchanged (back-compat).
- **E2E (Playwright web)** - persona selector on `/` -> lands on `/stuttgart/journeys/young-family/`;
  block action click navigates to the canonical detail page; save-journey appears in saved items; thin
  journey shows the honest state, not an error.
- **Load (k6)** - the new endpoint under the resolver+composed cache; p95 budget comparable to
  `resources/journey`.
- **Regression** - Phase-1 routes/ranking/canonicals unchanged; discovery North Star events still fire.

## 10. Rollout plan

1. Land `modules/journeys` + the new API + the page behind `JOURNEY_LAYER_ENABLED=false`.
2. Verify **PRD/TDD-0053** coverage has Stuttgart x Family above the density gate (hard dependency).
3. Enable `JOURNEY_LAYER_ENABLED` with `JOURNEY_CITY_PERSONA_ALLOWLIST="stuttgart:young-family"` in
   staging; internal quality review (every block has an action; stages read sensibly).
4. Production: flag 1% -> 10% -> 50% -> 100% for the single allowlisted journey; watch journey
   progression + access-channel conversion vs the Phase-1 funnel; confirm no Phase-1 regression.
5. Expand the allowlist persona-by-persona / city-by-city only as PRD/TDD-0053 coverage clears the gate
   (separate follow-on rollouts, not this TDD).

## 11. Backout plan

Set `JOURNEY_LAYER_ENABLED=false`: journey routes 404, entry points disappear, Phase 1 is wholly
unaffected (overlay-only, no schema change, no data migration to reverse). The new module and API are
additive and inert when flagged off.
