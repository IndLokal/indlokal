# PRD-0053: Journey tag coverage - audit, backfill & tagging-at-ingestion

- **Status:** Implemented (coverage report + admin backfill GA; pipeline tag suggestions flag-gated, `JOURNEY_TAG_SUGGESTIONS_ENABLED`)
- **Owner:** Product + Content Ops (Phase 2)
- **Reviewers:** PM, Eng Lead, Content/Ambassador lead
- **Linked:** TDD-0053, ADR-0011 (composition model), PRD/TDD-0052 (journey engine - **blocks on this**),
  ADR-0007 / PRD/TDD-0030 (resource scope + tags), PRD/TDD-0051 (unified taxonomy),
  AI pipeline specs (PRD/TDD-0013 review queue, ADR-0006 ETL),
  [`docs/PHASE_2_JOURNEY_LAYER.md`](../../PHASE_2_JOURNEY_LAYER.md) §10

## 1. Problem

Journeys (PRD-0052) compose over existing tags - `Resource.audiences[]`, `Resource.lifecycleStage[]`,
`Community.personaSegments[]`, `Community.languages[]`. **A journey is only as good as the tag coverage
underneath it.** Today those tags are sparsely and unevenly applied:

- The `audiences` / `lifecycleStage` columns shipped with PRD-0030 but were only systematically set for
  Stuttgart essentials during the dedupe migration; most rows (and most cities) are untagged or
  partially tagged.
- `Community.personaSegments` exists but is not consistently populated, so persona-filtered community
  blocks will be thin or empty.
- There is no measurement of coverage, so we cannot answer the first Phase-2 question: _which journeys,
  in which cities, are dense enough to ship?_

Without a deliberate coverage pass, the journey engine will technically work but produce thin, broken-
feeling journeys - the exact failure mode PRD-0052's density gate is designed to refuse to promote. **This
is the first, blocking Phase-2 task** (strategy §10; [`docs/PHASE_2_JOURNEY_LAYER.md`](../../PHASE_2_JOURNEY_LAYER.md) §10, §15 step 0).

## 2. Users & JTBD

| Persona                        | Job-to-be-done                                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Product / Eng (gatekeeper)** | "Tell me, per city x persona x stage, how many tagged components exist, so I only build/promote journeys that can be good."                                |
| **Admin / Content editor**     | "Let me see and fix untagged high-value resources and communities fast, so the family journey isn't missing housing or Kita."                              |
| **City ambassador**            | "Show me the gaps in my city's journeys so I know what to add or tag next."                                                                                |
| **AI pipeline**                | "When I extract a new community/event, suggest audience/persona/stage tags into the review queue so a human can approve - keeping coverage from decaying." |

## 3. Success Metrics

| Metric                                                   | Target                                                             | Source                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| **Coverage report exists** per city x persona x stage    | shipped (P0)                                                       | new `journey:coverage` report (TDD-0053 §3) |
| Resource `audiences` coverage in launch city (Stuttgart) | >= 80% of active resources tagged                                  | report query                                |
| Resource `lifecycleStage` coverage in Stuttgart          | >= 80% of active resources tagged                                  | report query                                |
| Community `personaSegments` coverage in Stuttgart        | >= 70% of active communities tagged                                | report query                                |
| Stuttgart x Family clears PRD-0052 density gate          | yes (unblocks PRD-0052 launch)                                     | coverage report vs gate                     |
| Tagging-at-ingestion live                                | new communities/resources get suggested tags into the review queue | pipeline + organizer-form change            |
| Backfill is human-approved                               | 100% of pipeline-suggested tags pass the L0 review gate            | review-queue audit                          |

## 4. Scope

In:

- A **coverage audit report** (`journey:coverage` script/route) measuring `audiences[]`,
  `lifecycleStage[]` per resource and `personaSegments[]` per community, broken down by city x persona x
  stage, with a "ready to promote?" verdict per journey against the PRD-0052 density gate.
- **Admin-assisted backfill UI** - extend the existing resource/community admin edit surfaces
  (PRD-0030 already added scope/audience/stage/priority to the resource form) so editors can quickly tag
  untagged high-value rows; a filtered "untagged / journey-gap" worklist.
- **Pipeline-assisted backfill (suggest, never auto-apply)** - the AI extraction pipeline suggests
  `audiences` / `lifecycleStage` (resources) and `personaSegments` (communities) into the existing
  **review queue** (PRD/TDD-0013); a human approves. Tags are never written without the L0 trust gate
  (ADR-0006 ETL-not-agent, strategy §10).
- **Tagging-at-ingestion** - organizer/host community edit forms gain persona/segment fields; the
  pipeline emits suggested tags on new extractions, so coverage does not decay as supply grows.
