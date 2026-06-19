# IndLokal AI Pipeline — Lane-Aware Sourcing Architecture

**Status:** Proposed (design only — no code changes in this step)
**Scope:** Target sourcing model for the existing controlled ETL / content-intelligence pipeline.
**Related:** [AI_PIPELINE_ARCHITECTURE.md](AI_PIPELINE_ARCHITECTURE.md), [SOURCE_AND_EVIDENCE_POLICY.md](SOURCE_AND_EVIDENCE_POLICY.md), [specs/TDD/0056-pipeline-resource-lane.md](specs/TDD/0056-pipeline-resource-lane.md)

> This document defines the **target** sourcing model. It keeps the current
> known-source-first ETL pipeline (plan → fetch → prefilter → filter → extract →
> resolve → dedup → queue). It does **not** introduce agents, autonomous
> crawling, queues, or a new framework, and it is **not** a rewrite.

---

## 1. Problem statement

Sourcing is currently **unified** across all entity types. [source-plan.ts](../apps/web/src/modules/pipeline/source-plan.ts) builds one fetch surface, then [orchestrator.ts](../apps/web/src/modules/pipeline/orchestrator.ts) runs the same fetch → filter → extract path regardless of whether the target is a community, an event, or a resource. The LLM decides entity type at extraction time.

This is no longer optimal:

- **Different source types.** Communities live on registries, institutional directories, and social/profile pages. Events live on existing approved communities, their calendars, and event platforms (Meetup/Eventbrite). Resources live on government/city/consular portals. A single source set targets all three weakly.
- **Different freshness rules.** Events are worthless once stale (the pipeline already spends effort on `STALE_EVENT_MARKERS` / `FRESH_EVENT_MARKERS` detection). Communities and resources are comparatively stable and do not need event-grade freshness gating.
- **Different review rules.** Events from trusted existing community sources can be auto-approved; communities are mostly manual; resources are manual by policy. Today these distinctions live only in [review.ts](../apps/web/src/modules/pipeline/review.ts) **after** extraction, so we still pay LLM cost on items that were never auto-approvable.
- **Different LLM prompts.** A single relevance/extraction prompt must carry event, community, and resource instructions at once, inflating system-prompt tokens on every batch.
- **Unified sourcing increases token usage.** Mixed, weakly-targeted candidates flow into the two-stage LLM ([extraction.ts](../apps/web/src/modules/pipeline/extraction.ts)). Noise that a lane-specific deterministic prefilter could have dropped is instead paid for in filter/extract tokens.
- **Mapping errors (city and community).** Because the LLM alone decides entity type and city, and the same path serves all entities, we see real misclassifications:
  - _City-vs-event:_ an event is assigned the wrong city — e.g. it inherits the **source community's** city (`hintCitySlug`), or the LLM's `cityName` is hallucinated/copied from the page chrome, or an online event is forced onto a venue-less source city. Today the only correction is `inferCityFromEventSignals`, which fires **only when exactly one** city is mentioned in venue/title — so multi-city, online, and signal-less events fall through.
  - _Community-vs-event:_ a cross-posted/aggregated event inherits the **source** community because `preferredCommunityId` (`hintCommunityId`) or a fuzzy `name: { contains }` fallback attaches it even when the event's own `hostCommunity` names a different organization. Separately, type confusion (an org page extracted as an event, or vice versa) survives because type is LLM-only with no lane prior.

**Goal:** route sourcing into three lanes so each gets the right sources, the right deterministic prefilter, the right freshness rule, the right prompt, the right publication rule, **and lane-anchored, evidence-graded city/community resolution** — improving mapping correctness while reducing token usage, without changing the ETL shape.

---

## 2. Target lanes

| Lane        | Purpose                                                                                      | Primary output entity |
| ----------- | -------------------------------------------------------------------------------------------- | --------------------- |
| `COMMUNITY` | Discover diaspora organizations, groups, networks, and student/professional bodies.          | `ExtractedCommunity`  |
| `EVENT`     | Discover upcoming, dated activities — prioritizing existing approved communities first.      | `ExtractedEvent`      |
| `RESOURCE`  | Discover official/institutional services and information pages (consular, government, city). | `ExtractedResource`   |

