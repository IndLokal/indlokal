# PRD-0030: Resources v2 - scoped knowledge, satellite parity, first-30-days journey

- **Status:** Approved
- **Owner:** Product (this branch)
- **Reviewers:** PM, Eng Lead, Design
- **Linked:** TDD-0030, ADR-0007, PRD-0010 (predecessor), [`docs/specs/AUDIT_PERSONAS_AND_INTERFACES.md`](../AUDIT_PERSONAS_AND_INTERFACES.md)

## 1. Problem

The Resources surface (web hub `/[city]/resources/` and mobile
`Resources` screen) ships PRD-0010, but only Stuttgart is meaningfully
populated. As of this branch:

| Active metro                                               | Resource count |
| ---------------------------------------------------------- | -------------- |
| Stuttgart                                                  | 41             |
| Berlin                                                     | 8              |
| Munich                                                     | 8              |
| Frankfurt                                                  | 8              |
| Karlsruhe                                                  | 6              |
| Mannheim                                                   | 6              |
| **All satellites (Heidelberg, Esslingen, Ludwigsburg, …)** | **0**          |

Three structural problems explain the imbalance:

1. **Forced duplication.** `Resource.cityId` is mandatory and single-
   valued. Federal knowledge (`116117`, `ELSTER`, `Arbeitsagentur`,
   `make-it-in-germany`, EU Blue Card, GKV vs PKV) is duplicated per
   metro under different slugs. Authoring scales O(metros), not O(facts).
2. **Satellite cities are invisible.** Mobile's
   `GET /api/v1/cities/{slug}/resources` for `heidelberg` returns `[]`.
   Even on web, satellite slugs have no own resource page; only metros do.
3. **No editorial spine.** Resources are a flat bag tagged by type. There
   is no "what every newcomer needs in their first 30 days" arc, no
   audience filter, no priority. Browsing degrades into scrolling.