- **Journey-gap analytics hook** - feed zero-result / thin-stage signals (from PRD-0052 observability)
  into a supply-prioritization view so ops fix the blocks that break the most-trafficked journeys.

Out:

- The journey **engine / surfaces** themselves (PRD/TDD-0052).
- Automatic, unreviewed tag writes (forbidden - human-in-the-loop is the point).
- A new taxonomy / new enum values (we use the shipped `ResourceAudience` / persona segment vocab from
  `@indlokal/shared`, PRD-0051; if a gap is found it is a separate taxonomy change).
- Multi-language tagging / translated content (English only, Phase 2).
- Backfilling cities beyond the launch set in this PRD (Stuttgart first; others follow with their journey
  rollouts).

## 5. User Stories

- **As Eng**, I run `pnpm journey:coverage --city=stuttgart` and get a table: per persona, per stage,
  how many tagged resources/communities exist and whether it clears the density gate.
- **As an editor**, I open an "untagged resources" worklist filtered to Stuttgart, and tag the housing /
  Kita / registration rows with `audiences=[FAMILY]`, `lifecycleStage=[FIRST_30_DAYS]` in a few clicks.
- **As the pipeline**, when I extract a new "Indian Parents Stuttgart" community, I suggest
  `personaSegments=[family]` and route it to the review queue; an admin approves and it now feeds the
  family journey.
- **As an ambassador**, I see that Stuttgart x Family `SETTLED` stage has only 1 tagged item and add two
  more communities/resources to fill it.

## 6. Acceptance Criteria (Gherkin)

```gherkin
Feature: Coverage audit

  Scenario: Coverage report grades a journey against the density gate
    Given the journey:coverage report is run for Stuttgart
    When I read the FAMILY row
    Then it shows tagged resource + community counts per lifecycle stage
    And a verdict "READY" or "THIN" against the PRD-0052 density gate

Feature: Admin-assisted backfill

  Scenario: Tagging an untagged resource makes it journey-eligible
    Given a Stuttgart housing resource has empty audiences and lifecycleStage
    When an editor sets audiences=[FAMILY] and lifecycleStage=[FIRST_30_DAYS] and saves
    Then the resolver cache for Stuttgart is busted
    And the resource appears in the FAMILY journey FIRST_30_DAYS stage

Feature: Pipeline-assisted, human-approved tagging

  Scenario: Suggested tags require approval
    Given the pipeline extracts a new family-oriented community
    When it emits suggested personaSegments=[family]
    Then the suggestion enters the review queue as PENDING
    And the community is NOT journey-eligible until a human approves
    And on approval it becomes journey-eligible

Feature: Tagging-at-ingestion keeps coverage from decaying

  Scenario: Organizer sets persona on a new community
    Given an organizer creates/edits a community
    When they select a persona segment in the form
    Then personaSegments persists and the community is journey-eligible immediately
```

## 7. UX

- **Coverage report** - primarily a CLI/admin readout (table): rows = persona, columns = stage, cells =
  tagged component counts + READY/THIN verdict; plus an overall "journeys ready to promote in {city}".
- **Admin backfill worklist** - a filter on the existing `/admin/data/resources` and community admin
  lists: "untagged" / "missing audience" / "missing stage" / "missing personaSegments", with inline edit
  using the fields PRD-0030 already added (resources) and new persona fields (communities).
- **Review queue** - reuse PRD/TDD-0013's queue; pipeline tag suggestions render as an approvable diff on
  the entity (approve/edit/reject), consistent with existing extraction review.
- **Organizer/host community form** - add a persona-segment multi-select (and language reuse) using the
  shared taxonomy from `@indlokal/shared`; copy clarifies it powers journeys.
- States: empty worklist -> "all high-value rows tagged for {city}"; report with no city data -> "no
  active content for {city}".

No new public-facing analytics events; this PRD is operational. It consumes the journey-gap signals from
PRD-0052 observability.

## 8. Risks & Open Questions

- **Backfill labor underestimated.** Mitigation: prioritize by journey traffic + density gap (fix the
  blocks that break the most-used journeys first), use pipeline suggestions for scale, humans only
  approve.
- **Pipeline tag suggestions are low-quality.** Mitigation: suggest-only into the review queue; measure
  approval rate; if low, tighten the prompt or fall back to admin-only tagging (no auto-writes either
  way).
- **Taxonomy gap discovered (no suitable audience/segment value).** Mitigation: out of scope here - raise
  a separate PRD-0051-style taxonomy change; do not invent ad-hoc tags.
- **Coverage decays after launch.** Mitigation: tagging-at-ingestion (organizer form + pipeline
  suggestions) is in scope precisely to prevent decay; coverage report is re-runnable as a health check.
- **Open: density-gate thresholds** - shared with PRD/TDD-0052 §8; the report must use the same numbers
  so "READY" means "promotable".
