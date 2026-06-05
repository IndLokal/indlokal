# PRD-0052: Journey Layer v1 - composition engine + first journey (city x persona)

- **Status:** Draft
- **Owner:** Product (Phase 2)
- **Reviewers:** PM, Eng Lead, Design
- **Linked:** TDD-0052, ADR-0011, PRD/TDD-0053 (tagging ops, hard dependency),
  ADR-0007 / PRD/TDD-0030 (resource scope + `resources/journey` seam),
  ADR-0010 / PRD/TDD-0048 (discovery graph), PRD/TDD-0051 (unified taxonomy),
  [`docs/PHASE_2_JOURNEY_LAYER.md`](../../PHASE_2_JOURNEY_LAYER.md)

## 1. Problem

Phase 1 (shipped) organizes everything around **what we store** - Communities, Events, Resources - each
its own vertical. But diaspora users arrive mid-**transition**, not with a "community problem":

> _"I'm moving to Stuttgart as a young family - what do I do, and in what order?"_

The answers exist today, but scattered across three content types. The user is forced to translate their
life question into our storage taxonomy and stitch the pieces together themselves. There is no surface
that says: _here is your move, stage by stage, ending in actions._ The closest thing we ship -
`GET /api/v1/cities/:slug/resources/journey` (PRD/TDD-0030) - is resources-only, not persona-aware, not
action-ending, and has no UI.

This PRD builds the **first real journey**: a composed, persona-selected, stage-ordered, action-ending
experience for one city x persona, on top of a reusable composition engine. It is the Phase 2 spine that
later journeys, personalization, ecosystem, and business all hang on (strategy §6, §8, §14).

**Why now:** a content-type directory is being commoditized by AI answers; verified, city-specific,
stage-ordered, action-linked journeys are not (strategy §11, §18). And the cost is low because the tags,
the resolver (which already accepts a persona filter), scope stacking, and a stage-grouping seam all
already exist (ADR-0011 §Context).

## 2. Users & JTBD

| Persona                              | Job-to-be-done                                                                                                                                                                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Young family (launch persona)**    | "We're relocating to Stuttgart with a small child. Tell me - in order - what to sort before we arrive, in the first 30/90 days, and once settled: registration, Kita/Kindergeld, health, housing, and which Indian family communities and events are actually for us." |
| **Returning visitor mid-transition** | "I started this last week. Let me reopen my journey and continue where I left off, not re-browse three verticals."                                                                                                                                                     |
| **Signed-in member with a persona**  | "I already told you I'm a family newcomer in Stuttgart - default me into the right journey, but let me switch."                                                                                                                                                        |
| **Operator / city ambassador**       | "Show me which stages of the family journey are thin so I know what supply to add."                                                                                                                                                                                    |

## 3. Success Metrics

North Star for Phase 2 is **Journey Progressions** (strategy §14; [`docs/PHASE_2_JOURNEY_LAYER.md`](../../PHASE_2_JOURNEY_LAYER.md) §14).

| Metric                                                                                                          | Target (first journey)                                  | Source                                                                    |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| Journey progression rate (session advances >=2 stages **or** saves the journey)                                 | >= 25% of journey-page sessions                         | new `journey_stage_view` / `journey_save` events                          |
| **Journey -> access-channel conversion** (a block action click: join channel / open official link / save event) | >= 15% of journey-page sessions                         | reuse Phase-1 conversion events + new `journey_block_action`              |
| Journey entry-point CTR (persona selector on `/` and `/[city]/`)                                                | >= 8% of city-surface sessions                          | new `journey_entry_click`                                                 |
| Every rendered block has a resolvable action                                                                    | 100% (invariant, action-or-drop)                        | composition unit tests + `journey_block_action` has no "inert" block type |
| No Phase-1 regression (discovery North Star, resources `resource_view`)                                         | flat or up                                              | `EVENTS/analytics.md` existing events                                     |
| First journey clears the minimum-density gate before promotion                                                  | Stuttgart x Family >= N blocks/stage (N in TDD-0052 §8) | resolver counts (PRD/TDD-0053 audit)                                      |

New analytics events are defined in TDD-0052 §5 and must be added to `EVENTS/analytics.md`.

## 4. Scope

In:

