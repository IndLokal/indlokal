# TDD-0030: Resources v2 — scoped knowledge, resolver, satellite parity

- **Status:** Approved
- **Linked PRD:** PRD-0030
- **Linked ADR:** ADR-0007
- **Owner:** Engineering (this branch)

## 1. Architecture overview

```
┌──────────────────────────┐    ┌──────────────────────────┐
│  Web /[city]/resources/  │    │  Mobile resources screen │
│  Server component        │    │  Expo Router screen      │
└────────────┬─────────────┘    └────────────┬─────────────┘
             │                               │
             │              ┌────────────────┘
             ▼              ▼
   ┌────────────────────────────────────────┐
   │  GET /api/v1/cities/{slug}/resources   │
   │  (Next.js route, Node runtime)         │
   └────────────────────┬───────────────────┘
                        ▼
   ┌────────────────────────────────────────┐
   │  modules/resources/resolver.ts         │
   │   ├─ getResourcesForCity(slug, opts)   │
   │   ├─ in-process LRU (60s, key=cacheKey)│
   │   └─ consular-jurisdiction merge       │
   └────────────────────┬───────────────────┘
                        ▼
   ┌────────────────────────────────────────┐
   │  Prisma: db.resource.findMany(scopeOR) │
   └────────────────────────────────────────┘
```

The existing `getResourcesByCity(citySlug, type?)` in
[`apps/web/src/modules/resources/queries.ts`](../../../apps/web/src/modules/resources/queries.ts)
becomes a thin wrapper over the new `getResourcesForCity` so callers
don't have to change in v1.

## 2. Data model changes

### Prisma diff

```prisma
enum ResourceScope {
  GLOBAL
  COUNTRY
  STATE
  METRO
  CITY
  DISTRICT
}

enum ResourceAudience {
  NEWCOMER
  FAMILY
  FOUNDER
  EMPLOYEE
  STUDENT
  STUDENT_VISA
  SENIOR
  RETURNEE
}

enum ResourceStage {
  PRE_ARRIVAL
  FIRST_30_DAYS
  FIRST_90_DAYS
  SETTLED
  ANYTIME
}

model Resource {
  // ── existing columns unchanged ──
  id           String   @id @default(cuid())
  title        String
  slug         String   @unique
  resourceType ResourceType @map("resource_type")
  url          String?
  description  String?
  validFrom    DateTime? @map("valid_from")
  validUntil   DateTime? @map("valid_until")
  isHidden     Boolean  @default(false) @map("is_hidden")
  hiddenReason String?  @map("hidden_reason")
  lastReviewedAt DateTime? @map("last_reviewed_at")
  reviewCadenceDays Int @default(180) @map("review_cadence_days")
  source       ContentSource @default(ADMIN_SEED)
  metadata     Json?
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  // ── relaxed: cityId becomes nullable in Phase A; dropped in Phase B ──
  cityId       String?  @map("city_id")
  city         City?    @relation(fields: [cityId], references: [id])

  // ── new in this TDD ──
  scope         ResourceScope     @default(CITY)
  scopeRegion   String?           @map("scope_region")
  audiences     ResourceAudience[]
  lifecycleStage ResourceStage[]  @map("lifecycle_stage")
  priority      Int               @default(50)
  isEssential   Boolean           @default(false) @map("is_essential")

  @@index([scope, scopeRegion])
  @@index([resourceType])
  @@index([isHidden])
  @@index([isEssential])
  @@map("resources")
}
```

### Migration plan — three migrations, two PRs

**Phase A (this PR) — `20260527XXXXXX_resources_scope_v2`**

```sql
-- 1. Add columns nullable / with default
ALTER TABLE resources
  ADD COLUMN scope          TEXT     NOT NULL DEFAULT 'CITY',
  ADD COLUMN scope_region   TEXT,
  ADD COLUMN priority       INT      NOT NULL DEFAULT 50,
  ADD COLUMN is_essential   BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN lifecycle_stage TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN audiences      TEXT[]   NOT NULL DEFAULT '{}';

-- 2. Backfill: every existing row → scope=CITY, scopeRegion=city.slug
UPDATE resources r
SET scope_region = c.slug
FROM cities c
WHERE r.city_id = c.id;

-- 3. Make cityId nullable (was NOT NULL)
ALTER TABLE resources ALTER COLUMN city_id DROP NOT NULL;

-- 4. New indexes
CREATE INDEX idx_resources_scope_region ON resources (scope, scope_region);
CREATE INDEX idx_resources_is_essential ON resources (is_essential);
```