This is now the largest gap between what IndLokal promises ("Indian
expats in Germany, sorted") and what it delivers outside Stuttgart.

## 2. Users & JTBD

| Persona                | Job-to-be-done                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pre-arrival**        | "I just got my Blue Card / job offer - give me the checklist for week 1 in {city}: registration, bank, insurance, SIM, where to eat Indian, who to call for OCI."               |
| **First-30-days**      | "I landed in {city}. What do I have to do, in what order, by when, with which authority, and where do I book the appointment?"                                                  |
| **Settled family**     | "Kita registration in {city}. Kindergeld for non-EU. School choice. English-friendly Hausarzt."                                                                                 |
| **Founder**            | "Gewerbe vs Freiberufler in {city}. Which IHK. Health insurance for self-employed. Steuerberater that speaks English/Hindi."                                                    |
| **Satellite resident** | "I live in Heidelberg/Esslingen/Brandenburg, not the metro centre. Show me Rhein-Neckar IHK, Stuttgart Bürgeramt rules, and the Berlin embassy - not the Stuttgart-only stuff." |

## 3. Success Metrics

| Metric                                                 | Target                                     | Source                                  |
| ------------------------------------------------------ | ------------------------------------------ | --------------------------------------- |
| Resources surfaced per active metro (incl. satellites) | ≥ 25 (was 6-41)                            | `db.resource` count via resolver        |
| Satellite cities with non-zero resource view           | 100 % of `City.isActive` satellites        | `db.resource` count via resolver        |
| `resource_view` events / WAU on `/[city]/resources/`   | +50 % vs baseline                          | `EVENTS/analytics.md → resource_view`   |
| `resource_journey_step_complete` (new event)           | ≥ 30 % of new mobile installs hit ≥ 1 step | new analytics event (see §7)            |
| Editorial drift - duplicate slugs across cities        | 0                                          | DB invariant: `slug` is globally unique |

## 4. Scope

In:

- New `ResourceScope`, `ResourceAudience`, `ResourceStage` enums and
  columns on `Resource` (see TDD-0030 §2 and ADR-0007).
- One **resolver** module used by both web hub and mobile API.
- **Consular jurisdiction map** so consulates resolve automatically per
  city without duplicating rows.
- **Satellite parity**: every active satellite city (Heidelberg,
  Esslingen, Ludwigsburg, Brandenburg ring, …) gets a populated resource
  page that inherits its metro, state, country, and global rows.
- **First-30-days journey**: an ordered, opinionated checklist surfaced
  as the top section of the resource hub, per metro, with sensible
  defaults that satellites inherit.
- **Audience filter** (Newcomer / Family / Founder / Student) on the hub.
- **Admin UI** updates so editors can set scope, audience, stage, and
  priority on each row.
- **Seed dedupe**: collapse the 4× `116117`, 3× `ELSTER`, 3×
  `Arbeitsagentur`, 4× `CGI Munich`, etc. into single canonical rows.

Out:

- Full Resource CMS overhaul (rich-text editor, image library,
  versioning). The admin form gets the new fields; deeper editorial
  workflow is its own PRD later.
- AI-pipeline extraction of resources (PRD-0XYZ, future). The pipeline
  still only emits `EVENT` and `COMMUNITY`.
- User-generated resources / community wiki.
- Multi-language resource bodies (English-only for now; structured for
  i18n later via `metadata.translations`).
- District-level scope (`DISTRICT`) - enum value reserved, no UI yet.

## 5. User Stories

- **As a newcomer in Heidelberg**, I open `/heidelberg/resources/` and
  see the same first-30-days checklist as Mannheim, plus the
  Mannheim-metro Bürgeramt link, plus BW-state and federal info, plus
  the CGI Munich consular block - all without leaving the page.
- **As a founder in Berlin**, I filter the hub by `Founder` and see IHK
  Berlin, federal Gewerbeanmeldung guidance, and Berlin-specific
  Finanzamt info - but not Family/Kita rows.
- **As an editor**, I tag a new "EU Blue Card extension" row as
  `scope = COUNTRY`, `audiences = [NEWCOMER, EMPLOYEE]`,
  `lifecycleStage = [FIRST_90_DAYS, SETTLED]`, `priority = 80`,
  `isEssential = true`. It immediately appears on every active city's
  hub at the right position.
- **As a mobile user on a slow 3G connection**, the resource list still
  loads ≤ 1.5 s p95 because the resolver result is cached per city for
  60 s.

## 6. Acceptance Criteria (Gherkin)

```gherkin
Feature: Satellite-city resource parity

  Scenario: Heidelberg surfaces metro + state + country resources
    Given Heidelberg is an active satellite of Mannheim in Baden-Württemberg
    When I GET /api/v1/cities/heidelberg/resources
    Then the response includes resources scoped to:
      - GLOBAL
      - COUNTRY (Germany)
      - STATE  (Baden-Württemberg)
      - METRO  (Mannheim)
      - CITY   (Heidelberg)
    And no resource slug appears twice in the response
    And the response includes "CGI Munich Consular Services" exactly once

Feature: No duplicate pan-Germany rows after migration

  Scenario: The 116117 resource exists exactly once
    Given the migration has run
    When I query Resource where slug ILIKE 'guide-116117%' OR title ILIKE '%116117%'
    Then exactly 1 row is returned
    And that row has scope = COUNTRY and scopeRegion = 'DE'

Feature: First-30-days journey

  Scenario: Newcomer hub shows ordered checklist
    Given Berlin has 4 essential resources tagged FIRST_30_DAYS
    When a newcomer opens /berlin/resources/
    Then the top section is "Your first 30 days in Berlin"
    And it shows the 4 essential resources in priority DESC order
    And each step is tappable to its resource detail page

Feature: Audience filter

  Scenario: Family filter hides Founder-only rows
    Given I am on /munich/resources/ with no filter
    When I select the "Family" audience filter
    Then only resources with audiences containing FAMILY remain visible
    And the URL becomes /munich/resources/?audience=family
```

## 7. UX

Surfaces:

1. **`/[city]/resources/` hub (web).** Three vertically stacked sections:
   1. **"Your first 30 days in {city}"** - ordered checklist of up to 8
      essential `FIRST_30_DAYS` resources. Each card: number, title,
      tldr (description first line), CTA "Open guide" + "Mark done"
      (client-side, localStorage).
   2. **Topic hubs** - existing 9 category cards, count badges driven by
      the resolver, not raw `cityId` count.
   3. **City essentials card** - only true `CITY`-scoped rows for this
      city (your Bürgeramt, your IHK, your nearest Indian grocer).

   Above the journey: audience filter chips (`All / Newcomer / Family /
Founder / Student`).

2. **Satellite pages** - same template, no special-case copy. The
   journey title reads "Your first 30 days in {satellite name}" but the
   underlying rows are inherited from the parent metro.

3. **Mobile `Resources` screen** - match web's three-section structure
   in a single `ScrollView`. Use `RESOURCE_CATEGORIES` from
   `@indlokal/shared` so labels and icons match the web hub. Audience
   filter as a horizontal `Pill` rail at the top.

4. **Admin** - `/admin/data/resources/[id]/edit` adds:
   - Scope (radio: Global / Country / State / Metro / City)
   - Scope region (conditional input: state picker / metro picker / city
     picker, or static "DE" / "Global")
   - Audiences (multi-select chips)
   - Lifecycle stages (multi-select chips)
   - Priority (number, 0-100, default 50)
   - Essential toggle (boolean)

Empty / loading / error:

- Empty per category → "We're still gathering {category} for {city}.
  See city-wide essentials below." (Never show "0 resources".)
- Loading → skeleton journey + skeleton category cards.
- Error → toast + retry; do not blank the page.

Analytics events (full schema in `EVENTS/analytics.md` - new rows):

| Event                             | Properties                                         |
| --------------------------------- | -------------------------------------------------- |
| `resource_view`                   | `cityScope`, `resolvedScope` (which scope matched) |
| `resource_journey_step_view`      | `stepIndex`, `stepSlug`, `citySlug`                |
| `resource_journey_step_complete`  | `stepIndex`, `stepSlug`, `citySlug`                |
| `resource_audience_filter_change` | `from`, `to`, `citySlug`                           |

## 8. Risks & Open Questions

- **Migration backfill scope rewrites** - the predicate list that turns
  Stuttgart-tagged federal rows into `COUNTRY`-scoped canonical rows is
  the riskiest step. Mitigated by: shipping the migration as
  _additive_ (new columns, default `CITY`), then a separate "dedupe"
  migration that runs after the resolver is in production, behind a
  feature flag. See TDD-0030 §10.
- **Caching staleness vs editor velocity** - 60 s LRU TTL means an
  editor's change takes up to 1 min to appear. Acceptable for v1;
  admin save path explicitly busts the cache key for the affected
  cities.
- **Open: jurisdiction edge cases.** Embassy Berlin technically covers
  Berlin + Brandenburg + Mecklenburg-Vorpommern. CGI Munich covers BW
  - BY + parts of southern Germany. The map in
    `consular-jurisdictions.ts` is the canonical source - needs sign-off
    from someone with current knowledge of consular boundaries before
    Phase-2 cities go live.
- **Open: should `DISTRICT` scope ship in v1?** Decision: no. Reserve
  the enum value, ship the column, but no UI or seed rows yet.
