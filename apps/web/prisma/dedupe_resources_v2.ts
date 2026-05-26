/**
 * Dedupe & re-scope resources - PRD/TDD-0030 Phase A.1.
 *
 * **Fresh-DB note:** For environments that apply the migrations from
 * scratch, this script is a no-op - the seed in `prisma/resources.ts`
 * already produces correctly-scoped rows. This script exists for
 * environments that were seeded BEFORE the v2 model landed and now need
 * their existing rows re-shaped in place.
 *
 * Source of truth is `RESOURCE_DEFS` in `prisma/resources.ts`: scope,
 * consulate tagging, essentials and title rewrites are all authored
 * inline on each entry. This script just replays those intents as
 * UPDATEs against the existing rows.
 *
 * Idempotent. Safe to re-run.
 *
 * Run manually:   pnpm --filter web tsx prisma/dedupe_resources_v2.ts
 */

import { PrismaClient, type Prisma } from '@prisma/client';
import { DUPLICATE_SLUGS } from './resource-classification';
import { RESOURCE_DEFS } from './resources';

const prisma = new PrismaClient();

const COUNTRY_SLUGS = RESOURCE_DEFS.filter((e) => e.scope === 'COUNTRY').map((e) => e.slug);
const CONSULATE_ENTRIES = RESOURCE_DEFS.filter((e) => e.consulate).map((e) => ({
  slug: e.slug,
  consulate: e.consulate!,
}));
const ESSENTIAL_SLUGS = RESOURCE_DEFS.filter((e) => e.isEssential).map((e) => e.slug);
const TITLE_REWRITE_ENTRIES = RESOURCE_DEFS.filter(
  (e) => e.slug === 'guide-116117-doctor-on-duty-munich',
).map((e) => ({ slug: e.slug, title: e.title, description: e.description }));

async function promoteToCountry(): Promise<number> {
  if (COUNTRY_SLUGS.length === 0) return 0;
  const res = await prisma.resource.updateMany({
    where: { slug: { in: COUNTRY_SLUGS } },
    data: { scope: 'COUNTRY', scopeRegion: 'DE', cityId: null },
  });
  return res.count;
}

async function dropDuplicates(): Promise<number> {
  const res = await prisma.resource.deleteMany({
    where: { slug: { in: DUPLICATE_SLUGS.map((d) => d.slug) } },
  });
  return res.count;
}

async function applyTitleRewrites(): Promise<number> {
  let updated = 0;
  for (const rw of TITLE_REWRITE_ENTRIES) {
    const r = await prisma.resource.updateMany({
      where: { slug: rw.slug },
      data: { title: rw.title, description: rw.description },
    });
    updated += r.count;
  }
  return updated;
}

async function tagConsulates(): Promise<number> {
  let updated = 0;
  for (const { slug, consulate } of CONSULATE_ENTRIES) {
    const row = await prisma.resource.findUnique({
      where: { slug },
      select: { metadata: true },
    });
    if (!row) continue;
    const merged: Prisma.JsonObject = {
      ...((row.metadata as Prisma.JsonObject | null) ?? {}),
      consulate,
    };
    await prisma.resource.update({
      where: { slug },
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
  if (ESSENTIAL_SLUGS.length === 0) return 0;
  const res = await prisma.resource.updateMany({
    where: { slug: { in: ESSENTIAL_SLUGS } },
    data: { isEssential: true, priority: 80, lifecycleStage: ['FIRST_30_DAYS'] },
  });
  return res.count;
}

async function main() {
  console.log('🧹 Dedupe & re-scope resources - PRD/TDD-0030 Phase A.1\n');
  const promoted = await promoteToCountry();
  console.log(`   ↗  promoted to COUNTRY: ${promoted}`);
  const dropped = await dropDuplicates();
  console.log(`   🪓  duplicate rows dropped: ${dropped}`);
  const rewritten = await applyTitleRewrites();
  console.log(`   ✎  title rewrites applied: ${rewritten}`);
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
