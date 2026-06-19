import type { SourceReliabilityStat } from '@/modules/pipeline';

export function SourceReliabilityPanel({ stats }: { stats: SourceReliabilityStat[] }) {
  if (stats.length === 0) return null;

  return (
    <section>
      <h3 className="text-lg font-semibold">Source Reliability</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.key} className="card-base p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold">{stat.sourceType}</h4>
                <p className="text-muted mt-0.5 text-xs">Lane: {stat.lane}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  stat.confidenceAdjustment > 0
                    ? 'bg-green-100 text-green-700'
                    : stat.confidenceAdjustment < 0
                      ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 text-slate-700'
                }`}
              >
                {stat.confidenceAdjustment > 0
                  ? `+${Math.round(stat.confidenceAdjustment * 100)}%`
                  : `${Math.round(stat.confidenceAdjustment * 100)}%`}
              </span>
            </div>
            <p className="text-muted mt-2 text-sm">
              Approval rate: {Math.round(stat.approvalRate * 100)}% · Reviewed: {stat.totalReviewed}
            </p>
            <p className="text-muted mt-1 text-xs">
              Approved {stat.approved} · Rejected {stat.rejected} · Pending {stat.pending} · Merged{' '}
              {stat.merged}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
