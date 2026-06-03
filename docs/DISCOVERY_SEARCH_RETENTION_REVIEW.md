# IndLokal — Discovery Strategy, Search & User Retention Review

> Strategic product review. Status: Draft for decision. Date: 2026-06-03.
> Scope: current product audit, UX audit, search audit, retention analysis, positioning,
> ecosystem-data strategy, gap matrix, prioritized roadmap.
> This is an opinionated review. It deliberately challenges assumptions and does not praise the
> existing build by default. Evidence is cited from code where possible.

---

## 0. Executive Summary (read this first)

**What IndLokal actually is today:** a **city-partitioned directory of Indian communities + an AI-fed
events calendar, wrapped in a strong SEO + resources layer.** The data model, pipeline, RBAC, and
moderation are genuinely well-built for an MVP. The weak axes are **discovery (search is city-locked
and excludes resources/organizations), retention (no habit loop — the "feed" is a static cached
assembly, the notification engine is dormant), and operations (every moderation queue is manual,
one-click-per-item).**

**The single most important strategic correction:** IndLokal is being built as four parallel
verticals (Feed / Events / Communities / Resources). It should be repositioned as **one searchable
ecosystem graph** where the entry point is _intent_, not _navigation_. The current information
architecture forces users to pick a vertical before they know what they want — which inverts how
diaspora users actually think.

**Three bets that matter in the next 90 days:**

1. **Make search global and need-first** (city becomes a filter, resources + communities + events +
   organizations unified). This aligns the product with real user intent and is mostly a query-layer
   change on infrastructure that already exists.
2. **Build the one retention loop the data model already supports but does not fire:** a weekly,
   per-city "what's happening" digest (push + email). `NotificationOutbox`/`InboxItem` tables exist
   and have **zero producers** today.
3. **Convert moderation from manual to assisted** (dedup suggestions, confidence-based auto-approve,
   bulk actions) before supply volume makes humans the bottleneck.

**What NOT to build now (explicitly):** business marketplace, opportunity/investor platform,
classifieds, rentals, generic social feed. The ecosystem-database framing gets you to the
"OS for India–Europe relationships" vision _without_ prematurely building any marketplace.

---

## 1. Product Audit — Public Experience

### 1.1 Home page

- **Purpose:** SEO landing + city router. Funnels users into a city.
- **Implementation:** [apps/web/src/app/page.tsx](apps/web/src/app/page.tsx) — static hero, city
  search/select (`CitySearch`), `WebSite` + `Organization` JSON-LD, a `SearchAction` schema pointing
  at `/{city}/search?q=`. Marketing-led, not data-led.
- **Journey:** land → pick city → city feed. The home page does not show _any_ live content
  (no "events this week across Germany", no trending communities). It is a brochure, not a product surface.
- **Strengths:** clean SEO scaffolding; correct canonical/OG; clear single CTA ("List a Community").
- **Weaknesses:** zero live proof-of-life on the highest-traffic page; search action is city-scoped at
  the schema level (`/{city}/search`), so Google's sitelinks search box can't do a national search.
- **Missing:** a national/"all cities" search and a national "this week" strip. The home page should be
  the strongest retention and SEO asset and is currently the weakest.

### 1.2 Feed

- **Reality check:** there is **no dynamic feed**. "Feed" = `getCityFeed()` in
  [apps/web/src/modules/discovery/queries.ts](apps/web/src/modules/discovery/queries.ts), a
  **5-minute-cached static assembly**: events this week, 8 active communities, last-30-day past events,
  a "browse by category" grid, and aggregate counts.
- **Journey:** open a city → see the same blocks every visit, in the same order, regardless of who you are.
- **Strengths:** fast (cached, parallel queries), good first-visit overview.
- **Weaknesses:** not personalized, not chronological, not novel between visits. Calling it a "feed"
  sets a habit-forming expectation the implementation does not meet. Past-events block can make a city
  look _more_ dead than alive in low-supply cities.
- **Missing:** personalization (persona/language/saved), recency ordering, "new since your last visit",
  saved-entity follow-ups.

### 1.3 Communities

- **Purpose:** the central node — trust infrastructure for diaspora groups.
- **Implementation:** rich `Community` model (status + `claimState` + scores: activity/trust/
  completeness, `isTrending`, `personaSegments`, `languages`, `AccessChannel`, `RelationshipEdge`).
  This is the strongest part of the data model.
- **Journey:** browse city communities → open profile → click out to WhatsApp/Telegram/website (the
  `AccessChannel` "bridge from discovery to engagement").
