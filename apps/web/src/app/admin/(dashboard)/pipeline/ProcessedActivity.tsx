import { db } from '@/lib/db';
import type { ExtractedCommunity, ExtractedEvent, ExtractedResource } from '@/modules/pipeline';

type ProcessedPipelineItem = Awaited<
  ReturnType<typeof db.pipelineItem.findMany<{ include: { city: { select: { name: true } } } }>>
>[number];

function entityName(item: ProcessedPipelineItem): string {
  const data = item.extractedData as unknown as
    | ExtractedEvent
    | ExtractedCommunity
    | ExtractedResource;
  if (data.type === 'EVENT') return (data as ExtractedEvent).title;
  if (data.type === 'COMMUNITY') return (data as ExtractedCommunity).name;
  return (data as ExtractedResource).title;
}

export function ProcessedActivity({
  autoApproved,
  recentlyProcessed,
}: {
  autoApproved: ProcessedPipelineItem[];
  recentlyProcessed: ProcessedPipelineItem[];
}) {
  if (autoApproved.length === 0 && recentlyProcessed.length === 0) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {autoApproved.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-sky-700">Auto-Approved</h3>
          <div className="mt-3 space-y-2">
            {autoApproved.map((item) => (
              <div
                key={item.id}
                className="border-border/50 flex items-center justify-between gap-3 rounded-[var(--radius-button)] border px-4 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium">{entityName(item)}</span>
                  <span className="text-muted ml-2">
                    {item.entityType} · {item.city.name}
                  </span>
                  {item.autoApprovalReason && (
                    <span className="text-muted ml-2 text-xs">({item.autoApprovalReason})</span>
                  )}
                </div>
                <span className="text-muted shrink-0 text-xs">
                  {item.reviewedAt?.toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {recentlyProcessed.length > 0 && (
        <section>
          <h3 className="text-muted text-sm font-semibold">Recently Processed</h3>
          <div className="mt-3 space-y-2">
            {recentlyProcessed.map((item) => (
              <div
                key={item.id}
                className="border-border/50 flex items-center justify-between gap-3 rounded-[var(--radius-button)] border px-4 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      item.status === 'APPROVED'
                        ? 'bg-green-100 text-green-700'
                        : item.status === 'REJECTED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {item.status}
                  </span>
                  <span className="ml-2 font-medium">{entityName(item)}</span>
                  <span className="text-muted ml-2">
                    {item.entityType} · {item.city.name}
                  </span>
                </div>
                <span className="text-muted shrink-0 text-xs">
                  {item.reviewedAt?.toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
