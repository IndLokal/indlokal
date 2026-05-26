# ADR-0007: Resource scope and resolution model

- **Date:** 2026-05-27
- **Status:** Accepted

## Context

The current `Resource` model in [`apps/web/prisma/schema.prisma`](../../../apps/web/prisma/schema.prisma)
forces every row to bind to exactly one `cityId`. In practice, the
overwhelming majority of resources we curate are **not** city-specific:

- Pan-Germany facts (`116117`, `ELSTER`, `Arbeitsagentur`, `make-it-in-germany`,
  `familienportal`, federal Kindergeld/Elterngeld rules, GKV vs PKV explainers).
- Consular jurisdictions that span many cities (CGI Munich serves Bavaria
  - Baden-Württemberg, CGI Frankfurt serves Hesse + NRW + neighbours,
    Embassy Berlin serves Berlin + Brandenburg).
- State-level processes (Kita placement law, BW integration ministry).
- Metro-shared resources (a Stuttgart Bürgeramt page applies equally to
  Esslingen and Ludwigsburg residents who file in the metro core).

The single-`cityId` constraint produced two anti-patterns:

1. **Forced duplication.** When we expanded the seed for Berlin / Munich /
   Frankfurt / Karlsruhe / Mannheim (see baseline commit on
   `feat/resources-v2-spec-driven`), the federal `116117` row had to be
   copied 4× under 4 slugs. Future content sweeps would multiply this.
2. **Satellite cities show nothing.** Satellites have their own `City` row
   (e.g. `heidelberg`, `esslingen`) and no resources. Mobile's
   `GET /api/v1/cities/{slug}/resources` for a satellite returns an empty
   list. The web hub partly works because it joins satellites _back up_
   to a metro (`cityRow.satelliteCities`), but a satellite URL like
   `/heidelberg/resources/` has no real page.

We need a model that lets one curated resource serve many cities without
duplication, and a deterministic resolver that answers
"which resources apply to city X?" for both web and mobile.

## Decision

Introduce **scope-based resources** with a runtime resolver, replacing the
single-`cityId` binding.

### 1. New columns on `Resource`

```prisma
scope          ResourceScope @default(CITY)
scopeRegion    String?       // see semantics below
audiences      ResourceAudience[]   // many-to-many via implicit array column
lifecycleStage ResourceStage[]      // many-to-many via implicit array column
priority       Int           @default(50) // 0-100, higher = surfaced first
isEssential    Boolean       @default(false) // appears in "first 30 days"
```

`scope` enum:

| Value      | Meaning                                  | `scopeRegion` semantics                              |
| ---------- | ---------------------------------------- | ---------------------------------------------------- |
| `GLOBAL`   | True for any Indian-origin user in DE/EU | `null`                                               |
| `COUNTRY`  | Germany-wide                             | `"DE"` (locked literal; reserved for future markets) |
| `STATE`    | German Bundesland                        | ISO code (`"BW"`, `"BY"`, `"BE"`, `"HE"`, `"BB"`)    |
| `METRO`    | A metro and its satellites               | metro city slug (`"stuttgart"`, `"munich"`, …)       |
| `CITY`     | Single city (or satellite)               | city slug                                            |
| `DISTRICT` | Sub-city (Bezirk / Stadtteil)            | `"{citySlug}:{districtSlug}"` (future)               |

`cityId` becomes **nullable** for back-compat during migration and is
fully retired once the migration is in place. The `City.resources`
relation is dropped in the same migration; reverse lookup goes through
the resolver.

`audiences` enum: `NEWCOMER`, `FAMILY`, `FOUNDER`, `EMPLOYEE`,
`STUDENT`, `STUDENT_VISA`, `SENIOR`, `RETURNEE`.

`lifecycleStage` enum: `PRE_ARRIVAL`, `FIRST_30_DAYS`, `FIRST_90_DAYS`,
`SETTLED`, `ANYTIME`.

### 2. Consular jurisdiction map

A static map in `apps/web/src/lib/config/consular-jurisdictions.ts`:

