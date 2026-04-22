import Link from 'next/link';
import { db } from '@/lib/db';
import {
  approveKeywordSuggestion,
  approvePipelineItem,
  batchApprovePipelineItems,
  rejectKeywordSuggestion,
  rejectPipelineItem,
  revertAutoApprovedItems,
  runEnrichmentPass,
  runKeywordExpansionPass,
  runRelationshipInference,
} from './actions';
import RunPipelineButton from './RunPipelineButton';
import { getSourceReliabilityStats } from '@/modules/pipeline';
import type { ExtractedEvent, ExtractedCommunity } from '@/modules/pipeline';

export const metadata = { title: 'Content Pipeline — Admin' };

export default async function AdminPipelinePage() {
  const sourceStats = await getSourceReliabilityStats();
  const items = await db.pipelineItem.findMany({
    where: { status: 'PENDING' },
    include: { city: { select: { name: true, slug: true } } },
    orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
  });

  const autoApprovedItems = await db.pipelineItem.findMany({
    where: { autoApproved: true, status: 'APPROVED' },
    include: { city: { select: { name: true } } },
    orderBy: { reviewedAt: 'desc' },
    take: 10,
  });

  const keywordSuggestions = await db.keywordSuggestion.findMany({
    where: { status: 'PENDING' },
    orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
    take: 12,
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

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <form action={runEnrichmentPass} className="card-base p-4">
          <h2 className="font-semibold">Enrichment</h2>
          <p className="text-muted mt-1 text-sm">Queue sparse-community enrichment suggestions.</p>
          <button type="submit" className="btn-secondary mt-4 w-full">
            Run Enrichment
          </button>
        </form>
        <form action={runRelationshipInference} className="card-base p-4">
          <h2 className="font-semibold">Relationships</h2>
          <p className="text-muted mt-1 text-sm">Infer same-organizer and sister-chapter edges.</p>
          <button type="submit" className="btn-secondary mt-4 w-full">
            Infer Relationships
          </button>
        </form>
        <form action={runKeywordExpansionPass} className="card-base p-4">
          <h2 className="font-semibold">Keywords</h2>
          <p className="text-muted mt-1 text-sm">
            Generate new search keyword suggestions from approved items.
          </p>
          <button type="submit" className="btn-secondary mt-4 w-full">
            Generate Keywords
          </button>
        </form>
        {autoApprovedItems.length > 0 && (
          <form action={revertAutoApprovedItems} className="card-base p-4">
            <h2 className="font-semibold">Auto-Approve</h2>
            <p className="text-muted mt-1 text-sm">
              Revert the latest auto-approved items back into review.
            </p>
            <input
              type="hidden"
              name="ids"
              value={autoApprovedItems.map((item) => item.id).join(',')}
            />
            <button
              type="submit"
              className="mt-4 w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Revert Recent Auto-Approvals
            </button>
          </form>
        )}
      </section>

      {sourceStats.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Source Reliability</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sourceStats.map((stat) => (
              <div key={stat.sourceType} className="card-base p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">{stat.sourceType}</h3>
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
                  Approval rate: {Math.round(stat.approvalRate * 100)}% · Reviewed:{' '}
                  {stat.totalReviewed}
                </p>
                <p className="text-muted mt-1 text-xs">
                  Approved {stat.approved} · Rejected {stat.rejected} · Pending {stat.pending} ·
                  Merged {stat.merged}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {keywordSuggestions.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Keyword Suggestions</h2>
          <div className="mt-4 space-y-3">
            {keywordSuggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="card-base flex items-center justify-between gap-4 p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{suggestion.keyword}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-muted mt-1 text-sm">
                    Seen in {suggestion.sourceCount} approved items
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={approveKeywordSuggestion}>
                    <input type="hidden" name="id" value={suggestion.id} />
                    <button
                      type="submit"
                      className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Approve
                    </button>
                  </form>
                  <form action={rejectKeywordSuggestion}>
                    <input type="hidden" name="id" value={suggestion.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {autoApprovedItems.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-sky-700">Auto-Approved</h2>
          <div className="mt-4 space-y-2">
            {autoApprovedItems.map((item) => {
              const data = item.extractedData as unknown as ExtractedEvent | ExtractedCommunity;
              const name = data.type === 'EVENT' ? data.title : data.name;
              return (
                <div
                  key={item.id}
                  className="border-border/50 flex items-center justify-between rounded-[var(--radius-button)] border px-4 py-2 text-sm"
                >
                  <div>
                    <span className="text-sky-600">⚡</span>{' '}
                    <span className="font-medium">{name}</span>
                    <span className="text-muted ml-2">
                      {item.entityType} · {item.city.name}
                    </span>
                    {item.autoApprovalReason && (
                      <span className="text-muted ml-2 text-xs">({item.autoApprovalReason})</span>
                    )}
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
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
              {item.reviewKind}
            </span>
            <h3 className="font-semibold">{event?.title ?? community?.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceColor}`}>
              {Math.round(item.confidence * 100)}%
            </span>
            {item.autoApproved && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                AUTO
              </span>
            )}
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
            {item.reviewKind === 'ENRICHMENT' && item.targetEntityId && (
              <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">
                Suggestion for existing community
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
