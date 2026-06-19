/**
 * CLI script to run the AI content pipeline.
 *
 * Usage:
 *   npx tsx src/modules/pipeline/run.ts            # run full pipeline
 *   npx tsx src/modules/pipeline/run.ts --dry-run  # show config only
 *
 * Requires:
 *   OPENAI_API_KEY     - for LLM extraction
 *   DATABASE_URL       - PostgreSQL connection
 *   EVENTBRITE_API_KEY - (optional) for Eventbrite source
 *   GOOGLE_CSE_API_KEY - (optional) for Google Custom Search
 *   GOOGLE_CSE_COMMUNITY_ID / GOOGLE_CSE_EVENT_ID / GOOGLE_CSE_RESOURCE_ID
 *                      - (optional) lane-specific Google CSE IDs
 */

import { db } from '@/lib/db';
import { runPipeline } from './orchestrator';
import { getDbCommunityStrategies } from './fetch/db-sources';
import {
  getRuntimeEnabledRegions,
  getRuntimeLaneKeywordSeeds,
  getRuntimeKeywordStrategies,
  getRuntimePinnedStrategies,
} from './config/runtime-config';
import type { SearchRegion } from './types';

function parseListArg(args: string[], key: '--city' | '--region'): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === key) {
      const next = args[i + 1];
      if (next && !next.startsWith('--')) values.push(next);
      continue;
    }
    if (arg.startsWith(`${key}=`)) values.push(arg.slice(key.length + 1));
  }
  return values
    .flatMap((raw) => raw.split(','))
    .map((v) => v.trim())
    .filter(Boolean);
}

function filterRegionsForPreview(
  regions: SearchRegion[],
  opts: { citySlugs: string[]; regionIds: string[] },
): SearchRegion[] {
  const regionIds = new Set(opts.regionIds);
  const citySlugs = new Set(opts.citySlugs);
  if (regionIds.size === 0 && citySlugs.size === 0) return regions;

  return regions
    .filter((region) => {
      const regionMatch = regionIds.size > 0 && regionIds.has(region.id);
      const cityMatch = citySlugs.size > 0 && region.citySlugs.some((slug) => citySlugs.has(slug));
      return regionMatch || cityMatch;
    })
    .map((region) => ({
      ...region,
      citySlugs:
        citySlugs.size > 0
          ? region.citySlugs.filter((slug) => citySlugs.has(slug))
          : region.citySlugs,
    }))
    .filter((region) => region.citySlugs.length > 0);
}