- **Strengths:** genuine taxonomy depth; claim/trust lifecycle; relationship graph already modeled.
- **Weaknesses:** the profile is a _destination_, and the value (the access link) is consumed once.
  There's little reason to return to a community profile after you've joined its WhatsApp group.
- **Missing:** "what changed" on a community (new events, new collaborators), follow/subscribe with a
  reason to come back, public-facing trust-badge explanations.

### 1.4 Events

- **Purpose:** the stated "primary retention driver" (schema comment) and the main pipeline output.
- **Implementation:** dual-lane creation (community lane → `PUBLISHED`; host/pipeline lane →
  `PENDING_REVIEW`), `EventModerationState` orthogonal to `EventStatus` lifecycle (ADR-0009),
  timezone-safe entry, recurrence presets (PRD-0047), AI discovery pipeline.
- **Journey:** city feed "this week" → event detail → register/RSVP out.
- **Strengths:** clean moderation/lifecycle separation; strong governance; AI supply engine.
- **Weaknesses:** events are the retention bet, but **event supply per city per week is structurally
  thin** for a single diaspora (see §4.2). Retention pegged to events alone will fail in all but the
  top 3–4 metros.
- **Missing:** RSVP/attendance as first-class (only `SavedEvent` exists), reminders, calendar export,
  recurring-series management, "events near a saved community".

### 1.5 Resources

- **Purpose:** practical settling-in / consular / bureaucracy guides.
- **Implementation:** the most sophisticated and under-marketed asset. Scope-tiered resolver
  ([apps/web/src/modules/resources/resolver.ts](apps/web/src/modules/resources/resolver.ts)):
  GLOBAL→COUNTRY→STATE→METRO→CITY dedup-by-slug, `ResourceAudience`, `ResourceStage` (PRE_ARRIVAL →
  SETTLED), `isEssential`, and a real consular-jurisdiction map (Berlin/Frankfurt/Munich posts).
- **Strengths:** evergreen, high-SEO-intent, low-maintenance, genuinely useful, lifecycle-aware.
- **Weaknesses:** treated as a side tab rather than the **top-of-funnel acquisition engine** it is.
  Not surfaced on the home page; not integrated into search.
- **Missing:** resource search; "newcomer pack" by persona+stage as a landing experience; internal
  links from resources → relevant communities/events (the cross-sell that creates sessions).

### 1.6 Search

- **Implementation:** [apps/web/src/modules/search/queries.ts](apps/web/src/modules/search/queries.ts)
  — Postgres FTS (`to_tsvector`/`plainto_tsquery`) with `ts_rank`, ILIKE fallback, prefix autocomplete,
  trending keywords from `KeywordSuggestion`.
- **Critical limitations (see full audit §2):**
  - **City-scoped by construction** — every search path calls `resolveCityIds(citySlug)` and returns
    `[]` with no city. There is **no global search**.
  - **Only communities + events.** Resources and organizations are **not searchable at all**.
  - Ranking is per-entity `ts_rank` only — no quality/trust/recency boosting, no cross-type blending
    beyond "communities first, then events".

### 1.7 City pages

- **Implementation:** `/[city]` with sub-routes (`communities`, `events`, `resources`, `search`,
  `suggest`, plus SEO landings `indian-events-this-week`, `business-events`, `consular-services`).
  Metro/satellite model (`isMetroPrimary`, `resolveCityIds` fans out to satellites). Satellite slugs
  redirect to metro root.
- **Strengths:** correct metro aggregation; good SEO surface area per city.
- **Weaknesses:** city is a **hard partition**, not a filter. A user in Mannheim who'd happily attend a
  Frankfurt event has no cross-city path. The architecture optimizes for SEO doorways over user reach.

### 1.8 Navigation

- Vertical-first (Communities / Events / Resources tabs within a city). Forces "Location → vertical →
  browse". There is no persistent global search bar as the primary action.

### 1.9 SEO

- **Strengths:** per-city metadata, JSON-LD, sitemap/robots, `llms.txt`, dedicated intent landings.
  Repo memory (2026-06-01) shows a deliberate, correct anti-doorway stance (strengthen authority pages
  vs. spawn thin keyword pages).
- **Weaknesses:** resources (the best evergreen SEO asset) are under-leveraged; national search intent
  ("indian events in germany") lands on a brochure home page with no live content.

---

## 2. Organizer & Platform-Admin Experience (condensed)

