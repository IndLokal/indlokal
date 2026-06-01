import { db } from '@/lib/db';
import { approveEvent, rejectEvent } from '../actions';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Review Events - Admin' };

const SOURCE_LABELS: Record<string, string> = {
  USER_SUGGESTED: 'Host submission',
  PUBLIC_SUBMITTED: 'Public submission',
  AMBASSADOR_SUBMITTED: 'Ambassador',
  AI_GENERATED: 'AI pipeline',
  COMMUNITY_SUBMITTED: 'Community',
};

export default async function AdminEventsReviewPage() {
  const events = await db.event.findMany({
    where: { moderationState: 'PENDING_REVIEW' },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      startsAt: true,
      venueName: true,
      venueAddress: true,
      source: true,
      registrationUrl: true,
      city: { select: { name: true } },
      community: { select: { name: true } },
      createdBy: { select: { email: true, displayName: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  type EventRow = (typeof events)[number];

  return (
    <AdminPage>
      <AdminPageHeader
        title="Event Review"
        description={`${events.length} pending review`}
        backHref="/admin"
      />

      {events.length === 0 ? (
        <p className="text-muted mt-12 text-center">No events to review.</p>
      ) : (
        <div className="mt-8 space-y-6">
          {events.map((e: EventRow) => (
            <div key={e.id} className="card-base p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">{e.title}</h2>
                  <p className="text-muted mt-0.5 text-sm">
                    {e.city.name}
                    {e.venueName ? ` · ${e.venueName}` : ''} ·{' '}
                    {new Date(e.startsAt).toLocaleString()}
                  </p>
                  <p className="text-muted mt-1 text-xs tracking-wide uppercase">
                    {SOURCE_LABELS[e.source] ?? e.source}
                    {e.createdBy ? ` · ${e.createdBy.displayName ?? e.createdBy.email}` : ''}
                  </p>

                  {e.description && (
                    <p className="text-foreground mt-2 line-clamp-4 text-sm whitespace-pre-line">
                      {e.description}
                    </p>
                  )}

                  {e.registrationUrl && (
                    <a
                      href={e.registrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm text-[var(--color-primary)] hover:underline"
                    >
                      Registration link ↗
                    </a>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-2">
                  <form action={approveEvent}>
                    <input type="hidden" name="id" value={e.id} />
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Approve
                    </button>
                  </form>
                  <form action={rejectEvent} className="space-y-2">
                    <input type="hidden" name="id" value={e.id} />
                    <input
                      type="text"
                      name="reason"
                      placeholder="Reason (optional)"
                      className="border-border w-48 rounded-lg border px-3 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