Enums are declared in `schema.prisma`; Prisma materialises them as
`TEXT` / `TEXT[]` (Postgres native enums avoided to keep schema flex).

**Phase A.1 (same PR) — dedupe & rescope migration**
`20260527XXXXXX_resources_dedupe_v2.ts` (TypeScript migration, not SQL,
because we need predicate-based merging). Runs in order:

1. Collapse `guide-116117-doctor-on-duty-*` → keep
   `guide-116117-doctor-on-duty` with `scope='COUNTRY'`, delete the
   others.
2. Collapse `elster-*` → `elster-online-tax-portal`, `scope='COUNTRY'`.
3. Collapse `arbeitsagentur-*` → `arbeitsagentur-jobs-counselling`,
   `scope='COUNTRY'`.
4. Collapse `cgi-munich-consular-*` → `cgi-munich-consular`,
   `scope='COUNTRY'`, `metadata.consulate='cgi-munich'`.
5. Collapse `cgi-frankfurt-consular-*` → `cgi-frankfurt-consular`,
   `scope='COUNTRY'`, `metadata.consulate='cgi-frankfurt'`.
6. Promote `embassy-india-berlin-consular` → `scope='COUNTRY'`,
   `metadata.consulate='embassy-berlin'`.
7. Promote pan-Germany guides (`guide-eu-blue-card`,
   `guide-kindergeld-non-eu`, `guide-elterngeld-mutterschutz`,
   `guide-health-insurance-gkv-pkv`, `guide-steuererklaerung-basics`,
   `vfs-global-india-germany`, `oci-card-application-germany`,
   `passport-seva-renewal-india`, `guide-schufa-credit-score`,
   `guide-gez-rundfunkbeitrag`, `guide-online-indian-grocery-germany`,
   `guide-emergency-numbers-germany`) → `scope='COUNTRY'`,
   `cityId=null`.
8. Promote BW-state rows (none currently identified, but the predicate
   list is extensible).
9. Mark essential rows: `guide-anmeldung-stuttgart`,
   `guide-anmeldung-berlin`, `buergerbuero-munich`,
   `frankfurt-buergerservice`, `karlsruhe-buergerservice`,
   `mannheim-buergerdienste`, `guide-health-insurance-gkv-pkv`,
   `guide-steuererklaerung-basics`, `guide-eu-blue-card` → `isEssential=true`,
   `lifecycle_stage='{FIRST_30_DAYS}'`, `priority=80`.

