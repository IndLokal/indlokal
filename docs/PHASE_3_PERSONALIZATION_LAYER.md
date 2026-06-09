# IndLokal — Phase 3: Personalization Layer (Product Document)

**Status: Designed / Not yet built.** This is the forward-looking product document for Phase 3 of the [IndLokal product strategy](PRODUCT_DOCUMENT.md). Where the [Phase 1 document](PHASE_1_DISCOVERY_FOUNDATION.md) describes what was _built_ and the [Phase 2 document](PHASE_2_JOURNEY_LAYER.md) describes the journey spine, this describes what we _intend to build next_ — and, critically, _why personalization is only safe and valuable once journeys and a verified corpus exist_.

> **The one-sentence thesis:** Phase 3 turns IndLokal from a product that everyone navigates the same way into one that is **repeatedly relevant to the individual** — journey-aware ranking, real "recommended for you," and a **constrained, retrieval-grounded Journey Concierge that composes over verified data and never invents** — built on the journey spine and behavioral signals Phase 2 produces, without ever weakening the human trust gate.

> **This is a strategy/PRD-precursor document, not an implementation spec.** Concrete capabilities will be specified as PRD/TDD pairs (and an ADR for the personalization-and-grounding model) under [docs/specs/](specs/README.md) when Phase 3 is picked up; none exist yet (the roadmap index lists Phase 3 specs as _none yet_). This document defines the product intent, scope, gates, sequencing, and the hard AI guardrails those specs must honor.

---

## Table of Contents

