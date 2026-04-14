# LocalPulse — Solution Architecture & Implementation Plan

**Activity-Led Community Discovery Platform for the Indian Diaspora in Germany**

_Architecture Planning Document — April 2026_

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Framing](#2-problem-framing)
3. [Product Model & Domain Relationships](#3-product-model--domain-relationships)
4. [Recommended Architecture Approach](#4-recommended-architecture-approach)
5. [Core Architectural Layers](#5-core-architectural-layers)
6. [Domain Model Design](#6-domain-model-design)
7. [Data Strategy](#7-data-strategy)
8. [Search & Discovery Strategy](#8-search--discovery-strategy)
9. [Trust & Relevance Strategy](#9-trust--relevance-strategy)
10. [Ingestion & Supply Strategy](#10-ingestion--supply-strategy)
11. [MVP Architecture vs Long-Term Architecture](#11-mvp-architecture-vs-long-term-architecture)
12. [Non-Goals](#12-non-goals)
13. [Risks & Failure Modes](#13-risks--failure-modes)
14. [Phased Implementation Architecture Plan](#14-phased-implementation-architecture-plan)

---

## 1. Executive Summary

LocalPulse is an **activity-led community discovery platform** for the Indian diaspora in Germany. The user-facing product answers: _"What's happening for Indians in my city this week?"_ The internal architecture builds a **trusted community graph** — a structured, scored, and evolving map of communities, events, relationships, activity, and relevance.

### Key architectural decisions

| Decision                               | Rationale                                                                                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Activity-led, not directory-led**    | Retention comes from time-sensitive, fresh content — not static listings                                                                                   |
| **Monolith-first, modular-internal**   | Ship fast, avoid distributed-system overhead; separate concerns at the module/domain boundary                                                              |
| **City-first data model**              | Hyperlocal density is the prerequisite for product-market fit; architecture must make city the primary partition                                           |
| **Metro-region aware**                 | Stuttgart metro includes satellite cities (Böblingen, Sindelfingen, Ludwigsburg, Esslingen, Göppingen); events in satellites must appear in main city feed |
| **Graph-ready relational core**        | Start with PostgreSQL + structured relational schema; design edges and scores as first-class entities so graph queries are natural when needed             |
| **External community assumption**      | Communities live on WhatsApp/Telegram/etc; LocalPulse is the discovery, access, and trust layer — not the engagement layer                                 |
| **Ingestion as a first-class concern** | Supply is the hardest problem; the architecture must treat content acquisition as a core system capability, not an afterthought                            |

### The long-term moat

The community graph — structured relationships between communities, events, cities, categories, personas, activity signals, and trust scores — becomes the defensible asset. No competitor will trivially replicate a curated, scored, city-dense graph of diaspora community life.

---

## 2. Problem Framing

### The problem in technical-product terms

Indian diaspora community life in Germany is **information-fragmented**. Communities, events, and groups exist across dozens of siloed platforms (WhatsApp groups, Telegram channels, Facebook groups, Meetup, Eventbrite, local association websites, word-of-mouth). There is:

- **No unified discovery surface** — a newcomer to Munich cannot answer "what Indian communities exist here?" without deep network access
- **No activity signal layer** — there is no way to know which communities are active vs dormant without being inside them
- **No structural metadata** — communities lack categorization, freshness indicators, access information, or quality signals
- **No temporal content aggregation** — events are scattered, duplicate, unranked, and hard to find unless you are already in the right group
- **No trust or relevance scoring** — all communities appear equal; there is no way to distinguish active, well-run communities from abandoned ones

### Why activity-led, not directory-led

A directory is a **static list**. Static lists:

- decay immediately (communities become inactive, events pass)
- offer no reason to return
- provide no signal about quality or relevance
- do not differentiate from a spreadsheet

An activity-led design:

- surfaces **time-sensitive, fresh content** (events, new activity, trending communities)
- creates a **natural return cadence** ("What's happening this week?")
- generates **implicit quality signals** (active communities rank higher)
- enables **temporal personalization** (relevance changes over time)
- produces **behavioral data** that feeds the graph

Architecturally, this means the system must treat **events and activity signals as first-class, time-indexed entities** — not as optional metadata on a community listing.

---

## 3. Product Model & Domain Relationships

### Major product domains

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DISCOVERY SURFACE                            │
│  (City Feed · Event Calendar · Community Explorer · Search)         │
└──────────┬──────────┬──────────────┬──────────────┬─────────────────┘
           │          │              │              │
     ┌─────▼──┐  ┌───▼────┐  ┌─────▼─────┐  ┌────▼──────┐
     │ Events │  │Communities│ │ Locations │  │ Categories│
     └───┬────┘  └────┬─────┘ └─────┬─────┘  └─────┬─────┘
         │            │             │               │
         └────────┬───┴─────────┬───┘               │
                  │             │                    │
           ┌──────▼──────┐  ┌──▼──────────┐  ┌─────▼──────┐
           │Access Paths  │  │Activity     │  │ Persona    │
           │(join links,  │  │Signals      │  │ Segments   │
           │ invite info) │  │(freshness,  │  │(student,   │
           └──────────────┘  │ engagement) │  │ family,    │
                             └──────┬──────┘  │ pro, etc.) │
                                    │         └────────────┘
                              ┌─────▼──────┐
                              │Trust &      │
                              │Relevance    │
                              │Scoring      │
                              └─────┬──────┘
                                    │
                              ┌─────▼──────┐
                              │ COMMUNITY   │
                              │ GRAPH       │
                              └────────────┘
```

### Domain relationships (conceptual)

| Relationship                 | Meaning                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| Community → City             | A community operates in one or more cities                           |
| Community → Category         | A community has one or more category/persona tags                    |
| Community → Access Channel   | A community is reachable via WhatsApp link, Telegram, website, etc.  |
| Event → Community            | An event is hosted by or associated with a community                 |
| Event → City                 | An event has a location (city, venue)                                |
| Event → Category             | An event has type tags (cultural, networking, religious, etc.)       |
| Community → Activity Signals | Freshness, event frequency, member growth, etc.                      |
| Community → Trust Signals    | Verification, admin claims, user reports, editorial review           |
| User → City                  | A user has a primary city                                            |
| User → Interaction Signal    | Views, saves, clicks, joins                                          |
| Community ↔ Community        | Related communities (same city, same category, shared members later) |

These relationships form the **community graph**. The architecture must model them as structured, queryable edges — not as denormalized blobs.

---

## 4. Recommended Architecture Approach

### Monolith-first, modular-internal

**Recommendation: Start as a modular monolith.** Deploy as a single application with clearly separated internal modules aligned to product domains.

**Why not microservices:**

- Team is small; distributed system overhead is unjustified
- Latency and complexity of inter-service communication is unnecessary at this scale
- Schema evolution is easier in a single database
- Deployment simplicity matters more than service isolation right now

**Why modular-internal separation matters:**

- When you need to extract a service later (e.g., search, ingestion, scoring), the boundaries are already clean
- Different modules have different change velocities (events change fast, community metadata changes slowly)
- Testability and reasoning about the system improves with clear module boundaries

### Key architectural boundaries (modules)

```
┌──────────────────────────────────────────────────────────────┐
│                      API / Presentation                       │
│  (REST API · Server-rendered pages or SPA · Public API)       │
├──────────────────────────────────────────────────────────────┤
│                      Application Layer                        │
│  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐ │
│  │ Discovery   │ │ Community│ │ Event    │ │ Ingestion     │ │
│  │ Module      │ │ Module   │ │ Module   │ │ Module        │ │
│  └────────────┘ └──────────┘ └──────────┘ └───────────────┘ │
│  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐ │
│  │ Search     │ │ Scoring  │ │ User     │ │ Admin /       │ │
│  │ Module     │ │ Module   │ │ Module   │ │ Curation      │ │
│  └────────────┘ └──────────┘ └──────────┘ └───────────────┘ │
├──────────────────────────────────────────────────────────────┤
│                      Data Layer                               │
│  PostgreSQL (primary) · Search index (later) · Cache (later)  │
└──────────────────────────────────────────────────────────────┘
```

### What should be separated conceptually even if implemented simply

| Concern                 | Why separate conceptually                                  | MVP implementation                                                                      |
| ----------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Search/Discovery**    | Will need its own index, ranking logic, and query language | SQL queries with full-text search initially; extract to Elasticsearch/Meilisearch later |
| **Scoring/Relevance**   | Changes independently; will become complex                 | Simple computed columns or materialized scores; separate scoring module internally      |
| **Ingestion**           | Has its own lifecycle (cron, import, admin tools)          | Admin-only scripts/endpoints; grows into a pipeline                                     |
| **Graph queries**       | Relationship traversal will need specialized tooling       | SQL joins initially; graph database or graph query layer later                          |
| **Analytics/Telemetry** | Must not couple to product logic                           | Event emission to a simple log/table; later to analytics pipeline                       |

---

## 5. Core Architectural Layers

### 5.1 Presentation Layer

**Purpose:** Deliver the discovery experience to end users and provide admin/curation interfaces.

**Components:**

- **Public web application** — responsive, mobile-first; the primary discovery surface
- **Programmatic SEO pages** — auto-generated pages for long-tail queries: `/stuttgart/telugu-communities/`, `/stuttgart/indian-events-this-week/`, `/stuttgart/consular-services/`. Each page is a filtered view backed by real data, not thin content.
- **Admin/curation dashboard** — for seeding, editing, verifying communities and events
- **Public API** — for later integrations or potential mobile app

**Key design decisions:**

- Server-side rendering (SSR) or static generation for SEO — events and communities must be indexable by Google
- City as the top-level navigation primitive
- Activity feed as the default landing experience (not a search box, not a directory listing)

**Technology guidance:** Next.js (SSR, SEO, React ecosystem) or equivalent. Choose for SEO capability and speed of development.

### 5.2 Application / Service Layer

**Purpose:** Business logic, orchestration, and domain enforcement.

**Modules:**

| Module             | Responsibility                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Discovery**      | Powers the feed, city view, "this week" view; applies filtering, ranking, and personalization. Includes sparse-content resilience: if "this week" has <3 items, auto-expands to "this month"; mixes content types (events + communities) to avoid empty sections; shows "recently happened" past events to prove city activity |
| **Community**      | CRUD and lifecycle for community entities; ownership, claims, verification state                                                                                                                                                                                                                                               |
| **Event**          | CRUD and lifecycle for events; temporal logic (upcoming, past, recurring); deduplication                                                                                                                                                                                                                                       |
| **Search**         | Full-text and faceted search across communities and events                                                                                                                                                                                                                                                                     |
| **Scoring**        | Computes activity scores, freshness signals, trust indicators; runs periodically or on write                                                                                                                                                                                                                                   |
| **Ingestion**      | Handles content import from external sources, admin seeding, community submissions                                                                                                                                                                                                                                             |
| **User**           | Authentication, preferences, saved items, city selection                                                                                                                                                                                                                                                                       |
| **Admin/Curation** | Editorial tools, content moderation, claim review                                                                                                                                                                                                                                                                              |

### 5.3 Data / Storage Layer

**Purpose:** Persistent storage for all product entities, relationships, and signals.

**Primary store:** PostgreSQL

- Rich relational model fits the domain (entities + relationships + temporal data)
- JSONB columns for semi-structured metadata (flexible attributes that vary by community type)
- Full-text search built-in for MVP (tsvector/tsquery)
- PostGIS for geo-aware queries if needed later
- Materialized views for computed scores and rankings

**Why PostgreSQL over a document store:**

- The domain is inherently relational (community → events → cities → categories)
- Consistency matters for trust signals and scoring
- Graph-like queries (e.g., "communities related to this one") can be served by recursive CTEs and join queries until graph-specific tooling is justified

**Future additions (not MVP):**

- **Search index** (Meilisearch or Elasticsearch) for fast, typo-tolerant, faceted search
- **Redis** for caching hot queries (city feeds, trending communities)
- **Graph layer** (Neo4j or Apache AGE on Postgres) when relationship traversal becomes a primary query pattern

### 5.4 Search / Discovery Layer

**Purpose:** Power all user-facing discovery experiences — feeds, search, browse, filtering, ranking.

**Key responsibilities:**

- City-scoped queries ("events in Berlin this week")
- Full-text search ("Telugu community Munich")
- Category/persona filtering ("student groups in Frankfurt")
- Ranking by freshness, activity, and relevance
- Trending signals ("most active this month")

**MVP implementation:** PostgreSQL full-text search + application-layer ranking logic.

**Evolution:** Dedicated search index with custom scoring, personalization signals, and faceted navigation.

### 5.5 Ingestion / Content Acquisition Layer

**Purpose:** Get content into the system. This is the supply-side engine.

**Why it's a first-class layer:**

Supply is the existential risk. If the platform has 5 communities and 2 events, no user will return. The architecture must treat ingestion as a core system capability.

**Ingestion channels (progressive):**

1. **Admin seeding** — manual entry by the founding team (MVP)
2. **Curated import** — structured import from known sources (event platforms, community websites)
3. **Community submission** — self-service forms for community admins to list themselves
4. **Semi-automated enrichment** — scraping or API-based import from public sources (with appropriate permissions)
5. **User-contributed signals** — "suggest a community," "report stale info"

**Architectural pattern:** Ingestion pipeline with stages:

```
Source → Ingest → Normalize → Deduplicate → Enrich → Store → Index
```

Even at MVP, this pipeline is a set of admin scripts. The mental model should exist from day 1.

### 5.6 Analytics / Telemetry Layer

**Purpose:** Capture behavioral signals that feed into relevance scoring and product understanding.

**Signals to capture:**

- Page/screen views (city, community, event)
- Search queries (what users look for)
- Click-through from event to community
- "Join" or "access" clicks
- Save/bookmark actions
- Bounce rate by city and community
- Source/referral data

**MVP implementation:** Simple event logging to a database table + basic analytics (Plausible, PostHog, or similar).

**Evolution:** Event stream → analytics warehouse → scoring pipeline.

### 5.7 Trust / Relevance Scoring Layer

**Purpose:** Compute quality, freshness, and trust signals for communities and events.

**Why it's separate:**

Scoring logic changes frequently. It should not be entangled with CRUD operations. Scoring is a **read-side enrichment** — it computes derived attributes that influence ranking and display.

**Scoring dimensions (designed for, not all implemented at MVP):**

| Dimension        | What it measures                                  | MVP proxy                       |
| ---------------- | ------------------------------------------------- | ------------------------------- |
| **Freshness**    | How recently was this community/event updated?    | `last_updated_at` timestamp     |
| **Activity**     | How many events has this community had recently?  | Count of events in last 90 days |
| **Completeness** | How rich is the community profile?                | Percentage of fields filled     |
| **Trust**        | Is this community verified/claimed?               | Boolean `is_verified` flag      |
| **Engagement**   | Do users interact with this listing?              | Click count (later)             |
| **Relevance**    | How well does this match a user's city/interests? | City match + category match     |

**Architectural pattern:** Scoring runs as a periodic computation (cron job or triggered on write) that updates materialized score columns. Not real-time initially.

### 5.8 Graph / Relationship Layer

**Purpose:** Model and query the relationships between entities — the community graph.

**What makes this a "graph":**

- Community → events → cities → categories forms a multi-hop traversal
- "Communities similar to this one" requires relationship reasoning
- "What else is active in my city in my interest area" is a graph query
- Trust propagation (verified community's events are more trusted) is graph logic

**MVP implementation:** Relational edges in PostgreSQL (join tables with metadata). No separate graph database.

**Evolution path:**

1. **Phase 1:** Relational joins and CTEs for graph-like queries
2. **Phase 2:** Apache AGE extension for PostgreSQL (graph queries on the same database)
3. **Phase 3:** Dedicated graph database (Neo4j) if query complexity and scale justify it

**Key principle:** Store relationships as explicit, typed edges from day 1. Even as SQL join tables, this makes graph migration straightforward.

---

## 6. Domain Model Design

### 6.1 Entity: Community

| Attribute             | Description                                                    |
| --------------------- | -------------------------------------------------------------- |
| `id`                  | Unique identifier                                              |
| `name`                | Community name                                                 |
| `slug`                | URL-friendly identifier                                        |
| `description`         | Short description                                              |
| `description_long`    | Rich text description                                          |
| `city_id`             | Primary city (FK)                                              |
| `additional_cities`   | Multi-city communities                                         |
| `categories`          | Array of category tags                                         |
| `persona_segments`    | Target audience (student, family, professional, etc.)          |
| `languages`           | Languages used in the community                                |
| `founded_year`        | Optional                                                       |
| `member_count_approx` | Approximate (self-reported or estimated)                       |
| `status`              | active / inactive / unverified / claimed                       |
| `claim_state`         | unclaimed / claim_pending / claimed                            |
| `claimed_by_user_id`  | Who owns/manages this listing                                  |
| `logo_url`            | Community logo                                                 |
| `cover_image_url`     | Cover image                                                    |
| `metadata`            | JSONB for flexible additional attributes                       |
| `created_at`          | When first added                                               |
| `updated_at`          | Last content update                                            |
| `last_activity_at`    | Last event or update signal                                    |
| `source`              | How this was added (admin_seed, community_submitted, imported) |
| `activity_score`      | Computed score                                                 |
| `trust_score`         | Computed score                                                 |
| `completeness_score`  | Computed score                                                 |

**Why it matters:** The community is the central node. Every other entity connects to or through communities. The richness and accuracy of community data directly determines product quality.

**Graph connections:** → Events, → City, → Categories, → Access Channels, → Activity Signals, ↔ Related Communities

### 6.2 Entity: Event

| Attribute                | Description                                             |
| ------------------------ | ------------------------------------------------------- |
| `id`                     | Unique identifier                                       |
| `title`                  | Event name                                              |
| `slug`                   | URL-friendly identifier                                 |
| `description`            | Event description                                       |
| `community_id`           | Hosting community (FK, nullable for independent events) |
| `city_id`                | Event city (FK)                                         |
| `venue_name`             | Location name                                           |
| `venue_address`          | Address                                                 |
| `latitude` / `longitude` | Geo coordinates (optional)                              |
| `starts_at`              | Start datetime (with timezone)                          |
| `ends_at`                | End datetime                                            |
| `is_recurring`           | Boolean                                                 |
| `recurrence_rule`        | RRULE for recurring events                              |
| `categories`             | Event type tags                                         |
| `is_online`              | Boolean                                                 |
| `online_link`            | URL for online events                                   |
| `registration_url`       | External registration link                              |
| `cost`                   | Free / paid / unclear                                   |
| `image_url`              | Event image                                             |
| `status`                 | upcoming / ongoing / past / cancelled                   |
| `source`                 | How this was added                                      |
| `metadata`               | JSONB                                                   |
| `created_at`             | When first added                                        |
| `updated_at`             | Last update                                             |

**Why it matters:** Events are the **primary retention driver**. Fresh, relevant events are what bring users back. The event model must support temporal queries (this week, this month, upcoming) natively.

**Graph connections:** → Community, → City, → Categories

### 6.3 Entity: City / Locality

| Attribute                   | Description                                                             |
| --------------------------- | ----------------------------------------------------------------------- |
| `id`                        | Unique identifier                                                       |
| `name`                      | City name (e.g., "Stuttgart", "Munich")                                 |
| `slug`                      | URL-friendly identifier                                                 |
| `state`                     | German state (Bundesland)                                               |
| `country`                   | Country (Germany initially)                                             |
| `latitude` / `longitude`    | Center point                                                            |
| `population`                | For density context                                                     |
| `diaspora_density_estimate` | Estimated Indian diaspora size                                          |
| `is_active`                 | Whether this city is "launched" on the platform                         |
| `timezone`                  | City timezone                                                           |
| `metro_region_id`           | FK to parent metro region (nullable — null if this IS the primary city) |
| `is_metro_primary`          | Boolean — true if this is the main city of a metro region               |

**Metro region concept:** Stuttgart metro includes Stuttgart (primary), Böblingen, Sindelfingen, Ludwigsburg, Esslingen, Leonberg, Göppingen. Events and communities in satellite cities appear in the Stuttgart city feed. Each satellite is a City row with `metro_region_id` pointing to Stuttgart's `id`.

**Why it matters:** City is the **primary partition key** for the product. All discovery starts with city. The metro region concept ensures that nearby communities (e.g., Green Sox Göppingen cricket) appear in the Stuttgart feed without requiring users to search each satellite individually.

**Graph connections:** → Communities, → Events, → Satellite Cities (metro region)

### 6.4 Entity: Category / Persona Segment

| Attribute     | Description                                                 |
| ------------- | ----------------------------------------------------------- |
| `id`          | Unique identifier                                           |
| `name`        | Category name (e.g., "Cultural", "Student", "Professional") |
| `slug`        | URL-friendly identifier                                     |
| `type`        | `category` or `persona`                                     |
| `parent_id`   | For hierarchical categories (optional)                      |
| `icon`        | Visual icon                                                 |
| `description` | Short description                                           |
| `sort_order`  | Display ordering                                            |

**Why it matters:** Categories and personas enable structured discovery beyond city. "Show me student groups" or "Telugu cultural organizations" are category-mediated queries.

**Graph connections:** → Communities, → Events

### 6.5 Entity: Access Channel

| Attribute          | Description                                                                   |
| ------------------ | ----------------------------------------------------------------------------- |
| `id`               | Unique identifier                                                             |
| `community_id`     | Parent community (FK)                                                         |
| `channel_type`     | whatsapp / telegram / website / facebook / instagram / email / meetup / other |
| `url`              | Link to the channel                                                           |
| `label`            | Display label                                                                 |
| `is_primary`       | Primary access method                                                         |
| `is_verified`      | Link has been verified to work                                                |
| `last_verified_at` | Last verification date                                                        |

**Why it matters:** Since communities live externally, access channels are the **bridge** between discovery (LocalPulse) and engagement (WhatsApp/Telegram/etc). These must be accurate and maintained.

**Graph connections:** → Community

### 6.6 Entity: Activity Signal

| Attribute      | Description                                                                   |
| -------------- | ----------------------------------------------------------------------------- |
| `id`           | Unique identifier                                                             |
| `community_id` | Parent community (FK)                                                         |
| `signal_type`  | event_created / profile_updated / member_count_changed / link_verified / etc. |
| `occurred_at`  | When the signal was recorded                                                  |
| `metadata`     | JSONB details                                                                 |

**Why it matters:** Activity signals are the raw material for freshness and activity scoring. They allow the system to distinguish active communities from stale ones without requiring communities to log in.

**Graph connections:** → Community

### 6.7 Entity: Trust Signal

| Attribute     | Description                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `id`          | Unique identifier                                                                                      |
| `entity_type` | community / event                                                                                      |
| `entity_id`   | FK to community or event                                                                               |
| `signal_type` | admin_verified / community_claimed / user_reported_accurate / user_reported_stale / editorial_reviewed |
| `created_by`  | User or system                                                                                         |
| `created_at`  | Timestamp                                                                                              |
| `metadata`    | JSONB details                                                                                          |

**Why it matters:** Trust signals enable quality ranking. A claimed, verified community with recent editorial review should rank higher than an unverified seed listing.

**Graph connections:** → Community or Event

### 6.8 Entity: Relationship Edge

| Attribute            | Description                                                          |
| -------------------- | -------------------------------------------------------------------- |
| `id`                 | Unique identifier                                                    |
| `source_entity_type` | community / event / city                                             |
| `source_entity_id`   | FK                                                                   |
| `target_entity_type` | community / event / city                                             |
| `target_entity_id`   | FK                                                                   |
| `relationship_type`  | related_community / sister_chapter / co_hosted / parent_child / etc. |
| `strength`           | Numeric weight (computed or manual)                                  |
| `metadata`           | JSONB                                                                |

**Why it matters:** Explicit relationship edges form the community graph. They enable "related communities," "if you liked this, explore these," and graph-based discovery.

**Graph connections:** Connects any two entities in the graph.

### 6.9 Entity: User

| Attribute             | Description                                     |
| --------------------- | ----------------------------------------------- |
| `id`                  | Unique identifier                               |
| `email`               | Email address                                   |
| `display_name`        | Name                                            |
| `city_id`             | Primary city                                    |
| `persona_segments`    | Self-selected interests (student, family, etc.) |
| `preferred_languages` | Language preferences                            |
| `onboarding_complete` | Boolean                                         |
| `role`                | user / community_admin / platform_admin         |
| `created_at`          | Registration date                               |
| `last_active_at`      | Last visit                                      |

**Why it matters:** Users are necessary for personalization, saved content, community claims, and later for behavioral signal collection. Keep lightweight initially.

### 6.10 Entity: User Interaction Signal

| Attribute          | Description                                 |
| ------------------ | ------------------------------------------- |
| `id`               | Unique identifier                           |
| `user_id`          | FK (nullable for anonymous)                 |
| `session_id`       | Anonymous session ID                        |
| `entity_type`      | community / event                           |
| `entity_id`        | FK                                          |
| `interaction_type` | view / click_access / save / share / report |
| `city_id`          | Context city                                |
| `created_at`       | Timestamp                                   |

**Why it matters:** Interaction signals feed the relevance and engagement scoring pipeline. They reveal what users actually find valuable.

### 6.11 Entity: Resource

| Attribute       | Description                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------- |
| `id`            | Unique identifier                                                                           |
| `title`         | Resource title (e.g., "CGI Munich Consular Camp — Stuttgart")                               |
| `slug`          | URL-friendly identifier                                                                     |
| `resource_type` | consular_service / official_event / government_info / visa_service / community_resource     |
| `city_id`       | Primary city (FK)                                                                           |
| `url`           | External URL                                                                                |
| `description`   | Description of the resource                                                                 |
| `valid_from`    | Start of validity (nullable)                                                                |
| `valid_until`   | End of validity (nullable — null = ongoing)                                                 |
| `source`        | Where this was sourced from                                                                 |
| `categories`    | Array of category tags                                                                      |
| `metadata`      | JSONB for flexible attributes (e.g., consulate details, appointment links, VFS center info) |
| `created_at`    | When first added                                                                            |
| `updated_at`    | Last update                                                                                 |

**Why it matters:** Consular services, VFS appointments, and official embassy events are a unique content type that no competitor surfaces well. They serve a high-intent need (passport renewal, visa services, official cultural events) and are architecturally distinct from community-organized events — they have validity windows rather than single event dates, are institutionally sourced rather than community-submitted, and carry inherent trust.

**Graph connections:** → City, → Categories

---

## 7. Data Strategy

### 7.1 Data sources and lifecycle

| Data type               | Source                                                              | Lifecycle                        | Trust level                                    |
| ----------------------- | ------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------- |
| **Seed data**           | Admin team manually researches and enters                           | One-time bootstrap, then updated | Medium (human-curated but may be incomplete)   |
| **Community-submitted** | Community admins self-list                                          | Ongoing                          | Medium-high (first-party but unverified)       |
| **Imported events**     | Scraped or API-imported from Eventbrite, Meetup, community websites | Periodic refresh                 | Low-medium (requires deduplication/validation) |
| **User-contributed**    | "Suggest a community" or "report stale"                             | Ongoing                          | Low (must be moderated)                        |
| **Inferred signals**    | Computed from activity, freshness, engagement                       | Continuous                       | Derived (depends on input quality)             |

### 7.2 Structured vs semi-structured

- **Structured:** Core entity fields (name, city, dates, categories, status). These are columns.
- **Semi-structured:** Flexible metadata that varies by community type (e.g., a religious community has "denomination" and "service times" that a cricket club does not). Use JSONB.
- **Unstructured:** Descriptions, long-form text. Store as text, index for full-text search.

**Principle:** Be maximally structured for fields that drive queries and ranking. Use JSONB for fields that drive display only.

### 7.3 Freshness

Freshness is a **core product concern**, not a nice-to-have.

- Every entity has `updated_at` and `last_activity_at`
- Events have explicit temporal boundaries (`starts_at`, `ends_at`)
- Communities without any activity signal in 90 days should be flagged for review and downranked
- The discovery feed should **never** show stale content as prominent
- A scheduled job should periodically compute freshness scores and update rankings

### 7.4 Deduplication

Deduplication is critical because communities exists across platforms.

- **Community dedup:** Name + city combination as a soft unique key; fuzzy matching during ingestion
- **Event dedup:** Title + date + city combination; URL-based dedup for imported events
- **Access channel dedup:** URL normalization for links

**Approach:** Dedup at ingestion time with manual review for uncertain matches. Do not auto-merge without confidence.

### 7.5 Trustworthiness

Not all data is equally reliable. The system should track provenance:

- `source` field on every entity (admin_seed, community_submitted, imported, user_suggested)
- Trust signals as separate entities (see 6.7)
- Computed `trust_score` influences ranking
- Unverified content is shown but clearly marked and downranked

### 7.6 Temporal nature of events

Events are inherently temporal. The data model must natively support:

- Querying future events ("what's happening this week in Berlin")
- Archiving past events (not deleting — they feed activity scores and historical richness)
- Recurring events via RRULE patterns
- Timezone-correct display (Germany is CET/CEST)

### 7.7 Handling inactive / stale communities

| Scenario                 | System response                                                     |
| ------------------------ | ------------------------------------------------------------------- |
| No events in 90+ days    | Reduce activity score; flag for review                              |
| No updates in 180+ days  | Show "last updated X months ago" badge; downrank                    |
| Access links broken      | Flag for verification; show warning                                 |
| User reports stale       | Trigger review; accumulate reports                                  |
| Community confirmed dead | Set status to `inactive`; remove from active feeds, keep in archive |

---

## 8. Search & Discovery Strategy

### 8.1 Discovery hierarchy

The primary discovery flow is:

```
City → Activity/Events this week → Communities → Detail → Access
```

**Not:**

```
Search box → Type query → Get results
```

Search is secondary to **curated, city-scoped, time-aware discovery**.

### 8.2 Discovery surfaces

| Surface                | Description                                   | Primary query pattern                       |
| ---------------------- | --------------------------------------------- | ------------------------------------------- |
| **City feed**          | "What's happening in Munich for Indians"      | City + upcoming events + active communities |
| **This week view**     | Time-bounded event listing                    | City + date range                           |
| **Community explorer** | Browse communities by category/persona        | City + category filter                      |
| **Event calendar**     | Calendar or list view of all events           | City + date range + category                |
| **Search**             | Free-text search                              | Full-text across communities and events     |
| **Community detail**   | Full community profile with events and access | Single community lookup                     |
| **Event detail**       | Full event page                               | Single event lookup                         |

### 8.3 Filtering and facets

| Facet          | Description                                      |
| -------------- | ------------------------------------------------ |
| **City**       | Primary partition — always applied               |
| **Category**   | Cultural, professional, student, religious, etc. |
| **Persona**    | Student, family, professional, newcomer          |
| **Language**   | Hindi, Telugu, Tamil, Malayalam, Bengali, etc.   |
| **Event type** | Online / in-person                               |
| **Time range** | This week, this month, this weekend              |
| **Cost**       | Free / paid                                      |

### 8.4 Ranking strategy

Default ranking (city feed):

1. **Recency** — events closer to now rank higher
2. **Activity score** — communities with more recent activity rank higher
3. **Completeness** — entities with rich profiles rank over sparse ones
4. **Trust score** — verified/claimed communities rank higher
5. **Engagement** (later) — entities with more user interaction rank higher
6. **Personalization** (later) — match user's stated interests and behavior

**MVP implementation:** Simple weighted scoring formula computed periodically, stored as a materialized column, used in ORDER BY.

### 8.5 Trending / active signals

- "Trending in Munich" = communities with the most events or activity signals in the last 14 days
- "New communities" = recently added (last 30 days)
- "Popular" = most viewed/clicked (requires analytics signals)

### 8.6 Personalization roadmap

| Phase       | Personalization level                                         |
| ----------- | ------------------------------------------------------------- |
| **MVP**     | City-based only (shows content for your city)                 |
| **Phase 2** | Category/persona filtering based on user preferences          |
| **Phase 3** | Behavioral personalization (show more of what you clicked on) |
| **Phase 4** | Collaborative filtering ("users like you also explored...")   |

---

## 9. Trust & Relevance Strategy

### 9.1 Design principle

Trust and relevance should be **extensible dimensions, not hardcoded logic**. The scoring system should:

- Support multiple independent signals
- Allow weights to be tuned without code changes
- Be transparent enough to debug ("why does this community rank high?")
- Degrade gracefully when signals are sparse

### 9.2 Score architecture

```
                 ┌────────────────────┐
                 │  Composite Score   │
                 │  (weighted blend)  │
                 └────────┬───────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
   │Activity │      │ Trust   │      │Relevance│
   │ Score   │      │ Score   │      │ Score   │
   └────┬────┘      └────┬────┘      └────┬────┘
        │                 │                 │
  ┌─────┴─────┐    ┌─────┴──────┐   ┌─────┴──────┐
  │Events/90d │    │Verified?   │   │City match  │
  │Last update│    │Claimed?    │   │Category hit│
  │Completeness│   │Report count│   │Persona hit │
  │Signal count│   │Editorial   │   │Engagement  │
  └───────────┘    └────────────┘   └────────────┘
```

### 9.3 Scoring implementation plan

| Phase       | Capability                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **MVP**     | `activity_score` = f(events in 90d, last_update). `trust_score` = f(is_verified, source). Computed via cron. User-visible as qualitative label only ("Active" / "Moderate" / "Low activity") — NOT as a numeric score. Store score breakdown in JSONB (`score_breakdown`) for internal analytics but do not expose to users.                                 |
| **Phase 2** | Add completeness score. Add engagement signals (view count). Tunable weights via config. Name and brand the composite score as **"Pulse Score"** — visible to organizers on their dashboard first (opt-in). Show score breakdown on community detail pages only for **claimed** communities (organizer sees it as a tool to improve, not a public judgment). |
| **Phase 3** | Make Pulse Score publicly visible on all community cards and detail pages (by now communities have 60-90+ days of behavioral data). Introduce relevance score based on user preferences. A/B test ranking formulas. Publish scoring methodology on /about/scoring page for transparency.                                                                     |
| **Phase 4** | ML-based ranking. Graph-propagated trust (community X is trusted because related community Y is trusted).                                                                                                                                                                                                                                                    |

> **Rationale for deferred public scoring (learned from Tracxn analysis):** Tracxn's branded score works because they have 13 years of data density. At go-live, LocalPulse communities have zero behavioral data — showing "Pulse Score: 15/100" to an organizer you're recruiting is damaging. Qualitative labels ("Active") are honest; numeric scores on cold-start data are misleadingly precise. Scores become meaningful after Phase 2 engagement data accumulates.

### 9.4 Community quality indicators (user-visible)

| Indicator             | Meaning                                                               | Phase                                       |
| --------------------- | --------------------------------------------------------------------- | ------------------------------------------- |
| "Verified" badge      | Platform team has confirmed this community exists and is active       | MVP                                         |
| "Claimed" badge       | A community admin has claimed and manages this listing                | Phase 2                                     |
| Activity indicator    | "Active" / "Occasionally active" / "Last updated X months ago"        | MVP                                         |
| Event count           | "12 events in the last 3 months"                                      | MVP                                         |
| Freshness             | "Updated 3 days ago"                                                  | MVP                                         |
| Pulse Score (numeric) | Composite score with visual breakdown (activity, completeness, trust) | Phase 3 (public) / Phase 2 (organizer-only) |

### 9.5 Event quality indicators

| Indicator                       | Meaning                                       |
| ------------------------------- | --------------------------------------------- |
| Source trust                    | Is this from a claimed community or imported? |
| Completeness                    | Does it have time, venue, description, image? |
| Registration available          | Is there a clear way to sign up?              |
| Past events from same community | Track record indicator                        |

---

## 10. Ingestion & Supply Strategy

### 10.1 Why supply is the critical architecture concern

The platform is only as good as its content density. A city with 3 communities and 1 event is not useful. The architecture must make it **easy to add content and hard for content to become stale**.

### 10.2 Ingestion channels and system support

| Channel                                | System capability needed                                                                                 | Phase       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------- |
| **Manual admin seeding**               | Admin CRUD interface with bulk import (CSV/JSON)                                                         | MVP         |
| **Admin curation**                     | Rich editing, metadata management, image upload                                                          | MVP         |
| **Institutional source import**        | Import consular event schedules (CGI Munich), embassy cultural calendars, VFS service info               | MVP         |
| **Historical event import**            | Import past events from research (IndoEuropean.eu data, community websites) to populate activity history | MVP         |
| **Community self-submission**          | Public submission form with moderation queue                                                             | Phase 2     |
| **Event import from external sources** | Import pipeline with adapters for Eventbrite, Meetup APIs                                                | Phase 2-3   |
| **Semi-automated enrichment**          | Scripts to scrape public community pages for metadata                                                    | Phase 3     |
| **Verification / claim flows**         | Ownership verification (email, admin link, etc.)                                                         | Phase 2     |
| **User suggestions**                   | "Suggest a community" with light form                                                                    | Phase 2     |
| **Stale content management**           | Scheduled checks, alerts, downranking pipeline                                                           | MVP (basic) |

### 10.3 Ingestion pipeline architecture

```
┌──────────┐     ┌───────────┐     ┌─────────────┐     ┌──────────┐     ┌────────┐
│  Source   │────▶│  Ingest   │────▶│  Normalize   │────▶│  Dedup   │────▶│ Store  │
│ (admin,  │     │  Adapter  │     │  & Validate  │     │  Check   │     │ & Index│
│  import, │     │           │     │              │     │          │     │        │
│  submit) │     └───────────┘     └─────────────┘     └──────────┘     └────────┘
└──────────┘
```

**MVP:** This is just the admin CRUD interface + CSV import. But the mental model of "source → normalize → dedup → store" should guide even manual processes.

### 10.4 Content quality enforcement

- Required fields for publishing: name, city, at least one category, at least one access channel
- Completeness score incentivizes rich profiles
- Stale content alerts after 90 days without activity
- Broken link detection (periodic HTTP checks on access channel URLs)

---

## 11. MVP Architecture vs Long-Term Architecture

### 11.1 What must exist in MVP

| Capability                             | Notes                                                                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Community entity with full schema**  | All fields from domain model, even if sparsely populated initially                                                                              |
| **Event entity with temporal queries** | "This week in Berlin" must work from day 1                                                                                                      |
| **City as primary partition**          | City selection is the first user action                                                                                                         |
| **Category/persona tagging**           | At least 11 curated categories (including Consular & Official)                                                                                  |
| **Access channels**                    | WhatsApp/Telegram/website links per community                                                                                                   |
| **City feed / discovery page**         | The primary UX — activity-led, not directory. Includes sparse-content resilience (auto-expand time window, mix content types, show past events) |
| **Event listing with time filters**    | This week, this month, upcoming                                                                                                                 |
| **Community detail page**              | Full profile with events and access info                                                                                                        |
| **Resource pages**                     | Consular services, VFS info, official events                                                                                                    |
| **Admin CRUD + bulk import**           | Content seeding capability including historical events and institutional sources                                                                |
| **Programmatic SEO pages**             | Auto-generated pages for long-tail queries (/stuttgart/telugu-communities/, etc.)                                                               |
| **Basic activity scoring**             | Sort by last_updated, event count — just enough to avoid stale-first                                                                            |
| **SEO-ready rendering**                | Communities and events must be Google-indexable                                                                                                 |
| **Mobile-responsive web**              | Most diaspora users will access via mobile                                                                                                      |
| **Basic analytics**                    | Page views, clicks, search queries                                                                                                              |

### 11.2 What should be designed as future-ready but not overbuilt

| Capability             | Design now                                                                                                        | Build later                                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scoring system**     | Store activity signals as separate entities; compute simple scores; store score breakdown in JSONB for future use | Full weighted multi-signal scoring (Phase 2); branded "Pulse Score" visible to organizers (Phase 2); public Pulse Score with breakdown UI (Phase 3) |
| **Relationship edges** | Include the `relationship_edge` table in schema                                                                   | Graph queries and recommendations (Phase 4); "Similar communities" feature (Phase 4)                                                                |
| **Content provenance** | Include `ContentLog` table in schema (zero cost, high future value)                                               | Content pipeline tracking and source quality analytics (Phase 2)                                                                                    |
| **Search index**       | Full-text search via PostgreSQL                                                                                   | Meilisearch/Elasticsearch migration                                                                                                                 |
| **Personalization**    | User entity with city and interest preferences                                                                    | Behavioral personalization                                                                                                                          |
| **Community claims**   | `claim_state` field on community entity                                                                           | Full claim/verification workflow                                                                                                                    |
| **Trust signals**      | `trust_signal` table in schema                                                                                    | Multi-signal trust computation                                                                                                                      |
| **Event import**       | Design the ingestion pipeline interface                                                                           | Build adapters for external sources                                                                                                                 |
| **Notifications**      | User entity with preferences                                                                                      | Email/push notifications                                                                                                                            |
| **Multi-city**         | City model supports multiple cities                                                                               | Cross-city discovery and comparison                                                                                                                 |
| **Taxonomy depth**     | JSONB `metadata` field on community supports subcategories                                                        | Hierarchical taxonomy UI (Phase 4)                                                                                                                  |
| **Data API**           | Normalized, structured data model                                                                                 | External API for integrations (Phase 4+)                                                                                                            |

### 11.3 What can be postponed entirely

| Capability                | Why postpone                                          |
| ------------------------- | ----------------------------------------------------- |
| **Graph database**        | PostgreSQL handles relationship queries at this scale |
| **ML-based ranking**      | Need behavioral data first; months away               |
| **Recommendation engine** | Need user interaction data                            |
| **Mobile app**            | Responsive web is sufficient initially                |
| **Real-time features**    | No need for WebSockets or live updates                |
| **Content CDN**           | Images can be served from object storage directly     |
| **Multi-language UI**     | Start in English; add German and Hindi later          |
| **Payments/monetization** | No business model features in MVP                     |
| **API for third parties** | Internal API only                                     |

### 11.4 Architecture evolution diagram

```
MVP                          Phase 2                      Phase 3+
────────────────────         ────────────────────         ────────────────────
Next.js SSR                  Same                         Same + mobile app?
     │                            │                            │
Monolith API                 Monolith API                 Extract search &
(all modules)                (+ submission,                scoring services
     │                        claim flows)                     │
PostgreSQL                   PostgreSQL                   PostgreSQL
(FTS, computed scores)       + Meilisearch               + Meilisearch
                             + Redis cache               + Redis
                                                         + Graph layer
                                                         + Analytics warehouse
```

---

## 12. Non-Goals

The following are explicitly **out of scope** for the initial architecture and should not influence design decisions:

| Non-goal                         | Rationale                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Chat / messaging**             | Communities communicate on WhatsApp/Telegram; LocalPulse is the discovery layer, not an engagement platform |
| **Full social graph**            | Users do not need to friend/follow each other; this is not a social network                                 |
| **User-generated content feeds** | No posts, stories, or social feeds; content is structured (communities, events)                             |
| **Payments / transactions**      | No ticketing, donations, or commerce                                                                        |
| **Heavy workflow systems**       | No complex approval chains, multi-step forms, or enterprise admin tools                                     |
| **Real-time collaboration**      | No live editing, co-planning, or shared workspaces                                                          |
| **Content moderation AI**        | Manual moderation is sufficient at initial scale                                                            |
| **Multi-country expansion**      | Design for Germany first; internationalization is a later concern                                           |
| **Monetization features**        | No ads, premium listings, or subscription tiers in MVP                                                      |
| **Mobile native apps**           | Responsive web is the correct investment at this stage                                                      |
| **Email marketing platform**     | Simple transactional emails only; no newsletter platform                                                    |

---

## 13. Risks & Failure Modes

### 13.1 Product-architecture risks

| Risk                                   | Impact                                                                  | Mitigation                                                                                                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Low content density**                | Users arrive, find nothing, never return                                | Invest heavily in seeding before launch. Target minimum density: 60+ communities, 25+ events for Stuttgart. Import 50+ historical events.                           |
| **Stale content**                      | Platform feels abandoned even if it's not                               | Freshness scoring + staleness alerts + scheduled content review                                                                                                     |
| **Sparse event coverage**              | "This week" view is empty                                               | Sparse-content resilience: auto-expand to "this month"; show past events as "recently happened"; mix community cards into feed                                      |
| **Weak discovery UX**                  | Users don't find what they need                                         | Invest in city feed design; test with real diaspora users before launch                                                                                             |
| **Cold start per city**                | Each new city starts from zero                                          | Stuttgart launch creates repeatable playbook; BW region cities share some communities                                                                               |
| **Competitor SEO advantage**           | IndoEuropean.eu has 11 years of SEO authority and 327+ Germany articles | Launch programmatic SEO pages early; target long-tail queries they don't serve ("Telugu community Stuttgart"); their misspelled "Stuttgurt" URL gives us an opening |
| **IE adds structured features**        | They rebuild from WordPress to structured platform                      | Move fast; our structural advantage (community profiles, event filtering, trust signals) requires architectural rebuild they're unlikely to do                      |
| **Facebook Groups remain good enough** | Users stay in closed FB groups for discovery                            | Our value is cross-group, searchable, temporal — FB can't do this for closed groups. Position as complement, not replacement                                        |

### 13.2 Technical risks

| Risk                                      | Impact                                                                                                                                                        | Mitigation                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Over-engineering early**                | Ship too late; build things nobody uses                                                                                                                       | Monolith-first; simple scoring; no ML; no graph DB                                                                                                  |
| **Building graph intelligence too early** | Complexity without enough data to justify it                                                                                                                  | Design graph-ready schema but use simple SQL. Only add graph tooling when query patterns demand it                                                  |
| **Premature scoring visibility**          | Showing numeric scores on cold-start data misleads users and alienates organizers (a score of "15/100" on a freshly seeded community is accurate but harmful) | MVP: qualitative labels only ("Active", "Moderate"). Phase 2: Pulse Score visible to organizers. Phase 3: public numeric scores (see §9.3)          |
| **Search quality**                        | PostgreSQL FTS may be insufficient for fuzzy/multilingual search                                                                                              | Plan for Meilisearch migration; keep search in a separate module                                                                                    |
| **Ingestion complexity**                  | External source integration is harder than expected                                                                                                           | Start with manual seeding + CSV import; add automated ingestion only after manual proves the model                                                  |
| **Content freshness stalls**              | Platform feels dead within weeks of launch; users don't return (Tracxn adds 18,300+ data points daily; our content pipeline must be systematic, not ad-hoc)   | Commit to weekly content pipeline; track freshness SLA (every community profile checked monthly); define repeatable ingestion process before launch |
| **Schema rigidity**                       | Domain model doesn't fit real-world community diversity                                                                                                       | Use JSONB for flexible attributes; keep metadata extensible                                                                                         |
| **SEO dependency**                        | If organic search doesn't work, discovery suffers                                                                                                             | Invest in SSR, structured data (JSON-LD), and city-specific landing pages                                                                           |

### 13.3 Operational risks

| Risk                       | Impact                                                                | Mitigation                                                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Content accuracy**       | Wrong links, wrong event times erode trust                            | Verification workflows; user reporting; periodic link checks                                                                                                    |
| **Community pushback**     | Communities don't want to be listed                                   | Claim flow allows removal; be respectful of community ownership                                                                                                 |
| **No retention mechanism** | Users visit once, get the info they need, join WhatsApp, never return | Weekly digest email/WhatsApp (Phase 2); "new this week" section on city feed; event reminders; Tracxn retains via alerts and dashboards — we need an equivalent |
| **Single-city fragility**  | If launch city doesn't work, product appears to fail                  | Stuttgart chosen for weakest competitor coverage + strong automotive pipeline + discoverable communities; BW region expansion if metro needs more density       |
| **Founder bus factor**     | Platform depends on manual curation too long                          | Build community submission and claim flows in Phase 2 to distribute supply; establish 5+ organizer relationships pre-launch                                     |

---

## 14. Phased Implementation Architecture Plan

### Phase 0: Foundation (Weeks 1-3)

**Goal:** Technical foundation and project structure.

**Architecture deliverables:**

- Repository setup with monorepo or modular project structure
- PostgreSQL schema: all core entities (community, event, city, category, access_channel, activity_signal, trust_signal, relationship_edge, user, user_interaction, **resource**)
- City schema includes metro-region support (Stuttgart + satellite cities)
- Database migrations framework
- API framework with module structure (community, event, discovery, admin)
- Authentication setup (simple email/password or social login)
- Admin CRUD endpoints for communities, events, and resources
- Basic CI/CD pipeline
- Hosting infrastructure (single server or PaaS — Railway, Fly.io, Render, or similar)

**Key decisions to finalize:**

- Tech stack (recommended: Next.js + TypeScript + PostgreSQL + Prisma/Drizzle)
- Hosting provider
- Domain and DNS

### Phase 1: MVP (Weeks 3-8)

**Goal:** Launchable product for Stuttgart with seeded content.

**Architecture deliverables:**

- City feed page (activity-led discovery surface) with sparse-content resilience
- Event listing with time-based filtering (this week, this month, upcoming)
- Community explorer with category filtering (11 categories including Consular & Official)
- Community detail page with events and access channels
- Event detail page
- Resource pages (consular services, official events)
- Programmatic SEO pages: `/stuttgart/telugu-communities/`, `/stuttgart/indian-events-this-week/`, `/stuttgart/consular-services/`, etc.
- Search (PostgreSQL full-text)
- Basic activity scoring (last_updated, event count)
- Admin bulk import (CSV → communities + events + historical events)
- Admin curation dashboard
- Institutional source import: CGI Munich consular calendar, embassy events
- Historical event import: populate past events from IndoEuropean.eu research and community websites
- Cross-reference community mentions: link same organizer/community appearing across different events
- SEO: SSR, meta tags, JSON-LD structured data, city landing pages
- Mobile-responsive design
- Basic analytics integration (PostHog or Plausible)

**Content milestone:** 60+ communities, 25+ upcoming events, 50+ historical events, 5+ consular events in Stuttgart metro before public launch.

### Phase 2: Supply Activation (Weeks 8-14)

**Goal:** Enable communities to participate and reduce dependency on manual curation.

**Architecture deliverables:**

- Community self-submission form with moderation queue
- Community claim flow (ownership verification via email or link)
- Community admin dashboard (edit profile, add events)
- User accounts with city and interest preferences
- Saved/bookmarked communities and events
- "Suggest a community" user flow
- "Report stale/incorrect" user flow
- Improved scoring: completeness score, engagement signals (view counts)
- **Pulse Score branded and visible to claimed-community organizers** on their dashboard (score breakdown as improvement tool, not public judgment)
- **Content provenance logging** (`ContentLog` entity tracking source, action, timestamp for every creation/update/verification — enables freshness auditing and source quality tracking; see Tracxn analysis §6.2)
- Broken link detection (scheduled job)
- Stale content alerting and downranking
- **Second city launch: Karlsruhe or Mannheim** (BW region — shared consular services, overlapping communities)

**Architecture milestone:** The system can receive and process community-submitted content without manual intervention for every entry.

### Phase 3: Trust & Relevance Evolution (Weeks 14-22)

**Goal:** Ranking, search quality, and multi-city readiness.

**Architecture deliverables:**

- Dedicated search index (Meilisearch) for fast, faceted, typo-tolerant search
- Multi-signal scoring engine with configurable weights
- Trust score computation (verification, claim state, user reports, editorial review)
- **Pulse Score publicly visible** on all community cards and detail pages (communities now have 60-90+ days of behavioral data to back the numbers)
- **Scoring transparency page** (/about/scoring — explain methodology, build user trust; see Tracxn analysis §6.3)
- Category-aware ranking ("best student communities in Munich")
- Trending signals ("most active this week")
- Redis caching for hot queries (city feeds, popular communities)
- Second city launch with repeatable city launch process
- **Third city: Munich** (largest Indian population, strongest competition — but by now we have proven playbook)
- Event import adapter for at least one external source (Eventbrite or Meetup API)
- User preference-based filtering (show me communities matching my interests)
- Email notifications (weekly digest of events in your city — optional)
- **Auto-generated city reports** ("State of the Indian Community in Stuttgart: 2026" — generated from platform data; serves as content marketing and SEO; see Tracxn analysis §7.3)

**Architecture milestone:** The scoring and search layer is decoupled from CRUD; ranking can be tuned without code changes.

### Phase 4: Graph Intelligence Evolution (Weeks 22+)

**Goal:** Unlock graph-based discovery and recommendation.

**Architecture deliverables:**

- Relationship edge population (related communities, shared categories, co-hosted events)
- **"Similar communities" feature** powered by graph queries (same category, same city, shared event attendees)
- "If you're interested in X, you might like Y" recommendations
- Graph query layer (Apache AGE on PostgreSQL or dedicated graph DB evaluation)
- Cross-city discovery ("this community also exists in Frankfurt")
- Behavioral personalization (ranking influenced by user's past interactions)
- A/B testing framework for ranking experiments
- Analytics warehouse for deep behavioral analysis
- **Data API for potential integrations** (city tourism boards, German integration agencies, relocation companies — see Tracxn analysis §5.4)
- **Hierarchical taxonomy expansion** (sub-categories for deeper filtering: "Cultural > Festivals > Diwali", "Professional > Automotive"; see Tracxn analysis §2.2)

**Architecture milestone:** The community graph is a queryable, scored asset that enables discovery beyond simple listing and filtering.

---

## Technology Recommendations Summary

| Layer            | MVP Recommendation                               | Evolution                  |
| ---------------- | ------------------------------------------------ | -------------------------- |
| **Frontend**     | Next.js (App Router) + TypeScript + Tailwind CSS | Same                       |
| **Backend**      | Next.js API routes / standalone Node.js API      | Extract services if needed |
| **Database**     | PostgreSQL (via Supabase, Neon, or self-hosted)  | Same + extensions          |
| **ORM**          | Prisma or Drizzle ORM                            | Same                       |
| **Search**       | PostgreSQL full-text search                      | Meilisearch                |
| **Cache**        | None                                             | Redis                      |
| **Auth**         | NextAuth.js or Supabase Auth                     | Same                       |
| **Analytics**    | PostHog or Plausible                             | PostHog + data warehouse   |
| **Hosting**      | Vercel (frontend) + Railway/Fly.io (backend/DB)  | Same or AWS/GCP            |
| **File storage** | Cloudflare R2 or S3                              | Same                       |
| **CI/CD**        | GitHub Actions                                   | Same                       |
| **Graph**        | SQL joins + CTEs                                 | Apache AGE or Neo4j        |

---

## Appendix: Key Architecture Principles

1. **Activity over directory.** Every architectural decision should favor time-sensitive, fresh content over static listings.

2. **City as partition.** City is the primary data access pattern and should be the first filter in every query.

3. **Separate concerns, deploy together.** Modular monolith — clean internal boundaries, single deployment unit.

4. **Score everything.** Every entity should have computed quality/freshness/trust scores, even if simple.

5. **Design for the graph, start with tables.** Model relationships explicitly as edges in relational tables. Migrate to graph tooling only when query complexity demands it.

6. **Supply is the product.** Content acquisition is not a one-time task; it's a continuous system capability.

7. **Extensible metadata.** Use JSONB for attributes that vary by entity subtype. Don't over-normalize.

8. **SEO is distribution.** Server-side rendering and structured data are architectural requirements, not nice-to-haves.

9. **Don't build what you don't need yet.** No graph DB, no ML, no real-time, no mobile app in MVP.

10. **Freshness is trust.** If the platform shows stale content, users lose trust. Freshness monitoring is a core system responsibility.
