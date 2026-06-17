import { getSection17OpsReadout } from '@/modules/resources/ops-readout';
import { db } from '@/lib/db';

function parseArgs(argv: string[]) {
  return { json: argv.includes('--json') };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const readout = await getSection17OpsReadout(new Date());

  if (args.json) {
    console.log(JSON.stringify(readout, null, 2));
    return;
  }

  console.log('\nSection 17 Ops Readout');
  console.log(`Generated: ${readout.generatedAt}`);
  console.log(`Trusted Journey Resource Coverage: ${readout.trustedJourneyResourceCoveragePct}%`);
  console.log(`Resources Within TTL: ${readout.resourcesWithinTtlPct}%`);
  console.log(`Resources With Provenance Metadata: ${readout.resourcesWithProvenanceMetadataPct}%`);
  console.log(`Stale Exposure Rate: ${readout.staleExposureRatePct}%`);
  console.log(`Outdated Correction Turnaround: ${readout.outdatedCorrectionTurnaroundDays} days`);
  console.log('\nTrust-band Action Rate');
  console.log(`Strong Source: ${readout.trustBandActionRatePct.strongSource}%`);
  console.log(`Source-Supported: ${readout.trustBandActionRatePct.sourceSupported}%`);
  console.log(`Needs Verification: ${readout.trustBandActionRatePct.needsVerification}%`);
  console.log('\nAnti-metrics');
  console.log(`Stale Action Share: ${readout.antiMetrics.staleActionSharePct}%`);
  console.log(`Overdue Reverification Rate: ${readout.antiMetrics.overdueReverificationRatePct}%`);
  console.log(
    `Overdue Journey Gap Backlog Rate: ${readout.antiMetrics.overdueJourneyGapBacklogRatePct}%`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
