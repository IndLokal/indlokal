import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { getSection17OpsReadout } from '@/modules/resources/ops-readout';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Trust & Freshness Health - Admin' };

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-muted text-xs tracking-wide uppercase">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default async function ResourceOpsReadoutPage() {
  const readout = await getSection17OpsReadout(new Date());

  return (
    <AdminPage>
      <AdminPageHeader
        title="Trust & Freshness Health"
        description={`Generated ${new Date(readout.generatedAt).toLocaleString()} · Last ${readout.lookbackDays} days`}
        backHref="/admin/data/resources"
      />

      <section className="mt-6">
        <h2 className="text-lg font-semibold tracking-tight">Core Metrics</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Stat
            label="Trusted Journey Resource Coverage"
            value={`${readout.trustedJourneyResourceCoveragePct}%`}
          />
          <Stat label="Resources Within TTL" value={`${readout.resourcesWithinTtlPct}%`} />
          <Stat
            label="Resources With Provenance Metadata"
            value={`${readout.resourcesWithProvenanceMetadataPct}%`}
          />
          <Stat label="Stale Exposure Rate" value={`${readout.staleExposureRatePct}%`} />
          <Stat
            label="Outdated Correction Turnaround"
            value={`${readout.outdatedCorrectionTurnaroundDays} days`}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Trust-Band Action Rate</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Stat label="Strong Source" value={`${readout.trustBandActionRatePct.strongSource}%`} />
          <Stat
            label="Source-Supported"
            value={`${readout.trustBandActionRatePct.sourceSupported}%`}
          />
          <Stat
            label="Needs Verification"
            value={`${readout.trustBandActionRatePct.needsVerification}%`}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Risk Alerts</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Stat label="Stale Action Share" value={`${readout.antiMetrics.staleActionSharePct}%`} />
          <Stat
            label="Overdue Reverification Rate"
            value={`${readout.antiMetrics.overdueReverificationRatePct}%`}
          />
          <Stat
            label="Overdue Journey Gap Backlog Rate"
            value={`${readout.antiMetrics.overdueJourneyGapBacklogRatePct}%`}
          />
        </div>
      </section>
    </AdminPage>
  );
}