Full findings are in the gap matrix (§7). Headlines:

**Organizer / Host**

- Profile + links management, claim workflow, collaborator governance (ADR-0008 v2: OWNER/COLLABORATOR,
  transfer/last-owner guards), dual-lane events, host dashboard with completeness meter. Solid coverage.
- **Biggest gap: zero analytics for organizers/hosts.** The platform records `UserInteraction`
  (VIEW/CLICK*ACCESS/SAVE/SHARE) but never shows organizers how their community/events perform. This is
  the #1 missing organizer-retention hook — organizers return for \_numbers*.
- No profile preview, no event drafts, no create-time dedup, no rejected-event "fix & resubmit" loop.

**Platform Admin**

- 9 queues (claims, submissions, collaborators, events, reports, pipeline, merge, scoring, audit) +
  ambassador outreach CRM. RBAC is healthy (`RoleAssignment` + `can()`), audit log + CSV export exist.
- **Biggest risk: everything is manual, one-click-per-item.** No dedup _suggestions_ (merge is fully
  manual), confidence-based auto-approve exists in the pipeline but is under-used, no bulk actions on
  most queues, rejection reasons frequently not persisted. Human labor becomes the scaling ceiling
  long before features do.

---

## 3. Search & Discovery Review (Phase 2)

| Question                 | Finding (evidence)                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where does search exist? | `/[city]/search` + autocomplete `/[city]/suggest`; module `modules/search`.                                                                           |
| City-scoped or global?   | **City-scoped only.** Every function requires `citySlug` → `resolveCityIds`; empty city ⇒ empty results.                                              |
| Architecture             | Postgres FTS (`tsvector`/`tsquery`) + `ts_rank`, ILIKE fallback, prefix autocomplete, `KeywordSuggestion`-driven trending. No external search engine. |
| Ranking logic            | Per-entity `ts_rank` text relevance only. No trust/quality/recency boost. Cross-type = communities-then-events.                                       |
| Coverage                 | **Communities + events only.** Resources and organizations are excluded.                                                                              |
| UX                       | Search is a sub-page _inside_ a city, not the primary entry point.                                                                                    |