/** Verify schema readiness before pipeline execution. */
async function checkSchemaReadiness(): Promise<void> {
  try {
    // Test critical pipeline tables and columns exist
    await db.$queryRaw`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'keyword_suggestions' AND column_name = 'lane'
      LIMIT 1
    `;
  } catch (err) {
    console.error('\n❌ Database schema is not in sync with Prisma schema.');
    console.error('   Run: pnpm -F web db:push');
    console.error('   Then: pnpm -F web pipeline\n');
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const strictMode = args.includes('--strict') || process.env.PIPELINE_STRICT === '1';
  const citySlugs = parseListArg(args, '--city');
  const regionIds = parseListArg(args, '--region');

  console.log('╔══════════════════════════════════════════╗');
  console.log('║  IndLokal AI Content Pipeline          ║');
  console.log('║  Known-source-first · Two-stage LLM      ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`Mode: ${dryRun ? 'DRY RUN (config preview)' : 'LIVE'}`);
  if (citySlugs.length > 0 || regionIds.length > 0) {
    console.log(
      `Scope: ${regionIds.length > 0 ? `regions=${regionIds.join(', ')}` : ''}${regionIds.length > 0 && citySlugs.length > 0 ? ' · ' : ''}${citySlugs.length > 0 ? `cities=${citySlugs.join(', ')}` : ''}`,
    );
  }
  if (!dryRun) {
    console.log(
      `Exit behavior: ${strictMode ? 'STRICT (non-zero on pipeline errors)' : 'TOLERANT (warnings do not fail run)'}`,
    );
  }

  // Check required env vars
  if (!process.env.OPENAI_API_KEY) {
    console.error('\n❌ OPENAI_API_KEY is required. Set it in .env or environment.');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('\n❌ DATABASE_URL is required. Set it in .env or environment.');
    process.exit(1);
  }

  // Check schema readiness before proceeding
  await checkSchemaReadiness();

  const regions = filterRegionsForPreview(await getRuntimeEnabledRegions(), {
    citySlugs,
    regionIds,
  });
  if (regions.length === 0) {
    console.error('\n❌ No regions matched the requested --city/--region scope.');
    process.exit(1);
  }
  const laneKeywordSeeds = await getRuntimeLaneKeywordSeeds();
  const keywordStrategies = await getRuntimeKeywordStrategies();
  const pinnedStrategies = await getRuntimePinnedStrategies();

  console.log(`\n📍 Regions (${regions.length}):`);
  for (const r of regions) {
    console.log(`   • ${r.label} - cities: ${r.citySlugs.join(', ')}`);
  }

  const seedCount = Object.values(laneKeywordSeeds.byLane).reduce(
    (total, keywords) => total + (keywords?.length ?? 0),
    0,
  );
  console.log(`\n🔍 Keyword templates (${keywordStrategies.length}) · lane seeds (${seedCount}):`);
  for (const s of keywordStrategies) {
    console.log(`   • ${s.label} - ${s.radiusKm}km radius`);
  }

  console.log(`\n📌 Pinned URLs (${pinnedStrategies.length} static):`);
  for (const s of pinnedStrategies) {
    console.log(`   • ${s.label}${s.hintCitySlug ? ` (${s.hintCitySlug})` : ''}`);
  }

  const dbStrategies = await getDbCommunityStrategies();
  console.log(`\n🗄️  DB community sources (${dbStrategies.length}):`);
  for (const s of dbStrategies) {
    console.log(`   • ${s.label} → ${s.url}${s.hintCitySlug ? ` (${s.hintCitySlug})` : ''}`);
  }

  if (dryRun) {
    console.log('\n🔍 Dry run - config preview only. Remove --dry-run to execute.');
    process.exit(0);
  }

  console.log('\n🚀 Running pipeline...\n');
  const result = await runPipeline(
    'cli',
    citySlugs.length > 0 || regionIds.length > 0
      ? {
          citySlugs: citySlugs.length > 0 ? citySlugs : undefined,
          regionIds: regionIds.length > 0 ? regionIds : undefined,
        }
      : undefined,
  );

  console.log('\n═══════════════════════════════════════');
  console.log('Pipeline Run Summary');
  console.log('═══════════════════════════════════════');
  console.log(`  Regions scanned:      ${result.regionsScanned}`);
  console.log(`  Sources processed:    ${result.sourcesProcessed}`);
  console.log(`  Items fetched:        ${result.itemsFetched}`);
  console.log(`  Passed filter:        ${result.itemsPassedFilter}`);
  console.log(`  Items extracted:      ${result.itemsExtracted}`);
  console.log(`  Items queued:         ${result.itemsQueued}`);
  console.log(`  Duplicates skipped:   ${result.itemsSkippedDuplicate}`);
  console.log(`  No city (skipped):    ${result.itemsSkippedNoCity}`);
  console.log(`  LLM calls:            ${result.llmCalls}`);
  console.log(`  Est. tokens:          ${result.llmTokensEstimate}`);
  console.log(`  Errors:               ${result.errors.length}`);
  console.log(`  Duration:             ${result.duration}ms`);

  console.log('\nLane outcomes:');
  for (const lane of ['EVENT', 'COMMUNITY', 'RESOURCE', 'UNKNOWN'] as const) {
    const metrics = result.laneBreakdown[lane];
    console.log(
      `  ${lane.padEnd(10)} fetched ${String(metrics.fetched).padStart(3)} | filter ${String(metrics.passedFilter).padStart(3)} | extracted ${String(metrics.extracted).padStart(3)} | queued ${String(metrics.queued).padStart(3)} | dupes ${String(metrics.duplicates).padStart(3)} | no-city ${String(metrics.noCity).padStart(3)} | past ${String(metrics.past).padStart(3)}`,
    );
  }

  if (result.stageTimings && Object.keys(result.stageTimings).length > 0) {
    console.log('\nStage timings:');
    for (const [stage, duration] of Object.entries(result.stageTimings)) {
      console.log(`  ${stage.padEnd(18)} ${duration}ms`);
    }
  }

  if (result.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    for (const err of result.errors) {
      console.log(`   • ${err}`);
    }
  }

  if (result.itemsQueued > 0) {
    console.log(
      `\n✅ ${result.itemsQueued} items added to review queue. Visit /admin/pipeline to review.`,
    );
  } else {
    console.log('\nNo new items to queue.');
  }

  if (result.errors.length > 0 && strictMode) {
    console.log('\n❌ Strict mode enabled: exiting with non-zero status due to pipeline errors.');
    process.exit(1);
  }

  if (result.errors.length > 0 && !strictMode) {
    console.log(
      '\n⚠️  Completed with warnings (exit code 0). Use --strict or PIPELINE_STRICT=1 to fail on warnings.',
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
