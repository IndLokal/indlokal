/**
 * CLI script to run the AI content pipeline.
 *
 * Usage:
 *   npx tsx src/modules/pipeline/run.ts            # run full pipeline
 *   npx tsx src/modules/pipeline/run.ts --dry-run  # show config only
 *
 * Requires:
 *   OPENAI_API_KEY     — for LLM extraction
 *   DATABASE_URL       — PostgreSQL connection
 *   EVENTBRITE_API_KEY — (optional) for Eventbrite source
 */

import { runPipeline } from './orchestrator';
import { getDbCommunityStrategies } from './db-sources';
import {
  getRuntimeEnabledRegions,
  getRuntimeKeywordSeeds,
  getRuntimeKeywordStrategies,
  getRuntimePinnedStrategies,
} from './runtime-config';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const strictMode = args.includes('--strict') || process.env.PIPELINE_STRICT === '1';

  console.log('╔══════════════════════════════════════════╗');
  console.log('║  IndLokal AI Content Pipeline          ║');
  console.log('║  Known-source-first · Two-stage LLM      ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`Mode: ${dryRun ? 'DRY RUN (config preview)' : 'LIVE'}`);
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

  const regions = await getRuntimeEnabledRegions();
  const keywordSeeds = await getRuntimeKeywordSeeds();
  const keywordStrategies = await getRuntimeKeywordStrategies();
  const pinnedStrategies = await getRuntimePinnedStrategies();

  console.log(`\n📍 Regions (${regions.length}):`);
  for (const r of regions) {
    console.log(`   • ${r.label} — cities: ${r.citySlugs.join(', ')}`);
  }

  console.log(
    `\n🔍 Keyword templates (${keywordStrategies.length}) · canonical seeds (${keywordSeeds.length}):`,
  );
  for (const s of keywordStrategies) {
    console.log(`   • ${s.label} — ${s.radiusKm}km radius`);
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
    console.log('\n🔍 Dry run — config preview only. Remove --dry-run to execute.');
    process.exit(0);
  }

  console.log('\n🚀 Running pipeline...\n');
  const result = await runPipeline('cli');

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