- A reusable **`modules/journeys` composition engine** - `composeJourney({ persona, citySlug, stage?, language? }) -> JourneyView` (ADR-0011, TDD-0052 §2-§3). Deterministic, rule-based, reuses existing resolver / community / event query layers.
- **Multi-entity composition**: resources (persona + stage filtered via the resolver's existing `audience`/`stage` options), communities (`personaSegments`/`languages`), and events (persona-relevant categories, `PUBLISHED` only). An **ecosystem-org block exists but is empty** until Phase 4.
- A **generalized journey API** - `GET /api/v1/cities/[slug]/journey?persona=…` - that extends/supersedes the resources-only `resources/journey` seam to persona-aware + multi-entity (back-compat handled in TDD-0052 §3).
- The **first journey surface** - `/[city]/journeys/[persona]/` web page rendering a stage-ordered `JourneyView`, each block ending in an action, linking into canonical Phase-1 detail pages.
- **Journey entry points** - a "What brings you here?" persona selector on `/` (alongside the city picker) and a journey strip on `/[city]/`.
- A **journey hub** - `/journeys/` (persona + city selector / index of available journeys).
- **Member integration (reuse Phase 1)** - "save this journey" via existing saved-items rails; persona pre-selection from `User.personaSegments` (overridable).
- **Sparsity guardrails** - graceful degradation (scope stacking fills thin stages with national/state resources), empty-stage collapse, minimum-density promotion gate, action-or-drop.
- **Journey analytics** - the new events in §3 / TDD-0052 §5.
- **Launch journey: one city x persona** - **Stuttgart x Young Family** (densest data, clearest demand). The engine is generic; this PRD ships exactly one journey end-to-end as the proof.

Out (this PRD):

- **Remaining personas/journeys at scale** (Student, Professional, Skilled Worker, Founder, Business) - the engine supports them; rolling them out city-by-city follows once PRD/TDD-0053 coverage clears the density gate. Tracked as follow-on, not this PRD.
- **Personalization / recommendations / inference / concierge** - Phase 3. Journeys here are persona-_selected_, not _predicted_.
- **Ecosystem-org journey blocks as a populated product** - the block is wired but empty (Phase 4).
- **Business / Connect products** - the Entrepreneur/Business journeys are not in this first-journey PRD; even when added they ship as composed guides only - no business product, sponsor matching, or introductions (gated, strategy §12).
- **Mobile journey surface** - mobile entry + parity is a fast follow (the generalized API backs it); web ships first.
- **Materialized / pinned journeys + editorial intro** - optional, dense-city only, later (ADR-0011 §6).
- **A journey authoring CMS** - explicitly never (ADR-0011).
- **Multi-language journey UI** - English only in Phase 2 (matches Phase 1).
- **New content tables / schema migration** - none in v1 (TDD-0052 §2).

## 5. User Stories

- **As a relocating parent**, I land on `/` , pick "Family" + "Stuttgart", and get a stage-ordered guide ("Before you arrive -> First 30 days -> First 90 days -> Settled") where each item is a real, verified thing I can act on now.
- **As that parent**, every card has a clear next action - open the official Anmeldung page, join a verified Telugu-families community channel, save Saturday's family event, tick off "register address" - never a dead-end paragraph.
- **As a signed-in member** whose profile says I'm a family newcomer in Stuttgart, the persona selector is pre-chosen for me, but I can switch to "Professional" in one tap.
- **As a member**, I tap "Save this journey" and it appears in my saved items so I can return and continue.
- **As a visitor in a thin city**, the family journey still isn't empty - it shows the strongest local items plus Baden-Württemberg / Germany-wide resources, and collapses any stage it genuinely can't fill, never showing "0".
- **As an analyst**, I can see, per journey, the progression funnel and the access-channel conversion, and which stage is weakest.

## 6. Acceptance Criteria (Gherkin)

```gherkin
Feature: Composed city x persona journey

  Scenario: Stuttgart family journey is stage-ordered and multi-entity
    Given Stuttgart x Family clears the minimum-density gate
    When I GET /api/v1/cities/stuttgart/journey?persona=FAMILY
    Then the response has stages in canonical order:
      PRE_ARRIVAL, FIRST_30_DAYS, FIRST_90_DAYS, SETTLED, ANYTIME
    And resource blocks are filtered to audience FAMILY (via the resolver)
    And community blocks are filtered to personaSegments containing a family segment
    And event blocks are PUBLISHED only
    And every returned block carries a resolvable action descriptor
    And no block without a resolvable action is present

  Scenario: Action-or-drop invariant
    Given a candidate community has no access channel and is not saveable
    When the journey is composed
    Then that community does not appear as a block

Feature: Sparsity guardrails

  Scenario: Thin stage degrades, never blanks
    Given a city stage has no city- or metro-scoped resources for the persona
    When the journey is composed
    Then the stage is filled by STATE/COUNTRY/GLOBAL scope resources where available
    And if a stage has zero blocks after degradation it is collapsed, not rendered empty

  Scenario: Below-density journey is not promoted
    Given Munich x Family is below the minimum-density gate
    When I view /munich/ city surface
    Then the Family journey is not shown as a promoted entry point
    But /munich/journeys/young-family/ remains directly reachable

Feature: Journey surface and entry points

  Scenario: Persona selector routes into a journey
    Given I am on /
    When I choose persona "Family" and city "Stuttgart"
    Then I navigate to /stuttgart/journeys/young-family/
    And a journey_entry_click event is recorded

  Scenario: Every block links into a canonical Phase-1 page
    Given I am on /stuttgart/journeys/young-family/
    When I open any community/event/resource block
    Then it navigates to the canonical /stuttgart/communities|events|resources detail page
    And no Phase-1 route, ranking, or canonical URL has changed

Feature: Member integration

  Scenario: Persona pre-selection from profile (overridable)
    Given I am signed in with personaSegments including a family segment and city Stuttgart
    When I open /journeys/
    Then the Family persona is pre-selected
    And I can switch to another persona freely

  Scenario: Save a journey
    Given I am signed in on /stuttgart/journeys/young-family/
    When I tap "Save this journey"
    Then it appears in my saved items
    And a journey_save event is recorded
```

## 7. UX

Surfaces:

1. **Landing `/`** - alongside the existing city picker, a "What brings you here?" persona selector
   (Student / Family / Professional / Skilled Worker / Founder / Business). Choosing persona + city
   routes to `/[city]/journeys/[persona]/`. Only personas/cities that clear the density gate are
   promoted; others remain reachable by direct URL.
2. **City surface `/[city]/`** - a journey strip ("Navigate your move: Family - Student - Professional…").
3. **Journey page `/[city]/journeys/[persona]/`** - the hero. A stage-ordered, scannable guide. Each
   stage shows a few high-value, **action-ending** blocks:
   - a **resource** card -> "Open guide" (official link) + optional "Mark done" (client-side, reuse the
     `resource_journey_step_complete` pattern from PRD-0030);
   - a **community** card -> "Join" (access channel) / "Follow";
   - an **event** card -> "Save" / "Add to calendar";
   - a **checklist** step -> tick.
     Each block deep-links into its canonical Phase-1 detail page for depth. A persona switcher and a
     "Save this journey" CTA sit in the header.
4. **Journey hub `/journeys/`** - persona + city selector and an index of available (density-cleared)
   journeys; pre-selected from member profile when signed in.

States:

- **Empty stage** -> collapse the stage (never render "0"); see sparsity guardrails.
- **Thin journey (below density gate)** -> reachable by URL but not promoted; show an honest "we're still
  building the {persona} journey for {city} - here's what we have, plus Germany-wide essentials".
- **Loading** -> skeleton stages + skeleton blocks.
- **Error** -> toast + retry; never blank the page.
- **a11y** -> stages are a labelled ordered structure; each block action is a real link/button with an
  accessible name; persona selector is keyboard-navigable.

Analytics events (full schema in TDD-0052 §5; add rows to `EVENTS/analytics.md`):

| Event                    | Properties                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `journey_entry_click`    | `persona`, `citySlug`, `source` (`landing` / `city_strip` / `hub`)                                             |
| `journey_view`           | `persona`, `citySlug`, `language`, `blockCount`, `stageCount`                                                  |
| `journey_stage_view`     | `persona`, `citySlug`, `stage`, `stageIndex`                                                                   |
| `journey_block_action`   | `persona`, `citySlug`, `stage`, `entityKind`, `actionKind` (`join`/`open_link`/`save`/`checklist`), `entityId` |
| `journey_save`           | `persona`, `citySlug`                                                                                          |
| `journey_persona_switch` | `from`, `to`, `citySlug`                                                                                       |

## 8. Risks & Open Questions

- **Thin tag coverage -> weak journeys.** This PRD has a **hard dependency** on PRD/TDD-0053: the
  coverage audit + backfill must land Stuttgart x Family above the density gate before this journey is
  promoted. Mitigation: ship the engine and page behind the gate; promote only when dense.
- **Journeys drift into a blog (inform without action).** Mitigation: action-or-drop is a composition
  invariant (not a UI nicety) and `journey_block_action` is a North-Star metric.
- **Generalizing the `resources/journey` seam without breaking PRD-0030.** Mitigation: keep the old route
  back-compatible (or supersede with a redirect) - see TDD-0052 §3.
- **Disrupting Phase-1 SEO/IA.** Mitigation: overlay-only routes; zero changes to canonical URLs;
  canonical discipline on journey pages (TDD-0052 §3, ADR-0011 §5).
- **Open: the exact minimum-density gate threshold (N blocks/stage)** - proposed in TDD-0052 §8, to be
  confirmed against the PRD/TDD-0053 audit numbers for Stuttgart.
- **Open: route slug vocabulary** - `young-family` vs `family`, `early-career` vs `professional`. Decide
  the canonical persona slugs in TDD-0052 §3 and keep them stable (they become SEO URLs).
- **Open: caching TTL for composed journeys** - reuse the resolver's 60 s LRU pattern vs a dedicated
  journey cache; TDD-0052 §7.
