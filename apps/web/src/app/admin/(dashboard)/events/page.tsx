import { db } from '@/lib/db';
import { getSourceLabel } from '@/lib/content/source-labels';
import { approveEvent, rejectEvent } from '../actions';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { ConfirmSubmitButton } from '@/components/ui';
import { formatEventDateTimeMedium, DEFAULT_EVENT_TIMEZONE } from '@/lib/datetime/event-timezone';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Review Events - Admin' };

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
      city: { select: { name: true, timezone: true } },
      community: { select: { name: true } },
      createdBy: { select: { email: true, displayName: true } },
      metadata: true,
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
              {(() => {
                const metadata = (e.metadata ?? {}) as Record<string, unknown>;
                const verificationMode =
                  typeof metadata.verificationMode === 'string'
                    ? metadata.verificationMode
                    : undefined;
                const verificationDetails =
                  typeof metadata.verificationDetails === 'string'
                    ? metadata.verificationDetails
                    : undefined;
                const sourceUrl =
                  typeof metadata.sourceUrl === 'string' ? metadata.sourceUrl : null;
                const suggestedBy =
                  typeof metadata.suggestedBy === 'string' ? metadata.suggestedBy : null;

                return (
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold">{e.title}</h2>
                      <p className="text-muted mt-0.5 text-sm">
                        {e.city.name}
                        {e.venueName ? ` · ${e.venueName}` : ''} ·{' '}
                        {formatEventDateTimeMedium(
                          new Date(e.startsAt),
                          e.city.timezone ?? DEFAULT_EVENT_TIMEZONE,
                        )}
                      </p>
                      <p className="text-muted mt-1 text-xs tracking-wide uppercase">
                        {getSourceLabel(e.source)}
                        {e.createdBy ? ` · ${e.createdBy.displayName ?? e.createdBy.email}` : ''}
                        {suggestedBy ? ` · submitted by ${suggestedBy}` : ''}
                      </p>

                      {(verificationMode || sourceUrl || verificationDetails) && (
                        <div className="mt-3 rounded-[var(--radius-button)] border border-slate-200 bg-slate-50 p-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-900">Verification</span>
                            {verificationMode === 'manual_context' ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                Manual review required
                              </span>
                            ) : verificationMode === 'public_link' ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                                Public link provided
                              </span>
                            ) : null}
                          </div>

                          {sourceUrl && (
                            <p className="mt-2 text-slate-700">
                              Source link:{' '}
                              <a
                                href={sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--color-primary)] hover:underline"
                              >
                                Open verification source ↗
                              </a>
                            </p>
                          )}

                          {verificationDetails && (
                            <div className="mt-2">
                              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                Verification details
                              </p>
                              <p className="mt-1 whitespace-pre-line text-slate-700">
                                {verificationDetails}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

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
                        <ConfirmSubmitButton
                          triggerLabel="Approve"
                          title="Approve this event?"
                          description="The event will become visible in published listings."
                          confirmLabel="Approve event"
                          tone="primary"
                          triggerClassName="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                        />
                      </form>
                      <form action={rejectEvent} className="space-y-2">
                        <input type="hidden" name="id" value={e.id} />
                        <input
                          type="text"
                          name="reason"
                          placeholder="Reason (optional)"
                          className="border-border w-48 rounded-lg border px-3 py-2 text-sm"
                        />
                        <ConfirmSubmitButton
                          triggerLabel="Reject"
                          title="Reject this event?"
                          description="This will keep the event out of published listings."
                          confirmLabel="Reject event"
                          tone="danger"
                          triggerClassName="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        />
                      </form>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