1. [Why Phase 3, and Why Only After Phase 2](#1-why-phase-3-and-why-only-after-phase-2)
2. [What Personalization Is (Precise Definition)](#2-what-personalization-is-precise-definition)
3. [The Foundation Already in Place](#3-the-foundation-already-in-place)
4. [Scope: In / Out](#4-scope-in--out)
5. [The Four Personalization Capabilities](#5-the-four-personalization-capabilities)
6. [The Personalization Model](#6-the-personalization-model)
7. [The Journey Concierge (Constrained, Retrieval-Grounded)](#7-the-journey-concierge-constrained-retrieval-grounded)
8. [User Experience & Surfaces](#8-user-experience--surfaces)
9. [Data & Schema Plan](#9-data--schema-plan)
10. [Signals & Personalization Operations](#10-signals--personalization-operations)
11. [Deterministic-First vs Machine-Learned](#11-deterministic-first-vs-machine-learned)
12. [Privacy, Consent & GDPR](#12-privacy-consent--gdpr)
13. [Trust & Safety Guardrails](#13-trust--safety-guardrails)
14. [Success Metrics](#14-success-metrics)
15. [Sequenced Build Plan](#15-sequenced-build-plan)
16. [Risks & Mitigations](#16-risks--mitigations)
17. [Explicitly Out of Scope (Deferred to Phase 4+)](#17-explicitly-out-of-scope-deferred-to-phase-4)
18. [Exit Criteria → Phase 4](#18-exit-criteria--phase-4)

---

## 1. Why Phase 3, and Why Only After Phase 2

Phase 1 made the city legible. Phase 2 made transitions navigable by composing journeys over existing data. But both are **the same for everyone**: every user who selects "Young Family in Stuttgart" gets the same composed journey, ranked the same way, with no memory of who they are or what they have already done. The platform collects rich individual signals — `personaSegments`, `preferredLanguages`, saved items, journey progressions, search history — and **does nothing with them**. Phase 3 closes that loop.

The user reality Phase 3 answers:

> _"Show me things relevant to **me** — I already told you I'm a family in Stuttgart; stop making me re-filter."_
> _"I came back a week later — remember where I was in my move."_
> _"I have one specific question. Don't make me read five pages; just answer it from something I can trust."_

**Why only after Phase 2 (the sequencing is non-negotiable):**

1. **Personalization needs something to personalize.** Reranking is meaningless without the journey spine and a dense, structured corpus to rank. Phase 2 produces both. Shipping personalization first would rerank a content-type directory — noise on noise.
2. **The concierge needs a verified corpus to ground on.** A retrieval-grounded assistant is only better than a generic LLM if the corpus it retrieves from is dense, verified, and current. That density is exactly the Phase-2 exit criterion (PHASE_2 §18.3). Ship a concierge before the corpus is dense and it is thin and hallucination-prone — the single credibility risk the strategy forbids (strategy §10.3).
3. **Personalization needs behavioral density.** Journey-aware ranking learns from _what users in each persona × stage actually do_. That signal only accumulates once journeys are live and used (Phase 2). Before that, there is nothing to learn from.
4. **It compounds upward.** Personalized journeys deepen engagement that feeds Ecosystem demand-sensing (Phase 4), Business/Connect demand signals (Phase 5/6), and the journey-completion benchmarks that become Intelligence (Phase 7).

---

## 2. What Personalization Is (Precise Definition)

**Personalization** is the layer that makes discovery and journeys adapt to the individual, using signals the platform already holds, while keeping the human trust gate and the verified corpus as the only source of truth.

```
Personalization = g(user signals, journey spine, verified corpus)
                → re-ranked discovery + recommendations + grounded answers,
                  each explainable and each ending in a verified action
```

**Personalization IS:**

- **Journey-aware ranking** — reorder discovery and journey components by the user's stored persona, language, city, and behavior.
- **Real recommendations** — "recommended for you" that reflects the individual, not just city-wide trending.
- **A constrained concierge** — answers _only_ from verified platform data, cites its sources, and hands off to real communities/resources/officials.
- **Explainable** — the user can see _why_ something was surfaced ("because you're a family in Stuttgart," "because you saved a similar event").
- **Inference, not interrogation** — it predicts relevance from existing signals; it does not add friction or demand more forms.

**Personalization is NOT:**

- **A source of truth.** It composes and ranks over verified data; it never publishes unverified facts (strategy §10.1).
- **An open-web chatbot.** The concierge never answers from the open internet; if it doesn't know from the corpus, it says so and points to a human/official source (strategy §10.2 — _NEVER_).
- **Engagement maximization.** No infinite feed, no dark patterns, no time-on-site optimization. We remain a gateway, not a destination (strategy §5.2).
- **A replacement for the trust gate.** High-confidence signals may _pre-fill_ or _rank_; humans still own publish (L0, unchanged).
- **Surveillance.** Signals are consented, minimal, purpose-bound, and user-inspectable (§12).

---

## 3. The Foundation Already in Place

As with Phase 2, the central point is that the primitives largely **already exist** — Phase 3 is mostly activation of collected-but-unused signals plus a constrained retrieval layer, not new data capture.

### 3.1 Signals already collected (and currently unused for personalization)

| Signal               | Backing field / system (shipped)                         | Today's use                           | Phase-3 use                                          |
| -------------------- | -------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------- |
| Declared persona     | `User.personaSegments[]`                                 | Stored; journey selector prefill (P2) | Rank + recommend + prefill concierge context         |
| Preferred languages  | `User.preferredLanguages[]`                              | Stored                                | Rank language-matched communities/events; UI locale  |
| Saved items          | Saved-items rails (events/communities/journeys)          | Bookmarks list                        | Collaborative + content signal for recommendations   |
| Journey progressions | Journey analytics (PHASE_2 §14)                          | Aggregate metric                      | Per-user stage state → "continue where you left off" |
| Search history       | `UserInteraction(SEARCH)` query telemetry (PRD/TDD-0048) | Zero-result/gap analytics             | Intent signal for ranking + recommendations          |
| Behavioral events    | Analytics event catalog + `UserInteraction`              | Funnel analytics                      | Recency/affinity signals for ranking                 |
| City affinity        | Visited-city history                                     | Implicit                              | Home-city + secondary-city personalization           |

### 3.2 The corpus the concierge grounds on (already verified)

The L0 trust layer — claim state, human moderation, freshness stamping, consular-jurisdiction correctness — plus the Phase-2 journey composition output, **is** the retrieval corpus. The concierge does not need a new knowledge base; it retrieves over the verified entities the platform already maintains. This is the entire reason the concierge can be trustworthy where a generic LLM cannot.

### 3.3 Rails already in place

- **Notification rails** — outbox producers, weekly digest, saved-event reminders, INBOX channel (PRD/TDD-0049) — exist and can be _targeted_ by personalization without building new transport.
- **Search ranking** — blended trust/activity/recency ranking in `modules/search` (PRD/TDD-0048) — is the seam to extend with per-user signals.
- **Journey engine** — `modules/journeys.composeJourney()` (PRD/TDD-0052) — is the seam to rerank per user.

### 3.4 What this means for cost

Because the signals, the verified corpus, the notification rails, the search-ranking seam, and the journey engine all exist, **Phase 3 adds a ranking/recommendation layer and a constrained retrieval-grounded assistant — not new data capture or a new content system.** The investment is in _composition intelligence and guardrails_, not storage.

---

## 4. Scope: In / Out

### 4.1 In scope (Phase 3)

1. **Journey-aware ranking** — rerank discovery feeds and journey blocks by the user's persona, language, city, and behavior (§5.1).
2. **Recommendations** — a real "recommended for you" surface (events, communities, journeys), deterministic-first (§5.2, §11).
3. **The Journey Concierge** — a constrained, retrieval-grounded assistant over verified data only, with citations and honest "I don't know" handoffs (§7).
4. **Personalized reminders/digests** — target the existing notification rails by saved journey, persona, and city (§5.4).
5. **"Continue your journey"** — per-user journey stage state surfaced on return (extends the Phase-2 save-a-journey + the shipped continue-chip seam).
6. **Multi-language journey/discovery UI** — German/Hindi UI locale, driven by `preferredLanguages` (the first non-English UI; matches the strategy's Phase-3 placement).
7. **Explainability + controls** — "why am I seeing this?" affordances and a personalization on/off + signal-reset control (§12).
8. **Personalization analytics** — return-with-relevance, recommendation CTR, concierge grounded-resolution rate.

### 4.2 Out of scope (Phase 3 — deferred)

- **Ecosystem-org ranking / partner-org surfaces** → Phase 4 (the ecosystem block is still empty until partner orgs/relationship edges are populated).
- **Business / Connect personalization** → Phase 5/6 (gated, strategy §12); Phase 3 personalizes consumer discovery + journeys only.
- **Open-web or generative-fact answers** → _NEVER_ (strategy §10.2). The concierge is retrieval-grounded over verified data, full stop.
- **Heavy ML / trained recommender as a prerequisite** → deterministic + explainable first; ML only when data density justifies it (§11).
- **IndLokal Plus billing** → premium personalization features (materialized playbooks, smart reminders, concierge limits) are _enabled_ by Phase 3 but priced only when value is proven (strategy §13).
- **Cross-user social signals that expose identity** → recommendations use aggregate/collaborative signals, never "people like you did X" with identifying detail.

---

## 5. The Four Personalization Capabilities

These map directly onto the strategy's Phase-3 capability list (strategy §14) and the AI sequencing (§10.2).

### 5.1 Journey-aware ranking

Rerank the Phase-1 discovery feeds and Phase-2 journey blocks using stored `personaSegments`, `preferredLanguages`, city affinity, and behavioral recency/affinity. The same Stuttgart family feed is ordered differently for a `PRE_ARRIVAL` family than a `SETTLED` one. Deterministic and explainable first (§11); inherits all trust gating (only moderated content is ever ranked).

### 5.2 Recommendations ("recommended for you")

A genuine recommendation surface — not city-wide trending relabeled. Blends content signals (persona/stage/language/category match) with collaborative signals (co-saved / co-attended, privacy-safe). Every recommendation is explainable and ends in a verified action (join / save / open). Cold-start falls back to persona-composed Phase-2 journeys, so a brand-new user still gets something good.

### 5.3 The Journey Concierge

A guided assistant that answers _only_ from verified platform data (retrieval over the L0 corpus + journey composition), cites its sources, hands off to real communities/resources/officials, and says "I don't know — here's who does" when the corpus lacks the answer. It composes; it never invents. Full design in §7. This is the highest-value and highest-risk capability, gated most strictly.

### 5.4 Personalized reminders & digests

Target the existing outbox/digest/reminder rails (PRD/TDD-0049) by a member's saved journey, persona, and city: "new family event in Stuttgart this weekend," "your First-90-Days checklist has 2 unfinished steps." No new transport; personalization chooses _what_ and _to whom_, the rails handle delivery. Strictly opt-in and frequency-capped (§12, §13).

---

## 6. The Personalization Model

### 6.1 The function

A new `modules/personalization` layer reranks and recommends over existing query layers — it does not own content or bypass the trust gate:

```
personalize({ userSignals, citySlug, persona?, surface }) → RankedView
recommend({ userSignals, citySlug, surface }) → Recommendation[]
```

It reuses, rather than replaces, the existing engines:

- **Discovery** → wrap `modules/search` blended ranking with a per-user signal boost.
- **Journeys** → rerank `composeJourney()` blocks per user (persona/stage/language/behavior).
- **Recommendations** → a new scorer over the verified corpus, content + collaborative signals.
- **Reminders** → a targeting selector feeding existing outbox producers.

### 6.2 The signal model (conceptual)

```
UserSignals {
  declared:   { personaSegments[], preferredLanguages[], homeCity }
  journey:    { activeJourney?, stageState{}, savedJourneys[] }
  behavioral: { recentViews[], saves[], searches[], cityAffinity{} }
  consent:    { personalizationEnabled, signalScopes[] }
}
```

Signals are **consented, minimal, and inspectable** (§12). If `personalizationEnabled` is false, the system degrades cleanly to the Phase-2 persona-selected, non-personalized experience — personalization is purely additive.

### 6.3 Ranking rules

1. **Trust gating is inherited and absolute** — only moderated/`PUBLISHED`/verified content is ever ranked or recommended. Personalization reorders the trustworthy set; it never widens it.
2. **Explainable by construction** — every boost carries a human-readable reason ("family + Stuttgart + you saved a similar event"). If a signal can't be explained, it isn't used.
3. **Deterministic-first** — rule-based scoring before any ML (§11); reproducible and debuggable.
4. **Diversity floor** — avoid filter-bubble collapse; guarantee a minimum of fresh/diverse items so personalization doesn't ossify into the same five results.
5. **Graceful cold-start** — no signals → fall back to Phase-2 composed journeys + city trending; never an empty or broken personalized surface.
6. **Recency-decayed behavior** — older signals fade; a transition is time-bound, so a `PRE_ARRIVAL` signal should not dominate once a user is `SETTLED`.

---

## 7. The Journey Concierge (Constrained, Retrieval-Grounded)

The concierge is the capability most likely to be either a differentiator or a credibility-destroying hallucination machine, so it gets its own section and the strictest guardrails.

### 7.1 What it is

A guided, conversational entry into journeys and discovery that answers natural-language questions ("I'm a family moving to Stuttgart in March, what do I do first?") by **retrieving over the verified corpus** (resources, communities, events, journey composition, consular data) and **composing an answer that cites every claim** and ends in verified actions.

### 7.2 The hard rules (non-negotiable, from strategy §10)

1. **Verified data only.** The retrieval set is exclusively the L0-gated corpus. No open-web retrieval, ever.
2. **Cite or stay silent.** Every factual statement links to the verified entity it came from. No uncited claims.
3. **Honest "I don't know."** If the corpus lacks the answer, the concierge says so and points to the relevant human/official source. It never fills the gap with a generation.
4. **Composes, never invents.** It assembles verified entities into an answer; it does not author new facts, events, or community details.
5. **Hands off to action.** Answers terminate in join/save/open/checklist actions and links into canonical pages — the same action-or-drop discipline as journeys.
6. **No trust-gate bypass.** The concierge can surface only what a human already approved; it has no authority to publish.

### 7.3 Why it can be trustworthy here (and not generically)

A generic LLM fabricates a plausible "Indian communities in Stuttgart" list from stale web data. The concierge retrieves from a corpus that is _claimed, verified, freshness-stamped, and jurisdiction-correct_ — and admits ignorance rather than guessing. That is the entire moat thesis (strategy §11, §18) expressed as a feature: the assistant is only as good as the verified corpus, which is exactly what competitors can't fabricate.

### 7.4 Evaluation before exposure

The concierge ships only after an eval shows it **beats a baseline LLM on grounded-resolution rate and citation correctness** on real diaspora queries (strategy §21.3 Q3). Grounded-resolution rate and citation correctness are launch gates, not post-launch metrics.

---

## 8. User Experience & Surfaces

### 8.1 Personalized discovery & journeys

- **City feed (`/[city]/`)** — the same surfaces, reordered for the signed-in user; a clearly labeled "Recommended for you" rail with "why am I seeing this?" affordances.
- **Journey pages** — Phase-2 journey blocks reranked per user; "continue where you left off" restores stage state for returning members (extends the shipped continue-chip).
- **Anonymous users** — see the Phase-2 non-personalized experience unchanged; personalization is a signed-in, consented enhancement.

### 8.2 The concierge surface

A constrained assistant entry on the journey hub and (optionally) the city feed — framed as "Ask about your move," not an open chatbot. Answers render as cited, action-ending cards that link into canonical pages. Always escapable to the normal browse/journey experience.

### 8.3 Multi-language UI

The first non-English UI locale (German/Hindi), driven by `preferredLanguages`. Content remains as-authored; the _interface_ and journey framing localize. English stays the default and fallback.

### 8.4 Member controls (first-class, not buried)

A personalization control surface in `/me/`: toggle personalization on/off, see and reset the signals in use, set language, manage reminder frequency. Controls are a feature, not fine print (§12).

---

## 9. Data & Schema Plan

**Guiding constraint (carried from Phase 2):** prefer composition over new storage. Most signals already exist; Phase 3 reads and ranks them.

### 9.1 What needs no schema change

Declared persona/language, saved items, search telemetry, behavioral events, notification rails, and the verified corpus all exist. Ranking and recommendations compose over them.

### 9.2 Possible additive changes (only if measured need)

| Candidate                                        | When                                                                  | Notes                                                                       |
| ------------------------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Per-user journey stage state (`JourneyProgress`) | Phase 3 P0, if "continue where you left off" needs server persistence | Minimal; reuse saved-items patterns first; client-state seam already exists |
| Consent / personalization-preference record      | Phase 3 P0 (privacy)                                                  | Additive; stores opt-in + signal scopes; required for GDPR posture (§12)    |
| Derived affinity/feature store                   | Phase 3 P1, only when deterministic ranking needs caching             | A read-model/cache, not a new source of truth; rebuildable from events      |
| Concierge query/answer log (with citations)      | Phase 3 P1                                                            | For eval + abuse review; privacy-scoped, retention-bounded                  |

**Anti-goal:** no profile-graph for social features, no behavioral data sales (forbidden, strategy §19), no trained-model dependency before deterministic ranking proves out, no new ingestion path. If a change isn't additive, consented, and composition-first, it belongs later or not at all.

---

## 10. Signals & Personalization Operations

Personalization is only as good — and as safe — as the signal hygiene underneath it. **The first Phase-3 task is a signal + consent audit**, not ranking code.

1. **Signal audit (P0, blocking).** Inventory every signal (declared, journey, behavioral), its provenance, its consent basis, and its retention. No signal is used for ranking until its consent basis and retention are defined.
2. **Consent + controls (P0).** Ship the opt-in, the signal-scope controls, and the reset/off switch _before_ personalization affects any surface. Personalization is off by default until consented (privacy-by-default, §12).
3. **Deterministic ranking first (P0).** Rule-based, explainable scoring as the baseline (§11). Measure lift before considering ML.
4. **Corpus-readiness check for the concierge (P0, blocking the concierge specifically).** Verify corpus density + freshness in the launch city clears the bar where grounded answers beat a baseline LLM (§7.4). The concierge does not ship in a city whose corpus is too thin.
5. **Diversity + bubble monitoring (P1).** Track diversity floors and filter-bubble drift; tune the diversity guarantee (§6.3 rule 4).
6. **Personalization-aware supply prioritization (P1).** Use recommendation gaps and concierge "I don't know" logs to direct Phase-2/4 supply work at the highest-impact missing content.

---

## 11. Deterministic-First vs Machine-Learned

**Default: deterministic.** Phase-3 ranking and recommendations begin as rule-based, explainable scoring over known signals (persona/stage/language/city/recency/affinity). This is debuggable, reproducible, trustworthy, and — at current data density — usually competitive with ML.

**Machine-learned later, selectively.** Introduce trained ranking/recommendation only once (a) behavioral density justifies it and (b) it demonstrably beats the deterministic baseline on the Phase-3 metrics _without_ sacrificing explainability. Any ML model must remain explainable enough to answer "why am I seeing this?" — opacity is disqualifying. This mirrors the Phase-1/2 discipline: ship the honest simple version first; invest in sophistication only where density and measured lift justify it.

The concierge follows the same logic: retrieval-grounded composition (deterministic retrieval + cited generation) before any fine-tuning, and never generation untethered from retrieval.

---

## 12. Privacy, Consent & GDPR

Personalization touches individual behavior, so privacy is a first-class design constraint, not an afterthought (the platform serves an EU/German user base).

1. **Off by default, opt-in.** No personalization until the user consents; anonymous and non-consenting users get the Phase-2 experience unchanged.
2. **Minimal & purpose-bound.** Only signals with a defined personalization purpose are collected/used; no speculative hoarding.
3. **Inspectable & resettable.** Users can see the signals in use, why something was surfaced, and reset or disable them — surfaced in `/me/` (§8.4).
4. **Retention-bounded.** Behavioral signals decay and have retention limits; concierge logs are retention-capped and privacy-scoped.
5. **No data sales, no ad targeting.** Hard guardrail, carried from strategy §19 — signals serve the user's own experience, never third-party monetization.
6. **GDPR posture.** Consent records, data-subject access/erasure, and lawful-basis documentation are part of the P0 consent work, not a later bolt-on.

---

## 13. Trust & Safety Guardrails

| Guardrail                           | Rule                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Trust gate is absolute**          | Personalization reorders only moderated/verified content; it never publishes or widens to un-moderated data  |
| **Concierge grounding is absolute** | Verified-corpus retrieval only; cite-or-silent; honest "I don't know"; no open-web, no invented facts        |
| **No engagement dark patterns**     | No infinite feed, no manipulative reminders, no time-on-site optimization; we stay a gateway (strategy §5.2) |
| **Explainability required**         | Every ranked/recommended item and every concierge claim is explainable/cited or it isn't shown               |
| **Reminder restraint**              | Opt-in, frequency-capped, easy-off; reminders serve the user's transition, not retention vanity              |
| **Diversity floor**                 | A minimum of fresh/diverse items guaranteed to prevent filter-bubble collapse                                |
| **Human override**                  | Ops/admin can inspect and correct personalization/concierge behavior; no un-auditable automated surface      |

---

## 14. Success Metrics

**North Star for Phase 3:** **Return-with-Relevance rate** — returning users who engage a personalized or recommended item. This proves the platform _knows the user and is useful repeatedly_, the defining promise of the personalization layer (strategy §5.3).

| Metric                                                | What it proves                                               |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| Return-with-relevance rate                            | Personalization makes the platform repeatedly useful         |
| Recommendation CTR (vs trending baseline)             | Recommendations beat city-wide trending                      |
| **Concierge grounded-resolution rate**                | The concierge answers correctly from verified data           |
| **Concierge citation-correctness rate**               | Answers are grounded, not hallucinated (a launch gate, §7.4) |
| Concierge honest-"I don't know" rate (vs fabrication) | The assistant declines rather than invents                   |
| "Continue your journey" resume rate                   | Returning users pick their transition back up                |
| Personalized reminder → action conversion             | Reminders drive real action, not noise                       |
| Personalization opt-in + retention rate               | Users trust and keep personalization on                      |
| Multi-language UI adoption                            | The first non-English locale resonates                       |

These compose with the prior layers: a return-with-relevance event is a richer discovery session (Phase 1) and often a journey progression (Phase 2); a concierge resolution typically ends in the same access-channel click Phase 1 optimizes.

---

## 15. Sequenced Build Plan

| Step                                           | Work                                                                                                                                     | Gate to next                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **0. Signal + consent audit** (P0, blocking)   | Inventory signals, provenance, consent basis, retention; define what may be used                                                         | No signal is used until consented and retention-bounded                  |
| **1. Consent + controls + ADR/PRD/TDD**        | Ship opt-in, signal controls, reset/off in `/me/`; author the personalization-and-grounding ADR + PRD/TDD pair (none exist yet)          | Privacy-by-default live; spec-first discipline (repo convention)         |
| **2. Deterministic ranking**                   | `modules/personalization` reranks discovery + journey blocks by declared + behavioral signals; explainable boosts                        | Measurable relevance lift over Phase-2 baseline, no SEO/trust regression |
| **3. Recommendations surface**                 | "Recommended for you" rail (content + collaborative, privacy-safe); cold-start → Phase-2 journeys                                        | Recommendation CTR beats trending baseline                               |
| **4. Corpus-readiness check + Concierge eval** | Verify launch-city corpus density/freshness; build retrieval-grounded concierge; eval vs baseline LLM on grounded-resolution + citations | Concierge clears the citation-correctness launch gate (§7.4)             |
| **5. Concierge launch (constrained)**          | Ship the cited, action-ending, honest-"I don't know" assistant on the journey hub                                                        | Grounded-resolution + zero trust incidents in soft launch                |
| **6. Personalized reminders/digests**          | Target existing outbox rails by saved journey/persona/city; opt-in, frequency-capped                                                     | Reminder→action conversion above floor; complaint/opt-out rate low       |
| **7. Multi-language UI**                       | German/Hindi locale driven by `preferredLanguages`; English default/fallback                                                             | Adoption + no regression for English users                               |
| **8. (Optional) ML ranking**                   | Trained ranking/recsys only if it beats deterministic on metrics _and_ stays explainable                                                 | Measured lift + explainability preserved                                 |

---

## 16. Risks & Mitigations

| Risk                                                 | Likelihood | Impact | Mitigation                                                                                                                        |
| ---------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **Concierge hallucination / wrong-but-confident**    | Medium     | High   | Verified-corpus-only retrieval, cite-or-silent, honest "I don't know"; citation-correctness is a _launch gate_, not a metric (§7) |
| **Thin corpus → concierge worse than a generic LLM** | Medium     | High   | Corpus-readiness check is a blocking pre-task; concierge ships only in cities whose corpus clears the bar (§10.4)                 |
| **Filter bubble / staleness**                        | Medium     | Medium | Diversity floor (§6.3); recency decay; bubble monitoring (§10.5)                                                                  |
| **Privacy/GDPR misstep**                             | Low        | High   | Off-by-default opt-in, minimal/purpose-bound signals, inspect/reset, retention limits, consent records as P0 (§12)                |
| **Personalizing noise (premature, pre-density)**     | Medium     | Medium | Sequencing gate — Phase 3 only after Phase-2 journey + behavioral density (Phase-2 exit criteria); deterministic-first (§11)      |
| **Engagement-optimization drift**                    | Low        | High   | Explicit no-dark-patterns guardrail (§13); North Star is return-_with-relevance_, not time-on-site                                |
| **Over-engineering (ML before it's justified)**      | Medium     | Medium | Deterministic-first; ML only on measured lift + preserved explainability (§11)                                                    |
| **Cold-start emptiness**                             | Low        | Low    | Fall back to Phase-2 composed journeys + trending; personalization is purely additive (§6.3)                                      |

---

## 17. Explicitly Out of Scope (Deferred to Phase 4+)

- **Ecosystem-org ranking & partner-org personalization** (Phase 4) — the ecosystem block stays empty until partner orgs/relationship edges are populated.
- **Business / Connect personalization & matching** (Phase 5/6) — gated (strategy §12); Phase 3 personalizes consumer discovery + journeys only.
- **Open-web or generative-fact answers** — _NEVER_ (strategy §10.2); the concierge is retrieval-grounded over verified data, permanently.
- **Behavioral data monetization / ad targeting** — forbidden guardrail (strategy §19); signals serve the user's own experience only.
- **Trained-model dependency as a prerequisite** — deterministic-first; ML is an optional, gated optimization (§11).
- **Social graph / "people like you" with identifying detail** — recommendations stay aggregate/collaborative and privacy-safe.
- **IndLokal Plus pricing** — Phase 3 _enables_ premium personalization features; they are priced only when value is proven (strategy §13).

---

## 18. Exit Criteria → Phase 4

Phase 3 is "done enough" to unlock Phase 4 (Ecosystem) when:

1. **Return-with-relevance is proven** — in ≥1 launch city, returning users engage personalized/recommended items at a rate clearly above the non-personalized baseline, with retention lift.
2. **The concierge is trustworthy** — grounded-resolution and citation-correctness clear their launch gates with zero trust incidents; it reliably says "I don't know" rather than fabricating.
3. **Privacy posture is solid** — consent, controls, retention, and GDPR data-subject flows are live and audited; opt-in retention is healthy.
4. **Personalization is additive, not disruptive** — Phase-1 discovery North Star, Phase-2 journey progression, and SEO health are stable or improved; anonymous UX is unchanged.
5. **Behavioral + journey signal density** is rich enough that ecosystem demand-sensing (which partner orgs / sponsors to pursue, in which journeys) can be driven by real personalization/journey data rather than guesswork.

Meeting these means the platform now _knows its users_ and produces trustworthy, personalized navigation — the substrate of engaged demand that the Ecosystem layer (Phase 4) needs to activate partner orgs, relationship edges, and sponsor matching.

---

_This document defines Phase 3 intent. For the company-level thesis, the moat hierarchy, the AI line (the source-of-truth and concierge guardrails this phase must honor), the Business/Connect decision gates, and the full 7-phase roadmap, see the [IndLokal Product Strategy & Product Document](PRODUCT_DOCUMENT.md). For the journey spine Phase 3 personalizes, see [Phase 2 — Journey Layer](PHASE_2_JOURNEY_LAYER.md); for the shipped foundation beneath it, see [Phase 1 — Discovery Foundation](PHASE_1_DISCOVERY_FOUNDATION.md)._
