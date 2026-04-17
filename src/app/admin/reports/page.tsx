import Link from 'next/link';
import { db } from '@/lib/db';
import { format } from 'date-fns';
import { reviewReport, resolveReport } from '../actions';

const REPORT_TYPE_LABELS: Record<string, string> = {
  STALE_INFO: 'Stale info',
  BROKEN_LINK: 'Broken link',
  INCORRECT_DETAILS: 'Incorrect details',
  SUGGEST_COMMUNITY: 'Suggest community',
  OTHER: 'Other',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  REVIEWED: 'bg-blue-100 text-blue-700',
  RESOLVED: 'bg-green-100 text-green-700',
};

export default async function AdminReportsPage() {
  const reports = await db.contentReport.findMany({
    where: { status: { not: 'RESOLVED' } },
    orderBy: { createdAt: 'desc' },
    include: {
      community: { select: { name: true, slug: true, city: { select: { slug: true } } } },
      city: { select: { name: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <Link href="/admin" className="text-muted hover:text-foreground text-sm transition-colors">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Reports &amp; Suggestions</h1>
        <p className="text-muted mt-1 text-sm">{reports.length} pending · sorted by newest first</p>
      </div>

      {reports.length === 0 ? (
        <p className="border-border text-muted rounded-[var(--radius-card)] border p-8 text-center">
          No pending reports.
        </p>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="card-base p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[report.status]}`}
                  >
                    {report.status}
                  </span>
                  <span className="bg-muted-bg text-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {REPORT_TYPE_LABELS[report.reportType] ?? report.reportType}
                  </span>
                  <span className="text-muted text-xs">
                    {format(new Date(report.createdAt), 'MMM d, yyyy · h:mm a')}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {report.status === 'PENDING' && (
                    <form action={reviewReport}>
                      <input type="hidden" name="id" value={report.id} />
                      <button
                        type="submit"
                        className="border-border hover:bg-muted-bg rounded-[var(--radius-button)] border px-3 py-1.5 text-xs font-medium"
                      >
                        Mark reviewed
                      </button>
                    </form>
                  )}
                  <form action={resolveReport}>
                    <input type="hidden" name="id" value={report.id} />
                    <button
                      type="submit"
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                    >
                      Resolve
                    </button>
                  </form>
                </div>
              </div>

              {/* Subject */}
              <div className="mt-3">
                {report.reportType === 'SUGGEST_COMMUNITY' ? (
                  <p className="text-foreground font-medium">
                    Suggested: &ldquo;{report.suggestedName}&rdquo;
                    {report.city && (
                      <span className="text-muted ml-2 text-sm font-normal">
                        in {report.city.name}
                      </span>
                    )}
                  </p>
                ) : report.community ? (
                  <a
                    href={`/${report.community.city?.slug}/communities/${report.community.slug}`}
                    className="text-brand-700 font-medium hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {report.community.name} ↗
                  </a>
                ) : (
                  <span className="text-muted text-sm">No community linked</span>
                )}
              </div>

              {/* Details */}
              {report.details && (
                <p className="text-foreground mt-2 text-sm leading-relaxed">{report.details}</p>
              )}

              {/* Reporter email */}
              {report.reporterEmail && (
                <p className="text-muted mt-2 text-xs">
                  From:{' '}
                  <a href={`mailto:${report.reporterEmail}`} className="hover:underline">
                    {report.reporterEmail}
                  </a>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