**Does this match how users think? No.** The hypothesis in the brief is correct: diaspora users think
**Need → (Search) → Location** ("Telugu families near me", "find a Diwali event", "how do I register my
address"). The product forces **Location → vertical → browse**. The mismatch is structural, not cosmetic.

**Recommendations (high-conviction):**

1. **Promote global search to the primary entry point** (home + persistent top bar). One box, all
   entity types.
2. **Make city a filter/context, not a partition.** Default to the user's city (geo/saved/last-used) but
   keep cross-city reachable — critical in metro-adjacent regions (Mannheim↔Frankfurt, Karlsruhe↔Stuttgart).
3. **Unify the index across Community + Event + Resource + (future) Organization.** Reuse the existing
   `searchAll` shape; add resources; introduce a single result type with `entityType`.
4. **Blend ranking** = text relevance × entity quality (`trustScore`/`isEssential`/recency) × distance.
   You already compute trust/activity/completeness scores — use them in ranking.
5. **Keep it Postgres FTS for now.** Do _not_ jump to a vector DB or external search engine yet
   (see §6). FTS + faceting covers the near-term need at a fraction of the complexity.

---

## 4. User Retention Analysis (Phase 3)

The blunt question: _why would a user open IndLokal a second time?_ Today there is no engineered answer.

### 4.1 Feed

- Not dynamic (5-min cache of the same blocks). Creates no habit. Content is whatever the pipeline +
  organizers produced; it can change daily in top metros but is invisible to the user unless they
  re-open and notice. **Risk:** in low-supply cities the past-events block signals decay.
- **To create habit, the feed must (a) order by recency, (b) show "new since last visit", and (c) be
  delivered (push/email), not just available.**

### 4.2 Events

- **Realistic supply by tier (single-diaspora reality):**
  - Top metros (Berlin, Munich, Frankfurt): plausibly multiple relevant events/week.
  - Strong secondary (Stuttgart, Hamburg, Düsseldorf): ~1–3/week, seasonal.
  - Everywhere else: a few per _month_, festival-clustered.
- **Conclusion:** events alone **cannot** drive recurring (weekly) usage outside the top 3–4 cities.
  Betting retention on events is betting on a supply curve you don't control. Events are a _spike_
  driver (festivals), not a _baseline_ driver.

### 4.3 Communities

- Revisit frequency is **low by design**: the core value (the access link) is consumed once. Communities
  are excellent **trust infrastructure** and a **supply anchor**, but they are not, by themselves, a
  retention engine. Treat them as the graph's backbone, not the daily hook.

### 4.4 Resources

- **Acquisition engine: yes** (high-intent evergreen search — "anmeldung", "blocked account", "CGI
  appointment"). **SEO engine: yes** (best evergreen asset). **Retention engine: weak** — resources are
  consulted at life-stage transitions, not weekly. The differences:
  - _Acquisition_: brings new users via Google.
  - _SEO_: compounds domain authority that lifts the whole site.
  - _Retention_: needs a recurring reason to return — resources only retain if tied to lifecycle
    nudges ("you registered 60 days ago — here's what's next").

### 4.5 The missing loop (most important finding)

The schema already has `NotificationOutbox`, `NotificationPreference`, `QuietHours`, `InboxItem`,
`Device`/`expoPushToken`, and topics (`CITY_NEW_EVENT`, `WEEKLY_DIGEST`, `SAVED_EVENT_REMINDER`, …).
Repo memory confirms the outbox has **zero producer callers** — the retention machinery is built and
**switched off**. The highest-ROI retention work is not new infrastructure; it's **wiring a weekly
per-city digest + saved-event reminders into the outbox that already exists.**

---

## 5. Strategic Positioning Review (Phase 4)

Challenge each framing:

1. **Primarily a community platform?** No — communities are the _supply backbone_ and trust layer, but
   community profiles don't retain.
2. **Primarily an events platform?** No — event supply is too thin per city to be the spine outside top metros.
3. **Primarily a resources platform?** No — resources acquire and rank but don't retain weekly.
4. **Primarily a discovery platform?** Closest, but "discovery" undersells it and implies a one-shot lookup.

**Recommended positioning:**

> **IndLokal is the trusted, searchable graph of Indian life in Germany — the place where need meets
> location.** Communities = backbone (trust + supply). Resources = front door (acquisition + SEO).
> Events = pulse (spikes + delivered habit). Search = the product.

This is a **"need → location" discovery graph**, not four verticals. It is the credible on-ramp to the
"OS for India–Europe relationships" vision **without** building any marketplace prematurely.

---

## 6. Ecosystem Database Strategy (Phase 5)

**Verdict: yes — evolve toward "the definitive India-in-Germany ecosystem database," but as a typed
graph, not a marketplace.** The current model already has the bones: `Community`, `Event`, `Resource`,
`RelationshipEdge`, `AccessChannel`, `Category` (CATEGORY/PERSONA), `OutreachLead`, scoring + trust signals.

What the model is **missing** as an ecosystem graph, and when to add it:

| Concept                     | Today                                                                                             | Recommendation                                                                                                                                                                | When                    |
| --------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **Organization type**       | `Community` is overloaded (covers groups, associations, consulates-as-resources, businesses-as-?) | Add an `entityKind`/`organizationType` (ASSOCIATION, STUDENT_GROUP, TEMPLE, CULTURAL_ORG, INSTITUTIONAL, BUSINESS-later) on Community **without** building a business product | **Now** (taxonomy only) |
| **Audience tags**           | `personaSegments` + `ResourceAudience` exist but are **separate vocabularies**                    | Unify persona/audience taxonomy across Community/Event/Resource in `@indlokal/shared`                                                                                         | **Now**                 |
| **Culture/language tags**   | `languages[]` on Community/User                                                                   | Promote to first-class facet usable in search + filtering; add region-of-origin (Telugu/Tamil/Punjabi…) consistently                                                          | **Now**                 |
| **Trust indicators**        | `trustScore`, `TrustSignal`, `claimState`                                                         | Add **public-facing** trust badges + explanations; add trust _decay_ and inverse signals                                                                                      | **90d**                 |
| **Relationship types**      | `RelationshipEdge` (RELATED/SISTER/CO_HOSTED/PARENT_CHILD/SAME_ORGANIZER)                         | Already strong — start _populating_ it (currently mostly empty); surface "related communities"                                                                                | **90d**                 |
| **Sponsor readiness**       | none                                                                                              | Defer — but a boolean/enum on Community (`partnershipReadiness`) is cheap to add when partnerships start                                                                      | **Defer**               |
| **Collaboration readiness** | none                                                                                              | Defer until co-hosting demand is observed (RelationshipEdge.CO_HOSTED is the seed)                                                                                            | **Defer**               |
| **Geo**                     | lat/long on City/Event                                                                            | Add community geo + distance ranking for "near me"                                                                                                                            | **90d**                 |

**Add now:** organization type, unified audience/persona taxonomy, first-class language/origin facet.
These are taxonomy changes that unlock unified search and cost little.
**Defer:** sponsor/collaboration readiness, any marketplace-adjacent fields — add the column the day a
real partnership/co-host workflow exists, not before.

---

## 7. AI Strategy (Phase 6)

**Principle: AI is already correctly used for _supply_ (the discovery pipeline). It is NOT required for
_demand-side_ search yet.**

### 7.1 Traditional search — sufficient for the near term

Almost every current user need is solvable with **keyword FTS + facets + taxonomy + blended ranking**:
"Telugu communities in Munich", "free Diwali events near me", "how to register address in Stuttgart".
You already have FTS and the facets (persona, language, category, audience, stage, scope). The win is
_unifying and ranking_, not adding ML.

### 7.2 Semantic search — add value later, narrowly

Useful where vocabulary mismatches keywords: "places to meet other Indian moms", "startup networking"
→ matching across descriptions/categories. Worth it **only after** (a) unified FTS ships and (b) you
have query logs showing zero-result/low-CTR searches. Then add embeddings as a _re-ranker_ over FTS
candidates, not a wholesale replacement.

### 7.3 AI Concierge — compelling, but gate on data readiness

"I'm a Telugu family moving to Munich" / "I'm a student in Stuttgart" / "startup networking in Frankfurt"
is the natural expression of the **need→location** thesis and a strong differentiator.

- **Value:** high — collapses the whole graph into one answer; perfect for the diaspora newcomer moment.
- **Complexity:** moderate if implemented as **retrieval over the existing graph** (RAG over communities/
  events/resources) rather than a freeform chatbot.
- **Data readiness:** the gating factor. It only works once (a) taxonomy is unified, (b) resources +
  communities + events are in one index, and (c) coverage per city is non-embarrassing. **Sequence it
  after unified search + taxonomy (i.e., a 12-month item), and pilot it as a "guided newcomer"
  experience in the top 3 metros first.**

---

## 8. Gap Analysis Matrix (Phase 7)

Effort: S/M/L. Impact: ★–★★★. Priority: P0 (now) / P1 (90d) / P2 (12mo).

| Area                | Current State                                   | Target State                                                                | Gap                                                        | Priority | Effort | Business Impact                                           |
| ------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- | -------- | ------ | --------------------------------------------------------- |
| **Search**          | City-scoped, communities+events only, text-rank | Global, need-first, all entity types, blended ranking, city as filter       | No global index; resources/orgs excluded; no quality boost | **P0**   | M      | ★★★ Aligns product to real intent; lifts conversion + SEO |
| **Feed**            | Static 5-min cache, same for everyone           | Recency-ordered, "new since last visit", personalized by persona/saved      | No personalization, no delivery                            | **P1**   | M      | ★★★ Core habit loop                                       |
| **Events**          | Dual-lane, AI-fed, save-only                    | RSVP + reminders + calendar export + "near saved community"                 | No RSVP/reminder; supply thin in non-metros                | **P1**   | M      | ★★ Spike retention, not baseline                          |
| **Communities**     | Rich model, one-shot value                      | Follow/subscribe + "what changed" + public trust badges                     | No reason to return; trust not explained publicly          | **P1**   | M      | ★★ Trust + soft retention                                 |
| **Resources**       | Strong resolver, side tab                       | Front-door newcomer packs by persona+stage; searchable; cross-linked        | Not in search; not on home; no lifecycle nudges            | **P0**   | S      | ★★★ Acquisition + SEO compounding                         |
| **Organizer**       | Profile/events/collab, no analytics             | Per-community + per-event analytics dashboard                               | Zero analytics surfaced (data exists)                      | **P0**   | S–M    | ★★★ #1 organizer-retention hook                           |
| **Admin**           | 9 manual queues, RBAC, audit                    | Dedup suggestions, confidence auto-approve, bulk actions, persisted reasons | All manual; merge fully manual; reasons dropped            | **P1**   | M      | ★★★ Removes scaling ceiling                               |
| **Trust**           | Scores + signals, internal only                 | Public badges + explanations + decay + inverse signals                      | Not user-visible; no decay; no abuse signal                | **P1**   | S–M    | ★★ Marketplace-grade trust                                |
| **Taxonomy**        | Persona/audience/language split across models   | Unified shared taxonomy + organizationType + origin facet                   | Vocabulary drift; community overloaded                     | **P0**   | S      | ★★★ Unlocks unified search + concierge                    |
| **Analytics**       | `UserInteraction` captured, PostHog events      | Search-query logs, zero-result tracking, organizer-facing metrics           | No query logging; no search funnel; not surfaced           | **P0**   | S      | ★★ Powers everything downstream                           |
| **SEO**             | Per-city + intent landings, anti-doorway stance | Resource hub + national "this week" + internal cross-linking                | Resources under-leveraged; national intent → brochure      | **P1**   | S–M    | ★★ Top-of-funnel growth                                   |
| **Retention infra** | Outbox/inbox/push tables exist, **0 producers** | Weekly per-city digest + saved-event reminders live                         | Loop built but switched off                                | **P0**   | M      | ★★★ The return reason                                     |

---

## 9. Prioritized Roadmap (Phase 8)

Ruthless. Do **not** build everything. Each horizon has a single theme.

### Next 30 days — "Make discovery match intent, and give people a reason to return"

1. **Unified, global, need-first search (P0).** Add resources to `searchAll`; make `citySlug` optional
   (default to user city, allow "all Germany"); add a single result type with `entityType`; blend
   `ts_rank` with `trustScore`/`isEssential`/recency. Put one search box on the home page and a
   persistent top bar.
2. **Wire the weekly per-city digest + saved-event reminders into the existing outbox (P0).** This is
   the highest-ROI retention work and is mostly _activation_, not new infra.
3. **Organizer analytics v1 (P0).** Surface the `UserInteraction` data you already collect
   (views, access-clicks, saves) on the organizer/host dashboards. Cheap, high organizer-retention.
4. **Unify taxonomy in `@indlokal/shared` + add `organizationType` (P0, taxonomy only).** No new product —
   just the vocabulary that unblocks everything after.
5. **Log search queries + zero-result rate (P0).** You cannot improve search you don't measure.

### Next 90 days — "Turn the graph into a habit and remove the ops ceiling"

1. **Personalized, recency-ordered feed with "new since last visit" (P1).**
2. **Events: RSVP + reminders + calendar export + "events at communities you follow" (P1).**
3. **Community follow/subscribe + "what changed" + public trust badges (P1).**
4. **Resources as front door:** newcomer packs by persona+stage, resource search, resource→community/
   event cross-links, lifecycle nudges (P1).
5. **Admin assist:** duplicate-suggestion list for merge, confidence-based auto-approve with a tunable
   threshold + bulk actions + persisted rejection reasons (P1).
6. **Populate `RelationshipEdge`** and surface "related communities" (P1).

### Next 12 months — "From directory to ecosystem graph (and selectively, AI concierge)"

1. **Geo + distance ranking** ("near me" across cities; city becomes a soft filter everywhere).
2. **Semantic re-ranker** over FTS candidates for low-CTR/zero-result queries (only after query logs justify it).
3. **AI "guided newcomer" concierge** (RAG over the unified graph) piloted in top-3 metros once coverage
   and taxonomy are ready — the natural payoff of the need→location thesis.
4. **Organization graph maturation** (typed entities, sponsor/collaboration-readiness fields added _only_
   when real partnership/co-host workflows exist).
5. **Trust maturation:** decay, inverse/abuse signals, verification tiers.

**Explicitly deferred (do not build):** business marketplace, opportunity/investor platform,
classifieds, rentals, generic social network. The ecosystem-graph path reaches the long-term vision
without any of them.

---

## 10. Deliverables Index

1. **Product Audit** — §1, §2
2. **UX Audit** — §1 (per-surface strengths/weaknesses), §2
3. **Search Audit** — §1.6, §3
4. **Retention Analysis** — §4
5. **Strategic Positioning Review** — §5
6. **Ecosystem Data Strategy** — §6
7. **Gap Analysis Matrix** — §8
8. **Prioritized Roadmap** — §9

---

## 11. Top 5 things to disagree-and-commit on

1. **Stop calling it a "Feed" until it's delivered and personalized.** Today it's a static city overview.
2. **Search, not verticals, is the product.** Reorganize IA around one need-first box; city becomes a filter.
3. **Resources are the acquisition engine, not a side tab** — promote them and put them in search.
4. **Retention already exists in the schema and is switched off** — turn on the digest before building anything new.
5. **Operations will break before features do** — invest in dedup/auto-approve/bulk _now_, not after the flood.
