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
import { getEnabledRegions, getKeywordStrategies, getPinnedStrategies } from './config';
import { getDbCommunityStrategies } from './db-sources';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('╔══════════════════════════════════════════╗');
  console.log('║  IndLokal AI Content Pipeline          ║');
  console.log('║  Generic-first · Two-stage LLM           ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`Mode: ${dryRun ? 'DRY RUN (config preview)' : 'LIVE'}`);

  // Check required env vars
  if (!process.env.OPENAI_API_KEY) {
    console.error('\n❌ OPENAI_API_KEY is required. Set it in .env or environment.');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('\n❌ DATABASE_URL is required. Set it in .env or environment.');
    process.exit(1);
  }

  const regions = getEnabledRegions();
  const keywordStrategies = getKeywordStrategies();
  const pinnedStrategies = getPinnedStrategies();

  console.log(`\n📍 Regions (${regions.length}):`);
  for (const r of regions) {
    console.log(`   • ${r.label} — cities: ${r.citySlugs.join(', ')}`);
  }

  console.log(`\n🔍 Keyword strategies (${keywordStrategies.length}):`);
  for (const s of keywordStrategies) {
    console.log(`   • ${s.label} — ${s.keywords.length} keywords, ${s.radiusKm}km radius`);
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
  const result = await runPipeline();

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

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