A **lane** is a sourcing intent attached to a strategy and carried through the run. It determines source selection, prefilter, freshness rule, prompt variant, caps, and publication policy. Lanes do **not** replace `SourceType`; they group and govern strategies.

**Lane is explicit, not inferred.** Each strategy/config row declares its lane. `SourceType` is only a last-resort fallback for legacy rows, because the highest-noise sources (`GOOGLE_SEARCH`, `WEBSITE_SCRAPE`, `FACEBOOK`, `INSTAGRAM`) can each serve more than one lane — inferring lane from `sourceType` would re-introduce the ambiguity lanes exist to remove.

**Primary lane + secondary emissions.** A strategy has one **primary lane** that drives sourcing, caps, and prompt selection. Extraction _may_ emit secondary entities (e.g. a community website yields both the community _and_ its events — today's `db-sources.ts` behavior). For **MVP**, secondary emissions are allowed only for **logged/queued review**, never to drive auto-approval or bypass the secondary entity's lane policy. Once lane infrastructure is proven, secondary auto-approval can be evaluated. This keeps lanes from silently discarding legitimate cross-lane finds while preventing secondary emissions from weakening lane policy enforcement.

---

## 3. Source strategy per lane

### COMMUNITY discovery

- Generic search (existing `GOOGLE_SEARCH` / optional `DUCKDUCKGO`), community-signal keywords.
- Trusted aggregators and umbrella directories (see "institutional directory" / "trusted directory" lists in [source-policy.ts](../apps/web/src/lib/source-policy.ts)).
- Government / registry / institutional directories (Vereinsregister-style, consulate-listed associations).
- Public community / social / profile pages where feasible (`FACEBOOK`, `INSTAGRAM`, `MEETUP`).
- Diaspora / community directories (existing curated pinned sources).

### EVENT discovery

- **Existing approved DB communities first** — already produced by [db-sources.ts](../apps/web/src/modules/pipeline/db-sources.ts) (`DB_COMMUNITY` pinned strategies + event-page discovery/scoring).
- Community websites and their dedicated event pages.
- Embedded calendars ([calendar.ts](../apps/web/src/modules/pipeline/calendar.ts) — Google Calendar embeds).
- Meetup / Eventbrite / event platforms (`MEETUP`, `EVENTBRITE`).
- Google / search **only as fallback** or for low-coverage cities (current `cityGaps` behavior in [source-plan.ts](../apps/web/src/modules/pipeline/source-plan.ts)).

### RESOURCE discovery

- Government portals.
- City / state / federal official portals.
- Consulate / embassy pages (`government_consular` tier).
- Trusted institutional sources (`institutional_directory` tier).
- Restricted Google / search **only where useful** and constrained to official-domain results.
- **RESOURCE lane runs admin/city-scoped only in Phase 1.** Wrong resource data (legal, immigration, health, financial guidance) is high-liability; the lane does not run in normal cron until source configs, extraction accuracy, and review policy are proven (Phase 7).

---

## 4. Source intent and source policy (lightweight, conceptual)

A per-lane policy record — **conceptual, not a policy engine**. It should be a small static table keyed by lane (with optional per-strategy overrides), not a runtime rules system.

| Field                                 | COMMUNITY                                           | EVENT                                              | RESOURCE                        |
| ------------------------------------- | --------------------------------------------------- | -------------------------------------------------- | ------------------------------- |
| `lane`                                | `COMMUNITY`                                         | `EVENT`                                            | `RESOURCE`                      |
| `sourceIntent`                        | org/group discovery                                 | dated activity discovery                           | official service/info discovery |
| `trustTier` (min)                     | mixed; prefer institutional/owned                   | trusted existing community/event                   | official/trusted only           |
| `llmAllowed`                          | yes                                                 | yes                                                | yes (most constrained)          |
| `autoApproveAllowed`                  | only official/owned/institutional + high confidence | yes, from trusted existing community/event sources | no (manual)                     |
| `maxItems` / `maxChars` / `maxTokens` | low–medium                                          | medium                                             | low                             |
| `freshnessRequired`                   | no                                                  | yes (date/freshness signal)                        | soft (`validUntil` only)        |
| `eventDateSignalRequired`             | n/a                                                 | yes                                                | n/a                             |
| `officialDomainRequired`              | preferred                                           | no                                                 | yes                             |

Map `trustTier` onto the existing `EvidenceTier` from [source-policy.ts](../apps/web/src/lib/source-policy.ts) rather than inventing a parallel taxonomy:

- **Official / trust-supporting:** `official_registry`, `government_consular`, `institutional_directory`, `owned_website`.
- **Reviewable:** `hosted_site_builder`.
- **Weak but useful (discovery):** `social_profile`, `map_listing`, `event_platform`, `bio_link`.

The policy table answers four questions per candidate before any spend: _is this source in-lane, is the trust tier sufficient, may we call the LLM, and may we auto-approve?_

---

## 5. Mapping correctness — entity, city & community resolution

Lanes are not only a token lever; they are the **grounding context** that fixes the wrong-mapping problems. The principle: **never let the LLM be the sole authority for type, city, or community.** The lane supplies a prior, deterministic signals confirm or override it, and disagreement lowers confidence and routes to review instead of guessing.

### 5.1 Entity-type resolution (community vs event)

Type is decided by **lane prior + deterministic signals**, with the LLM as a tie-breaker — not the reverse.

- **Lane prior.** EVENT-lane sources are expected to yield events; COMMUNITY-lane sources yield communities; RESOURCE-lane sources yield resources.
- **Deterministic signals.** A concrete future date/time ⇒ EVENT. Persistent org markers (membership, recurring/no specific date, access channels, `Verein`/association) with no specific date ⇒ COMMUNITY.
- **Conflict rule.** If the LLM-assigned type disagrees with both the lane prior and the deterministic signals, **drop confidence and force manual review** (never auto-approve a cross-type item). This stops org pages leaking in as events and event flyers leaking in as communities.

### 5.2 City resolution (ordered, evidence-graded)

Replace the current LLM-first chain (`cityName` → `hintCitySlug` → fallback, with a single-mention event override) with an explicit precedence ordered by **evidence strength**, applied in the RESOLVE step of [orchestrator.ts](../apps/web/src/modules/pipeline/orchestrator.ts):

1. **Strong location evidence** — venue postal address / venue city that resolves to a configured city (including satellite→metro mapping via `SATELLITE_CITY_DATA` / `metroSlug`). Highest authority (extends today's `inferCityFromEventSignals` strong signals).
2. **Consistent event-signal city** — exactly one city consistently implied across title + venue + host.
3. **LLM `cityName`** — accepted only when it does **not** contradict (1) or (2).
4. **Source hint (`hintCitySlug`)** — accepted only when the item carries **no** contradicting location signal (prevents an event inheriting the source community's city).
5. **Online / venue-less events** — an `isOnline` event is resolved to a **scope** (national/online) rather than forced onto a city; only attach a city when a host community city is unambiguous. This avoids endless `CITY_PENDING` churn for legitimately city-less events.
6. **Out-of-coverage** — a venue in a city outside coverage is **dropped or held**, never mis-assigned to the nearest configured city.

**Conflict handling.** When a strong location signal disagrees with the LLM, prefer the deterministic signal (today's behavior) **but record `cityConflict`, lower confidence, and surface it in review**. Genuine **multi-city ambiguity** ⇒ `CITY_PENDING`, never a silent pick. Lane scope: the EVENT lane runs the full grounded chain; COMMUNITY/RESOURCE lanes (location-stable) lean on hint/LLM + `scope`/`scopeRegion`.

### 5.3 Community attachment (event → community)

The goal is to attach an event to its **true host**, not to whichever source surfaced it. Grade the attachment evidence in [review.ts](../apps/web/src/modules/pipeline/review.ts):

- **Trust the source hint conditionally.** `hintCommunityId` / `preferredCommunityId` is trusted **only when** the event's own `hostCommunity` is empty **or** agrees with the source community. If `hostCommunity` clearly names a **different** organization (cross-post/aggregator), do **not** attach to the source community.
- **Replace the fuzzy `contains` fallback with a scored threshold.** Use `scoreCommunityMatch` with a minimum score; below threshold ⇒ leave the event **unattached and queued for review** rather than binding it to a weak `name contains` match.
- **Ambiguity is a review signal, not a guess.** Multiple plausible communities ⇒ attach none, flag for review.

### 5.4 Persist resolution provenance

Record, on each `PipelineItem`, **how** city and community were chosen (signal | llm | hint | fallback), the resolution confidence, and any `cityConflict` / cross-type flag. This both makes mapping errors auditable and lets the review queue **surface low-confidence mappings first** — and it gates auto-approval (Section 8): a conflicted or low-confidence mapping is never auto-approvable.

### 5.5 Interaction with dedup

Resolution runs **before** dedup, and that ordering matters: today's `checkEventDuplicate` scans candidates **scoped by `cityId`**, so a wrong city silently hides a real duplicate. Dedup stays entity-scoped (no lane change to its keys), but it inherits the corrected city/community — so fixing resolution (Section 5.2–5.3) also reduces duplicate leakage. No change to dedup thresholds is required for this architecture.

---

## 6a. Token budget principle

Lanes must reduce token usage in normal cron runs without starving discovery. Allocate the per-run token budget by lane intent, not by uniform caps:

- **EVENT lane:** receives the majority of the normal cron budget (frequent, high-value freshness signal).
- **COMMUNITY lane:** capped at lower volume, runs lower-frequency or admin/city-scoped (discovery is lower-urgency than event freshness).
- **RESOURCE lane:** runs **admin/city-scoped only** until proven; never consumes normal cron budget (see Section 3, bullet 2).
- **Broad generic search:** must never consume the majority of any cron run's token budget. Always fallback to keywords only for explicitly-signaled gaps (current `cityGaps` behavior).

This ensures lanes improve efficiency by preventing weak-signal mixed sourcing, not by reducing coverage of the EVENT lane which drives the most user value.

---

## 6. Token optimization

All rules are **deterministic and run before the LLM** wherever possible, extending the existing prefilter that already drops stale event pages in [orchestrator.ts](../apps/web/src/modules/pipeline/orchestrator.ts) (`isLikelyStaleEventPage`).

1. **Deterministic filtering before LLM.** Lane prefilter drops out-of-lane / low-signal candidates before `filterRelevance`.
2. **Lane-specific source caps.** Per-lane `maxItems` caps (reuse the existing cap machinery: `PIPELINE_DB_PINNED_LIMIT`, `limitDbPinnedSources`, DDG keyword limits) instead of one global cap.
3. **Lane-specific prompts.** Separate, smaller system prompts per lane (Section 4 of [extraction.ts](../apps/web/src/modules/pipeline/extraction.ts)) — no combined event+community+resource instruction block per batch.
4. **Max chars per item.** Truncate raw text to a lane-specific `maxChars` before batching (event/resource need less context than a community "about" page).
5. **Skip stale / archive pages.** Keep and lane-scope the existing stale-marker drop; apply only to the EVENT lane.
6. **EVENT lane requires date/freshness signals.** No date or fresh-year signal ⇒ drop before LLM.
7. **COMMUNITY lane requires org/community signals.** No organization/community marker (name, `Verein`/association, membership, access channel) ⇒ drop before LLM.
8. **RESOURCE lane prefers official/trusted domains.** Non-official domains are dropped or heavily down-ranked via `assessEvidenceUrl` before LLM.

Each rule reduces candidates entering the two-stage LLM, which is the dominant token cost (filter batch + extract batch). The per-run token budget and circuit breaker (`PipelineBudgetExceededError`, `PipelineCircuitOpenError`) remain unchanged as the backstop.

---

## 7. Runtime cadence

| Run type            | Primary lane focus  | Cadence                                                                          |
| ------------------- | ------------------- | -------------------------------------------------------------------------------- |
| Normal cron         | `EVENT` (freshness) | Frequent (current cron schedule). Community/resource lanes minimized or skipped. |
| Community discovery | `COMMUNITY`         | Lower frequency, or admin-/city-scoped.                                          |
| Resource discovery  | `RESOURCE`          | Lower frequency, or admin-/city-scoped.                                          |

This matches existing behavior where `triggeredBy === 'cron'` uses tighter caps/thresholds and admin runs widen discovery (`forceAdminKeywordSearch`). Lane focus is selected at plan time via run scope (`PipelineRunScope`) — no scheduler/queue is introduced.

---

## 8. Review and auto-approval

The **review queue remains the publication boundary** (`PipelineItem` → [review.ts](../apps/web/src/modules/pipeline/review.ts)). Lanes only adjust eligibility, which already partially exists in `shouldAutoApprovePipelineItem`:

- **Events:** auto-approve **only** from trusted existing community/event sources with high confidence (current rule: source reliability ≥ 0.8 approval rate over ≥ 5 reviews, confidence ≥ 0.9, core fields present, no existing-entity match). Lane tightens "trusted source" to the EVENT lane's source set.
- **Communities:** mostly manual review. Auto-approval allowed **only** for official / owned / institutional sources with high confidence — gate the existing community branch on `trustTier` from the lane policy.
- **Resources:** manual review by default (already enforced: `resource-admin-approval-required`).

No lane changes the invariant that auto-approved items remain `UNVERIFIED` pending human confirmation. A **conflicted or low-confidence city/community mapping (Section 5.4) is never auto-approvable**, regardless of lane.

**Reliability is keyed per `(source, lane)`, not per source.** A source's event-extraction accuracy and community-extraction accuracy differ; `getSourceReliabilityMap` should track them separately so a source trusted for events cannot auto-approve its (weaker) community emissions.

---

## 9. Mapping to existing code

| Module                                                                  | Lane-aware responsibility                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [types.ts](../apps/web/src/modules/pipeline/types.ts)                   | Add `SourceLane = 'COMMUNITY' \| 'EVENT' \| 'RESOURCE'` and optional `lane` / `sourceIntent` on `SearchStrategy`; add `SourcePolicy` record type and a `ResolutionProvenance` shape (city/community source + confidence + conflict flags).                                                                                                                     |
| [runtime-config.ts](../apps/web/src/modules/pipeline/runtime-config.ts) | Carry an **explicit `lane`** through config rows (DB `pipeline_source_configs` payload + JSON defaults + `pnpm pipeline:sources:sync`); `sourceType` is only a last-resort fallback for legacy rows.                                                                                                                                                           |
| [db-sources.ts](../apps/web/src/modules/pipeline/db-sources.ts)         | DB community + event-page strategies tagged `EVENT` (and `COMMUNITY` where applicable); `hintCommunityId` / `hintCitySlug` remain hints, now consumed conditionally (Section 5.2–5.3).                                                                                                                                                                         |
| [source-plan.ts](../apps/web/src/modules/pipeline/source-plan.ts)       | Group strategies by lane; apply per-lane caps and keyword templates (existing `EVENT_GAP_TEMPLATES` / `COMMUNITY_GAP_TEMPLATES` become lane-scoped); add resource templates/sources.                                                                                                                                                                           |
| [sources.ts](../apps/web/src/modules/pipeline/sources.ts)               | Unchanged fetch adapters; lane is metadata on the strategy, not a new fetch mode.                                                                                                                                                                                                                                                                              |
| [extraction.ts](../apps/web/src/modules/pipeline/extraction.ts)         | Lane-specific filter/extract prompts and `maxChars`; lane prior constrains entity-type output (Section 5.1). The three lane prompts must share **one** JSON contract validated against the `ExtractedData` shapes in `types.ts` (as the resource lane already does via enum lists) so they cannot drift. Keep two-stage batching, budget, and circuit breaker. |
| [reliability.ts](../apps/web/src/modules/pipeline/reliability.ts)       | `getSourceReliabilityMap` keyed per `(source, lane)` so event vs community accuracy is tracked separately (Section 8).                                                                                                                                                                                                                                         |
| [dedup.ts](../apps/web/src/modules/pipeline/dedup.ts)                   | No key/threshold change; runs after resolution and benefits from corrected city/community (Section 5.5).                                                                                                                                                                                                                                                       |
| [orchestrator.ts](../apps/web/src/modules/pipeline/orchestrator.ts)     | Add lane prefilters before `filterRelevance`; route batches to lane prompts; promote `inferCityFromEventSignals` into the ordered city-resolution chain (Section 5.2); record `cityConflict` + resolution provenance; pass lane + provenance into auto-approval.                                                                                               |
| [review.ts](../apps/web/src/modules/pipeline/review.ts)                 | `shouldAutoApprovePipelineItem` consults lane policy + trust tier + mapping confidence; conditional `hintCommunityId` trust and scored-threshold community attachment replace the `name contains` fallback (Section 5.3).                                                                                                                                      |
| `PipelineItem` / `PipelineRun` / `PipelineLlmCall`                      | Persist `lane` and resolution provenance (city/community source + confidence + conflict) for observability, review ordering, and per-lane token/cost metrics. No schema rewrite — additive fields only (mirrors how `RESOURCE` was added in TDD-0056).                                                                                                         |

---

## 10. Incremental implementation plan

Each phase is independently shippable and backward compatible. No phase requires a rewrite. Behavior-changing phases ship behind a `FLAGS` gate and are validated in **shadow mode** (log the new decision vs the old without changing output) before enforcement.

**MVP focus:** Phases 1–4 prioritize immediate token savings and scope control. Resolution hardening (Phases 5–6) improves correctness and is added after lane infrastructure is stable.

- **Phase 1 — Types with backward-compatible defaults.** Add `SourceLane` / `sourceIntent` / `SourcePolicy` types in [types.ts](../apps/web/src/modules/pipeline/types.ts); strategies default to inferred lane for legacy rows. **Plus read-only instrumentation** that captures today's baseline: per-entity token cost, mapping-conflict rate, and auto-approval rate. No behavior change.
- **Phase 2 — Lane metadata to source planning (no behavior change yet).** Carry explicit `lane` through config rows (DB `pipeline_source_configs` payload + JSON defaults); tag existing strategies. Keep old cron/cap behavior for one release. Safe transition that lets config/UI changes land.
- **Phase 3 — Lane-aware cron + budget gating (immediate token savings).** Apply per-lane caps in `source-plan.ts`; make normal cron EVENT-first and limit broad community/resource discovery (Section 6a). COMMUNITY lane runs lower-frequency or admin-scoped; RESOURCE lane **admin/city-scoped only, never in normal cron** (Section 3, bullet 2). This single change reduces token burn on weak-signal mixed sourcing.
- **Phase 4 — Deterministic lane prefilters (more token savings).** Add EVENT/COMMUNITY/RESOURCE prefilters in [orchestrator.ts](../apps/web/src/modules/pipeline/orchestrator.ts) (Section 7 rules) before the LLM filter stage.
- **Phase 5 — City/community resolution hardening (mapping correctness).** Implement the ordered city-resolution chain + conflict handling (Section 5.2), conditional community attachment with a scored threshold (Section 5.3), dedup ordering (Section 5.5), and resolution provenance on `PipelineItem` (Section 5.4). Runs in shadow mode first (logs new vs old decision), then enforces. Can ship anytime after Phase 2; does not depend on prompts.
- **Phase 6 — Lane-specific LLM prompts.** Split the filter/extract prompts in [extraction.ts](../apps/web/src/modules/pipeline/extraction.ts) by lane against one shared JSON contract; apply per-lane `maxChars`; pass the lane prior for entity-type (Section 5.1).
- **Phase 7 — Auto-approval gating & reliability tracking.** Gate auto-approval on lane policy + mapping confidence; key reliability per `(source, lane)` (Section 8); lane focus selection at plan time; per-lane token/cost and mapping-conflict metrics on `PipelineRun` / `PipelineLlmCall`, compared against the Phase 1 baseline.
- **Phase 8 — Source policy hardening & RESOURCE lane graduation.** Enforce `trustTier` / `officialDomainRequired` in [review.ts](../apps/web/src/modules/pipeline/review.ts); graduate RESOURCE lane from admin-only to scoped/scheduled runs once extraction and review policy are validated (Phase 7 metrics).

---

## Constraints honored

- No code modified in this step (documentation only).
- No rewrite; the plan → fetch → filter → extract → dedup → queue ETL shape is preserved.
- No agents, queues, or autonomous crawling.
- Reuses existing primitives: `EvidenceTier` trust tiers, the two-stage LLM with budget/circuit-breaker guards, the `PipelineItem` review boundary, and existing per-run caps.
- Every lane rule is biased toward dropping candidates **before** LLM spend.