Each step uses `prisma.resource.updateMany` + `prisma.resource.deleteMany`
inside a transaction; the script is idempotent (skip if already done by
checking the canonical slug's `scope`).

**Phase B (follow-up PR, after the resolver is in production)** —
`20260603XXXXXX_resources_drop_city_fk` removes `cityId` and the
`City.resources` relation entirely. Out of scope for this TDD.

## 3. API surface

### Zod contracts — `packages/shared/src/contracts/resources.ts`

Additive — existing `Resource` keeps its fields, new fields are appended:

```ts
export const ResourceScope = z.enum(['GLOBAL', 'COUNTRY', 'STATE', 'METRO', 'CITY', 'DISTRICT']);
export const ResourceAudience = z.enum([
  'NEWCOMER',
  'FAMILY',
  'FOUNDER',
  'EMPLOYEE',
  'STUDENT',
  'STUDENT_VISA',
  'SENIOR',
  'RETURNEE',
]);
export const ResourceStage = z.enum([
  'PRE_ARRIVAL',
  'FIRST_30_DAYS',
  'FIRST_90_DAYS',
  'SETTLED',
  'ANYTIME',
]);

export const Resource = z.object({
  id: Cuid,
  title: z.string(),
  slug: z.string(),
  resourceType: ResourceType,
  url: z.string().url().nullable(),
  description: z.string().nullable(),
  validFrom: IsoDateTime.nullable(),
  validUntil: IsoDateTime.nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: IsoDateTime,
  // ── new ──
  scope: ResourceScope,
  scopeRegion: z.string().nullable(),
  audiences: z.array(ResourceAudience),
  lifecycleStage: z.array(ResourceStage),
  priority: z.number().int().min(0).max(100),
  isEssential: z.boolean(),
  resolvedScope: ResourceScope.optional(), // why this row matched the current city
});
```

The optional `resolvedScope` field is set by the resolver, not the DB —
it's the "which scope hit" tag used by analytics and the UI.

### Endpoints

| Method | Path                                      | Auth  | Query                                         | Response                                     |
| ------ | ----------------------------------------- | ----- | --------------------------------------------- | -------------------------------------------- |
| GET    | `/api/v1/cities/{slug}/resources`         | None  | `type`, `audience`, `stage`, `essentialsOnly` | `Resource[]` (resolver output)               |
| GET    | `/api/v1/cities/{slug}/resources/journey` | None  | —                                             | `{ steps: Resource[] }` (essential, ordered) |
| PATCH  | `/api/v1/admin/resources/{id}`            | Admin | body: partial `Resource`                      | `Resource`                                   |

`/journey` is a convenience for mobile so it doesn't have to filter
client-side. Internally it calls
`getResourcesForCity(slug, { essentialsOnly: true, stage: 'FIRST_30_DAYS' })`.

### Resolver contract

```ts
// apps/web/src/modules/resources/resolver.ts
export interface ResolverOptions {
  type?: ResourceType;
  audience?: ResourceAudience;
  stage?: ResourceStage;
  essentialsOnly?: boolean;
  includeHidden?: boolean;
}

export interface ResolvedResource extends ResourceRow {
  scope: ResourceScope;
  scopeRegion: string | null;
  audiences: ResourceAudience[];
  lifecycleStage: ResourceStage[];
  priority: number;
  isEssential: boolean;
  /** Which scope matched the current city (for analytics). */
  resolvedScope: ResourceScope;
}

export async function getResourcesForCity(
  citySlug: string,
  opts?: ResolverOptions,
): Promise<ResolvedResource[]>;
```

Logic (pseudocode):

```ts
const city = await loadCityWithMetroAndState(citySlug);
if (!city) return [];

const metroSlug = city.isMetroPrimary ? city.slug : city.metroRegion?.slug;
const satelliteSlugs = city.isMetroPrimary ? city.satelliteCities.map((s) => s.slug) : [];
const consulate = CONSULAR_JURISDICTION[citySlug] ?? null;

const where: Prisma.ResourceWhereInput = {
  isHidden: opts?.includeHidden ? undefined : false,
  OR: [
    { scope: 'GLOBAL' },
    { scope: 'COUNTRY', scopeRegion: 'DE' },
    { scope: 'STATE', scopeRegion: STATE_ISO[city.state] },
    metroSlug ? { scope: 'METRO', scopeRegion: metroSlug } : null,
    { scope: 'CITY', scopeRegion: { in: [citySlug, ...satelliteSlugs] } },
    consulate ? { scope: 'COUNTRY', metadata: { path: ['consulate'], equals: consulate } } : null,
  ].filter(Boolean),
  // optional filters
  ...(opts?.type && { resourceType: opts.type }),
  ...(opts?.audience && { audiences: { has: opts.audience } }),
  ...(opts?.stage && { lifecycleStage: { has: opts.stage } }),
  ...(opts?.essentialsOnly && { isEssential: true }),
};

const rows = await db.resource.findMany({
  where,
  orderBy: [{ priority: 'desc' }, { lastReviewedAt: 'desc' }, { slug: 'asc' }],
});

// dedupe by slug, tag resolvedScope (CITY > METRO > STATE > COUNTRY > GLOBAL)
return dedupeAndTagScope(rows, { citySlug, metroSlug, state: city.state });
```

### Caching

`lru-cache` (already a transitive dep) keyed on
`${citySlug}|${JSON.stringify(opts)}`, TTL 60 s, max 500 entries.

Cache-busting: the admin save path
(`PATCH /api/v1/admin/resources/{id}` and the bootstrap seed runner)
calls `invalidateResourcesCache()` which clears all entries (cheap; we
re-warm on next request).

## 4. Mobile screens & navigation

- `apps/mobile/app/resources.tsx` adopts the 3-section layout from the
  web hub.
- Categories use `RESOURCE_CATEGORIES` exported from a new
  `packages/shared/src/config/resource-categories.ts` (lifted from
  `apps/web/src/lib/config/resources.ts` so web and mobile share one
  source of truth).
- Audience filter as a horizontal `Pressable` rail at the top.
- Journey checklist persists "done" state per `(userId, citySlug, slug)`
  in `AsyncStorage` under key `resource_journey:v1:{citySlug}`.

## 5. Push / Email / Inbox triggers

None for v1. Future: a "Day 7 nudge" outbox row that pings users who
have completed 0/8 journey steps after 7 days — tracked in a follow-up
PRD.

## 6. Feature flags

| Flag                           | Default | Kill-switch                                              |
| ------------------------------ | ------- | -------------------------------------------------------- |
| `resources_v2_resolver`        | `true`  | Falls back to `getResourcesByCity` legacy by-city query. |
| `resources_v2_journey_ui`      | `true`  | Hides the "First 30 days" section; categories only.      |
| `resources_v2_audience_filter` | `true`  | Hides the audience filter chips; shows all.              |

All three default-on for staging from day one; default-on for prod after
24 h of clean Sentry on staging.

## 7. Observability

- **Logs** (structured, info): `resources.resolved`,
  `{ citySlug, count, scopeBreakdown: { GLOBAL: n, COUNTRY: n, STATE: n, METRO: n, CITY: n }, ms }`.
- **Sentry tags** on resolver errors: `tag:resource_resolver`,
  `citySlug`, `optsHash`.
- **Cache metrics**: hit-rate logged every 1 000 calls.
- **Migration verification query** (runs once at end of Phase A.1):
  ```sql
  SELECT scope, count(*) FROM resources GROUP BY scope;
  ```
  Expected after dedupe: ≥ 8 COUNTRY rows, ≥ 0 STATE, ≥ 0 METRO,
  ≥ 25 CITY rows.

## 8. Failure modes & fallbacks

- **City not found** → resolver returns `[]`, route returns `200 []`
  (unchanged behaviour).
- **Cache backend dies** → LRU is in-process; no external dep, no
  fallback needed.
- **`STATE_ISO` map missing a Bundesland** → resolver logs `warn` and
  omits the STATE branch; never throws.
- **Consular jurisdiction map missing a city** → resolver logs `warn`
  and omits the consular branch; user still gets COUNTRY/STATE/METRO/CITY.
- **Migration backfill mis-tags a row** → admin can manually re-edit;
  no data loss because the dedupe migration is wrapped in a transaction
  with the keep-canonical-row + delete-duplicates pattern (failure
  rolls back; canonical row is always picked as the row with the
  longest description, fallback to alphabetically-first slug).

## 9. Test plan

- **Unit (vitest)** — `apps/web/src/modules/resources/__tests__/resolver.test.ts`
  - Heidelberg gets metro Mannheim + STATE BW + COUNTRY + GLOBAL rows.
  - Berlin gets `embassy-berlin` consulate, not `cgi-munich`.
  - `essentialsOnly` filter returns only `isEssential=true` rows.
  - Slug dedup: a row matching CITY and METRO appears once with
    `resolvedScope='CITY'` (most-specific wins).
  - Order: same priority → newer `lastReviewedAt` first.
- **Contract (vitest)** —
  `apps/web/src/app/api/v1/__tests__/resources.integration.test.ts` (already
  exists) extended with: satellite city returns non-empty; `/journey`
  returns only essentials.
- **Mobile** — `apps/mobile/components/__tests__/ResourcesScreen.test.tsx`
  for the new layout (sections render, audience filter swaps lists).
- **E2E**: deferred to follow-up — covered manually before merge.

## 10. Rollout plan

1. Merge schema-only migration (Phase A) to staging. Verify backfill via
   the metrics query in §7. No client behaviour change yet.
2. Merge resolver + API changes. Flag `resources_v2_resolver=true`
   in staging only. Verify web hub + mobile screen.
3. Merge dedupe migration (Phase A.1) to staging. Verify row count
   drops from 77 → ~50 and every active city's resolver result is ≥ 25.
4. Flip `resources_v2_resolver=true` in prod.
5. Flip `resources_v2_journey_ui=true` and
   `resources_v2_audience_filter=true` 24 h later.
6. Phase B `_drop_city_fk` migration ships in the following sprint.

## 11. Backout plan

- Flip `resources_v2_resolver=false` → legacy `getResourcesByCity`
  takes over; web/mobile keep working with the by-cityId join (still
  valid because Phase A keeps `cityId` populated and only makes it
  nullable).
- Phase A.1 dedupe is reversible via a recorded "before" snapshot —
  the migration script writes
  `apps/web/prisma/migrations/snapshots/resources-dedupe-{ts}.json`
  with every row it touches; a companion `restore` script re-inserts
  them.
- Phase B (FK drop) is only run after 7 days of green; if backout
  needed past Phase B, restore from DB backup (out-of-band).
