/**
 * Dedupe & re-scope resources — PRD/TDD-0030 Phase A.1.
 *
 * One-shot, idempotent. Run AFTER `20260526222757_resources_scope_v2` has
 * been applied. It does three things:
 *
 *  1. Promote pan-Germany guides to scope=COUNTRY (cityId=null).
 *  2. Collapse city-fanout duplicates of identical federal services
 *     (116117, ELSTER, Arbeitsagentur) down to a single COUNTRY row.
 *  3. Tag consular rows with metadata.consulate so the resolver can map
 *     each city to the correct CGI via CONSULAR_JURISDICTION (TDD §3).
 *  4. Mark first-30-days essentials (`isEssential=true`, `priority=80`).
 *
 * Idempotent: safe to re-run; uses `updateMany` keyed by slug, and the
 * collapse step is no-op when there are no remaining duplicates.
 *
 * Run manually:   pnpm --filter web tsx prisma/dedupe_resources_v2.ts
 */

import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ── 1. Pan-Germany promotions ──────────────────────────────────────────
const COUNTRY_SCOPE_SLUGS: readonly string[] = [
  // Bureaucracy & lifecycle
  'guide-abmeldung-germany',
  'guide-emergency-numbers-germany',
  'guide-marriage-registration-germany',
  'guide-niederlassungserlaubnis-pr',
  'guide-verpflichtungserklaerung',
  // Driving
  'guide-driving-licence-conversion',
  'guide-international-driving-permit',
  // Visa & residence
  'guide-eu-blue-card',
  'guide-freelance-visa-germany',
  'guide-family-reunion-visa',
  // Family & money
  'guide-kindergeld-non-eu',
  'guide-elterngeld-parental-allowance',
  'guide-mutterschutz-elternzeit',
  'guide-health-insurance-gkv-pkv',
  // Tax
  'guide-elster-tax-portal',
  'guide-steuererklaerung-basics',
  'guide-steuerberater-english',
  'guide-fragebogen-steuerliche-erfassung',
  'guide-dtaa-india-germany',
  'guide-nre-nro-accounts',
  // Everyday
  'guide-schufa-credit-score',
  'guide-gez-rundfunkbeitrag',
  'guide-online-indian-grocery-germany',
  // Work
  'guide-agentur-fuer-arbeit',
  'guide-job-portals-internationals',
  'guide-freiberufler-vs-gewerbe',
  'guide-gewerbeanmeldung',
  // Indian government / consular portals
  'moia-overseas-indian-resources',
  'passport-seva-renewal-india',
  'oci-card-application-germany',
  'vfs-global-india-germany',
  'pcc-india-germany',
];

// ── 2. Duplicate collapse: each group has a `keep` (becomes COUNTRY) and
//      `drop` slugs (deleted because the keep row supersedes them).
const DUPLICATE_GROUPS: ReadonlyArray<{ keep: string; drop: readonly string[] }> = [
  // 116117 doctor-on-duty: 4 city copies → keep one as COUNTRY.
  // We keep `…-munich` (oldest by file order) and rename via metadata.
  {
    keep: 'guide-116117-doctor-on-duty-munich',
    drop: [
      'guide-116117-doctor-on-duty-frankfurt',
      'guide-116117-doctor-on-duty-karlsruhe',
      'guide-116117-doctor-on-duty-mannheim',
    ],
  },
  // Arbeitsagentur: three city copies superseded by guide-agentur-fuer-arbeit.
  {
    keep: 'guide-agentur-fuer-arbeit',
    drop: ['arbeitsagentur-berlin', 'arbeitsagentur-karlsruhe', 'arbeitsagentur-mannheim'],
  },
  // ELSTER: two city copies superseded by guide-elster-tax-portal.
  {
    keep: 'guide-elster-tax-portal',
    drop: ['elster-karlsruhe', 'elster-munich'],
  },
  // CGI Munich service rows beyond the canonical one — fold under jurisdiction map.
  {
    keep: 'cgi-munich-consular-services',
    drop: [
      'cgi-munich-consular-karlsruhe',
      'cgi-munich-consular-mannheim',
      'cgi-munich-consular-camp-stuttgart-2026',
      'india-house-stuttgart-honorary-consulate',
    ],
  },
];

