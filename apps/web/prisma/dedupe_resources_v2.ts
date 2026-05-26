/**
 * Dedupe & re-scope resources — PRD/TDD-0030 Phase A.1.
 *
 * **Fresh-DB note:** For environments that apply the migrations from
 * scratch, this script is a no-op — the seed in `prisma/resources.ts`
 * already produces correctly-scoped rows by consuming the same
 * `resource-classification.ts`. This script exists for environments that
 * were seeded BEFORE the v2 model landed and now need their existing rows
 * re-shaped in place.
 *
 * Idempotent. Safe to re-run.
 *
 * Run manually:   pnpm --filter web tsx prisma/dedupe_resources_v2.ts
 */

import { PrismaClient, type Prisma } from '@prisma/client';
import {
  CONSULATE_TAGS,
  COUNTRY_SCOPE_SLUGS,
  DUPLICATE_SLUGS,
  ESSENTIAL_SLUGS,
  TITLE_REWRITES,
} from './resource-classification';

const prisma = new PrismaClient();

async function promoteToCountry(): Promise<number> {
  const res = await prisma.resource.updateMany({
    where: { slug: { in: [...COUNTRY_SCOPE_SLUGS] } },
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
  for (const [slug, rewrite] of Object.entries(TITLE_REWRITES)) {
    const r = await prisma.resource.updateMany({
      where: { slug },
      data: { title: rewrite.title, description: rewrite.description },
    });
    updated += r.count;
  }
  return updated;
}

async function tagConsulates(): Promise<number> {
  let updated = 0;
  for (const [slug, consulate] of Object.entries(CONSULATE_TAGS)) {
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