```ts
// citySlug → consulate identifier
export const CONSULAR_JURISDICTION = {
  berlin: 'embassy-berlin',
  munich: 'cgi-munich',
  stuttgart: 'cgi-munich',
  karlsruhe: 'cgi-munich',
  mannheim: 'cgi-munich',
  frankfurt: 'cgi-frankfurt',
  // satellites inherit from their metro
};
```

A consular `Resource` carries `scope = COUNTRY` and is tagged via
`metadata.consulate = 'cgi-munich'`; the resolver merges it for any city
whose jurisdiction matches. One row, many cities.

### 3. Resolver contract

`getResourcesForCity(citySlug, opts?)` lives in
`apps/web/src/modules/resources/resolver.ts` and returns the de-duplicated
union of:

```
GLOBAL
+ COUNTRY (where scopeRegion = 'DE')
+ STATE   (where scopeRegion = city.state)
+ METRO   (where scopeRegion = city.metroSlug OR scopeRegion = citySlug if city is itself a metro)
+ CITY    (where scopeRegion = citySlug)
+ CITY    (where scopeRegion ∈ city.satelliteSlugs, if city is a metro)
+ consular (COUNTRY rows where metadata.consulate = CONSULAR_JURISDICTION[citySlug])
```

Ordering: `priority DESC`, then `lastReviewedAt DESC`, then `slug ASC`.
De-duplication: by `slug` (a row appears once even if it matches multiple
scopes).

Optional filters: `resourceType`, `audiences`, `lifecycleStage`,
`isEssential`, `includeHidden`.

### 4. Backward compatibility

Migration `2026XXXX_resources_scope_v2`:

1. Add new columns nullable.
2. Backfill: every existing row → `scope = 'CITY'`, `scopeRegion = city.slug`.
3. Identify well-known federal/state rows by slug (predicate list in
   the migration file) and rewrite them to `scope = 'COUNTRY'` /
   `scope = 'STATE'`, plus collapse to a single canonical slug.
4. Drop `cityId` and the `Resource → City` relation in a follow-up
   migration (separate PR, behind feature flag), once the resolver is in
   production and the web/mobile clients are switched over.

## Consequences

Positive:

- One row per piece of knowledge. The 4 copies of `116117` collapse to
  one `COUNTRY`-scoped row; CGI Munich appears in 4 cities via the
  jurisdiction map, not 4 duplicate rows.
- Satellite cities become first-class: a `heidelberg` page automatically
  surfaces `GLOBAL + COUNTRY + STATE:BW + METRO:mannheim + CITY:heidelberg`.
- Editorial layers can be added (audience, lifecycle, priority) without
  schema churn.
- A single resolver replaces ad-hoc `findMany({ where: { cityId: ... } })`
  call sites in web and mobile, eliminating the satellite drift.

Negative:

- Schema migration with backfill - non-trivial, requires careful
  predicate list and an ADR-grade backout plan.
- Resolver is a hot path; needs an in-process LRU cache (per-city,
  60 s TTL) to keep hub pages fast.
- Admin UI (`/admin/data/resources`) needs new fields (scope, audience,
  stage) and stops showing a single "City" column.

Neutral:

- `metadata.consulate` is denormalised by design; the jurisdiction map
  in code is the source of truth, the column is for query convenience.
- The 33-row baseline content survives the migration - only the `scope`,
  `scopeRegion`, and slugs of duplicates change.

## Alternatives considered

- **Many-to-many `Resource ↔ City` join table.**
  Pros: simple to grasp, fits Prisma.
  Cons: 1 row of curated content can require N inserts (every metro +
  satellite); editorial review must touch N join rows; "this applies to
  all of Germany" needs an explicit fan-out at write time; new cities
  must trigger a backfill. Scope is the cleaner primitive - it expresses
  intent, not enumeration.

- **Keep single `cityId`, fake it by tagging the "primary" city and
  letting the resolver fan out by type heuristics.**
  Pros: zero schema change.
  Cons: heuristics drift; consular routing becomes implicit; no first-
  class way for editors to mark a row as truly federal.

- **One canonical "Germany" pseudo-city row.**
  Pros: no schema change.
  Cons: violates the `City` invariant (it's a real metro/satellite, not
  a country); breaks the city detail UI and analytics; hides resources
  from cities unless we still fan-out at read time.
