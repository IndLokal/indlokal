import Link from 'next/link';
import { db } from '@/lib/db';
import { approvePipelineItem, rejectPipelineItem, batchApprovePipelineItems } from './actions';
import RunPipelineButton from './RunPipelineButton';
import type { ExtractedEvent, ExtractedCommunity } from '@/modules/pipeline/types';

export const metadata = { title: 'Content Pipeline — Admin' };

export default async function AdminPipelinePage() {
  const items = await db.pipelineItem.findMany({
    where: { status: 'PENDING' },
    include: { city: { select: { name: true, slug: true } } },
    orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
  });

  const highConfidence = items.filter((i) => i.confidence >= 0.85);
  const needsReview = items.filter((i) => i.confidence < 0.85);

  const recentlyProcessed = await db.pipelineItem.findMany({
    where: { status: { in: ['APPROVED', 'REJECTED'] } },
    include: { city: { select: { name: true } } },
    orderBy: { reviewedAt: 'desc' },
    take: 10,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content Pipeline</h1>
          <p className="text-muted mt-1 text-sm">
            {items.length} items pending review · AI-extracted from configured sources
          </p>
        </div>
        <div className="flex items-center gap-4">
          <RunPipelineButton />
          <Link
            href="/admin"
            className="text-brand-600 hover:text-brand-700 text-sm hover:underline"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      {/* ─── High confidence batch approve ─── */}
      {highConfidence.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-green-700">
              ✅ High Confidence ({highConfidence.length})
            </h2>
            <form action={batchApprovePipelineItems}>
              <input type="hidden" name="ids" value={highConfidence.map((i) => i.id).join(',')} />
              <button
                type="submit"
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Approve All High Confidence
              </button>
            </form>
          </div>
          <div className="mt-4 space-y-4">
            {highConfidence.map((item) => (
              <PipelineItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* ─── Needs review ─── */}
      {needsReview.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-amber-700">
            ⚠️ Needs Review ({needsReview.length})
          </h2>
          <div className="mt-4 space-y-4">
            {needsReview.map((item) => (
              <PipelineItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {items.length === 0 && (
        <p className="text-muted mt-12 text-center">
          No items in the review queue. Run the pipeline to fetch new content.
        </p>
      )}

      {/* ─── Recent history ─── */}
      {recentlyProcessed.length > 0 && (
        <section className="mt-12">
          <h2 className="text-muted text-lg font-semibold">Recently Processed</h2>
          <div className="mt-4 space-y-2">
            {recentlyProcessed.map((item) => {
              const data = item.extractedData as unknown as ExtractedEvent | ExtractedCommunity;
              const name =
                data.type === 'EVENT'
                  ? (data as ExtractedEvent).title
                  : (data as ExtractedCommunity).name;
              return (
                <div
                  key={item.id}
                  className="border-border/50 flex items-center justify-between rounded-[var(--radius-button)] border px-4 py-2 text-sm"
                >
                  <div>
                    <span
                      className={item.status === 'APPROVED' ? 'text-green-600' : 'text-red-500'}
                    >
                      {item.status === 'APPROVED' ? '✓' : '✗'}
                    </span>{' '}
                    <span className="font-medium">{name}</span>
                    <span className="text-muted ml-2">
                      {item.entityType} · {item.city.name}
                    </span>
                  </div>
                  <span className="text-muted text-xs">
                    {item.reviewedAt?.toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Pipeline item card component ──────────────────────

type PipelineItemWithCity = Awaited<
  ReturnType<
    typeof db.pipelineItem.findMany<{ include: { city: { select: { name: true; slug: true } } } }>
  >
>[number];

function PipelineItemCard({ item }: { item: PipelineItemWithCity }) {
  const data = item.extractedData as unknown as ExtractedEvent | ExtractedCommunity;
  const isEvent = data.type === 'EVENT';
  const event = isEvent ? (data as ExtractedEvent) : null;
  const community = !isEvent ? (data as ExtractedCommunity) : null;

  const confidenceColor =
    item.confidence >= 0.85
      ? 'bg-green-100 text-green-800'
      : item.confidence >= 0.6
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800';

  return (
    <div className="card-base p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Title + type badge */}
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                isEvent ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
              }`}
            >
              {item.entityType}
            </span>
            <h3 className="font-semibold">{event?.title ?? community?.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceColor}`}>
              {Math.round(item.confidence * 100)}%
            </span>
          </div>

          {/* Event details */}
          {event && (
            <div className="text-muted mt-1.5 space-y-0.5 text-sm">
              {event.date && (
                <p>
                  📅 {event.date}
                  {event.time && ` at ${event.time}`}
                  {event.endTime && ` — ${event.endTime}`}
                </p>
              )}
              {event.venueName && (
                <p>
                  📍 {event.venueName}
                  {event.venueAddress && ` · ${event.venueAddress}`}
                </p>
              )}
              {event.hostCommunity && <p>👥 {event.hostCommunity}</p>}
              {event.isFree !== null && (
                <p>{event.isFree ? '🆓 Free' : `💰 ${event.cost ?? 'Paid'}`}</p>
              )}
            </div>
          )}

          {/* Community details */}
          {community && (
            <div className="text-muted mt-1.5 space-y-0.5 text-sm">
              {community.description && <p>{community.description}</p>}
              {community.languages.length > 0 && <p>🗣️ {community.languages.join(', ')}</p>}
            </div>
          )}

          {/* Description */}
          {(event?.description ?? community?.description) && (
            <p className="text-muted mt-2 line-clamp-2 text-sm">
              {event?.description ?? community?.description}
            </p>
          )}

          {/* Categories */}
          {(event?.categories ?? community?.categories ?? []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {(event?.categories ?? community?.categories ?? []).map((cat) => (
                <span
                  key={cat}
                  className="bg-brand-50 text-brand-700 rounded-full px-2 py-0.5 text-xs"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}

          {/* Source info */}
          <p className="text-muted mt-2 text-xs">
            Source: {item.sourceType}
            {item.sourceUrl && (
              <>
                {' · '}
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-500 hover:underline"
                >
                  View source ↗
                </a>
              </>
            )}
            {' · '}
            {item.city.name}
            {item.matchedEntityId && (
              <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
                ⚠️ Possible duplicate (match: {Math.round((item.matchScore ?? 0) * 100)}%)
              </span>
            )}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 flex-col gap-2">
          <form action={approvePipelineItem}>
            <input type="hidden" name="id" value={item.id} />
            <button
              type="submit"
              className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Approve
            </button>
          </form>
          <form action={rejectPipelineItem}>
            <input type="hidden" name="id" value={item.id} />
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
  );
}
