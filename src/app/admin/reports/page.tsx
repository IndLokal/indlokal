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
        <h1 className="text-2xl font-bold">Reports &amp; Suggestions</h1>
        <p className="mt-1 text-sm text-gray-500">
          {reports.length} pending · sorted by newest first
        </p>
      </div>

      {reports.length === 0 ? (
        <p className="rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No pending reports.
        </p>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[report.status]}`}
                  >
                    {report.status}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    {REPORT_TYPE_LABELS[report.reportType] ?? report.reportType}
                  </span>
                  <span className="text-xs text-gray-400">
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
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
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
                  <p className="font-medium text-gray-900">
                    Suggested: &ldquo;{report.suggestedName}&rdquo;
                    {report.city && (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        in {report.city.name}
                      </span>
                    )}
                  </p>
                ) : report.community ? (
                  <a
                    href={`/${report.community.city?.slug}/communities/${report.community.slug}`}
                    className="font-medium text-indigo-700 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {report.community.name} ↗
                  </a>
                ) : (
                  <span className="text-sm text-gray-400">No community linked</span>
                )}
              </div>

              {/* Details */}
              {report.details && (
                <p className="mt-2 text-sm leading-relaxed text-gray-700">{report.details}</p>
              )}

              {/* Reporter email */}
              {report.reporterEmail && (
                <p className="mt-2 text-xs text-gray-400">
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