// ── 3. Consular tagging — `metadata.consulate` discriminator drives the
//      CONSULAR_JURISDICTION map at resolution time (TDD §3).
const CONSULATE_TAGS: ReadonlyArray<{ slug: string; consulate: string }> = [
  { slug: 'cgi-munich-consular-services', consulate: 'munich' },
  { slug: 'cgi-frankfurt-consular-services', consulate: 'frankfurt' },
  { slug: 'embassy-india-berlin-consular', consulate: 'berlin' },
  { slug: 'cgi-munich-national-day-celebrations', consulate: 'munich' },
];

// ── 4. First-30-days essentials ────────────────────────────────────────
const ESSENTIAL_SLUGS: readonly string[] = [
  // City-scoped Anmeldung entry points — the moment-zero step.
  'guide-anmeldung-stuttgart',
  'guide-anmeldung-berlin',
  'berlin-buergeramt-locations',
  'buergerbuero-munich',
  'frankfurt-buergerservice',
  'karlsruhe-buergerservice',
  'mannheim-buergerdienste',
  // Country-scoped 30-day essentials.
  'guide-health-insurance-gkv-pkv',
  'guide-steuererklaerung-basics',
  'guide-eu-blue-card',
];

async function promoteToCountry(): Promise<number> {
  const res = await prisma.resource.updateMany({
    where: { slug: { in: [...COUNTRY_SCOPE_SLUGS] } },
    data: { scope: 'COUNTRY', scopeRegion: 'DE', cityId: null },
  });
  return res.count;
}

async function collapseDuplicates(): Promise<{ kept: number; dropped: number }> {
  let kept = 0;
  let dropped = 0;
  for (const group of DUPLICATE_GROUPS) {
    const keepUpdate = await prisma.resource.updateMany({
      where: { slug: group.keep },
      data: { scope: 'COUNTRY', scopeRegion: 'DE', cityId: null },
    });
    kept += keepUpdate.count;
    const dropRes = await prisma.resource.deleteMany({
      where: { slug: { in: [...group.drop] } },
    });
    dropped += dropRes.count;
  }
  return { kept, dropped };
}

async function tagConsulates(): Promise<number> {
  let updated = 0;
  for (const tag of CONSULATE_TAGS) {
    const row = await prisma.resource.findUnique({
      where: { slug: tag.slug },
      select: { metadata: true },
    });
    if (!row) continue;
    const merged: Prisma.JsonObject = {
      ...((row.metadata as Prisma.JsonObject | null) ?? {}),
      consulate: tag.consulate,
    };
    await prisma.resource.update({
      where: { slug: tag.slug },
      data: {
        metadata: merged,
        scope: 'COUNTRY',
        scopeRegion: 'DE',
        cityId: null,
      },
    });
    updated++;
  }
  return updated;
}

async function markEssentials(): Promise<number> {
  const res = await prisma.resource.updateMany({
    where: { slug: { in: [...ESSENTIAL_SLUGS] } },
    data: { isEssential: true, priority: 80 },
  });
  return res.count;
}

async function main() {
  console.log('🧹 Dedupe & re-scope resources — PRD/TDD-0030 Phase A.1\n');
  const promoted = await promoteToCountry();
  console.log(`   ↗  promoted to COUNTRY: ${promoted}`);
  const { kept, dropped } = await collapseDuplicates();
  console.log(`   🪓  duplicate groups: kept ${kept}, dropped ${dropped}`);
  const consulates = await tagConsulates();
  console.log(`   🏛  consulate tagging: ${consulates}`);
  const essentials = await markEssentials();
  console.log(`   ⭐  essentials marked: ${essentials}`);
  console.log('\n✅ Dedupe complete.');
}

const isDirectRun =
  typeof require !== 'undefined' && require.main === module
    ? true
    : process.argv[1]?.endsWith('dedupe_resources_v2.ts') ||
      process.argv[1]?.endsWith('dedupe_resources_v2.js');

if (isDirectRun) {
  main()
    .catch((e) => {
      console.error('❌ Dedupe failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { main as runDedupeResourcesV2 };
