import type { ReactNode } from 'react';
import { db } from '@/lib/db';
import type { ExtractedCommunity, ExtractedEvent, ExtractedResource } from '@/modules/pipeline';
import { assessResourceApprovalEligibility } from '@/modules/pipeline/quality/review';
import { approvePipelineItem, rejectPipelineItem } from './actions';

export type PipelineItemWithCity = Awaited<
  ReturnType<
    typeof db.pipelineItem.findMany<{ include: { city: { select: { name: true; slug: true } } } }>
  >
>[number];

const EVENT_REJECTION_REASONS = [
  'POLICY_VIOLATION',
  'UNVERIFIABLE',
  'DUPLICATE',
  'SPAM',
  'OUTSIDE_COVERAGE',
] as const;

function formatResourceApprovalReason(reason: string): string {
  switch (reason) {
    case 'resource-approval-requires-public-url':
      return 'Approval needs a public source URL.';
    case 'resource-url-is-not-public-evidence':
      return 'The source URL is not valid public evidence.';
    case 'resource-approval-requires-official-or-institutional-domain':
      return 'Approval is limited to official registry, government, or institutional domains.';
    default:
      return 'This resource needs manual source-policy review.';
  }
}

function getCalendarSourceMeta(sourceUrl: string | null): {
  calendarId: string;
  feedOrigin: string;
} | null {
  if (!sourceUrl) return null;

  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return null;
  }

  if (parsed.hostname !== 'calendar.google.com') return null;
  if (!parsed.pathname.startsWith('/calendar/ical/')) return null;

  const segments = parsed.pathname.split('/').filter(Boolean);
  const icalIndex = segments.indexOf('ical');
  const encodedCalendarId = icalIndex >= 0 ? segments[icalIndex + 1] : null;
  if (!encodedCalendarId) return null;

  const calendarId = decodeURIComponent(encodedCalendarId);
  const feedOrigin = `${parsed.origin}${parsed.pathname}`;

  return { calendarId, feedOrigin };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-xs font-medium tracking-wide text-slate-400 uppercase">
        {label}
      </dt>
      <dd className="min-w-0 text-sm text-slate-700">{children}</dd>
    </div>
  );
}

export function PipelineItemCard({ item }: { item: PipelineItemWithCity }) {
  const data = item.extractedData as unknown as
    | ExtractedEvent
    | ExtractedCommunity
    | ExtractedResource;
  const event = data.type === 'EVENT' ? (data as ExtractedEvent) : null;
  const community = data.type === 'COMMUNITY' ? (data as ExtractedCommunity) : null;
  const resource = data.type === 'RESOURCE' ? (data as ExtractedResource) : null;

  const calendarSource = event ? getCalendarSourceMeta(item.sourceUrl) : null;
  const resourceApproval = resource
    ? assessResourceApprovalEligibility({ resource, sourceUrl: item.sourceUrl })
    : null;
  const resourceApprovalHint =
    resourceApproval && !resourceApproval.eligible
      ? formatResourceApprovalReason(resourceApproval.reason)
      : null;
  const resourceRejectionSuggestion = resourceApprovalHint
    ? `UNVERIFIABLE: ${resourceApprovalHint}`
    : '';

  const confidenceColor =
    item.confidence >= 0.85
      ? 'bg-green-100 text-green-800'
      : item.confidence >= 0.6
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800';
  const typeBadgeColor = event
    ? 'bg-blue-100 text-blue-700'
    : community
      ? 'bg-purple-100 text-purple-700'
      : 'bg-amber-100 text-amber-700';

  const title = event?.title ?? community?.name ?? resource?.title;
  const description = event?.description ?? community?.description ?? resource?.description;
  const categories = event?.categories ?? community?.categories ?? [];

  return (
    <div className="card-base p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Title + badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${typeBadgeColor}`}>
              {item.entityType}
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
              {item.reviewKind}
            </span>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceColor}`}>
              {Math.round(item.confidence * 100)}%
            </span>
            {item.autoApproved && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                AUTO
              </span>
            )}
          </div>

          {/* Structured fields */}
          <dl className="mt-3 space-y-1.5">
            {event && (
              <>
                {event.date && (
                  <Field label="When">
                    {event.date}
                    {event.time ? ` · ${event.time}` : ''}
                    {event.endTime ? ` – ${event.endTime}` : ''}
                  </Field>
                )}
                {event.venueName && (
                  <Field label="Where">
                    {event.venueName}
                    {event.venueAddress ? ` · ${event.venueAddress}` : ''}
                  </Field>
                )}
                {event.hostCommunity && <Field label="Host">{event.hostCommunity}</Field>}
                <Field label="Cost">
                  {event.costType === 'FREE'
                    ? 'Free'
                    : event.costType === 'PAID'
                      ? (event.cost ?? 'Paid')
                      : (event.cost ?? 'Unclear')}
                  {event.accessType && event.accessType !== 'UNCLEAR'
                    ? ` · ${event.accessType.replace(/_/g, ' ').toLowerCase()}`
                    : ''}
                </Field>
              </>
            )}

            {community && community.languages.length > 0 && (
              <Field label="Languages">{community.languages.join(', ')}</Field>
            )}

            {resource && (
              <>
                <Field label="Type">{resource.resourceType ?? 'COMMUNITY_RESOURCE'}</Field>
                {resource.audiences.length > 0 && (
                  <Field label="Audience">{resource.audiences.join(', ')}</Field>
                )}
                {resource.lifecycleStage.length > 0 && (
                  <Field label="Stage">{resource.lifecycleStage.join(', ')}</Field>
                )}
                {resource.validUntil && <Field label="Valid">{resource.validUntil}</Field>}
                {resource.isOfficialSource && <Field label="Source">Official source</Field>}
                {resource.url && (
                  <Field label="Link">
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-500 hover:underline"
                    >
                      Open resource ↗
                    </a>
                  </Field>
                )}
              </>
            )}
          </dl>

          {/* Resource approval policy notice */}
          {resourceApprovalHint && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              <p className="text-xs font-semibold tracking-wide uppercase">
                Resource approval policy
              </p>
              <p className="mt-1 text-sm">{resourceApprovalHint}</p>
            </div>
          )}

          {/* Description */}
          {description && <p className="text-muted mt-3 line-clamp-2 text-sm">{description}</p>}

          {/* Categories */}
          {categories.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {categories.map((cat) => (
                <span
                  key={cat}
                  className="bg-brand-50 text-brand-700 rounded-full px-2 py-0.5 text-xs"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}

          {/* Source metadata */}
          <p className="text-muted mt-3 border-t border-slate-100 pt-2 text-xs">
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
                Possible duplicate ({Math.round((item.matchScore ?? 0) * 100)}%)
              </span>
            )}
            {item.reviewKind === 'ENRICHMENT' && item.targetEntityId && (
              <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">
                Suggestion for existing community
              </span>
            )}
          </p>
          {calendarSource && (
            <p className="text-muted mt-1 text-xs">
              Calendar ID: <span className="font-mono">{calendarSource.calendarId}</span>
              {' · '}
              Feed origin:{' '}
              <a
                href={calendarSource.feedOrigin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-500 hover:underline"
              >
                {calendarSource.feedOrigin}
              </a>
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex w-44 shrink-0 flex-col gap-2">
          <form action={approvePipelineItem}>
            <input type="hidden" name="id" value={item.id} />
            <button
              type="submit"
              disabled={Boolean(resourceApprovalHint)}
              className={`w-full rounded-lg px-4 py-2 text-sm font-medium text-white ${
                resourceApprovalHint
                  ? 'cursor-not-allowed bg-slate-300'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
              title={resourceApprovalHint ?? undefined}
            >
              {resourceApprovalHint ? 'Approval blocked' : 'Approve'}
            </button>
          </form>
          <form action={rejectPipelineItem}>
            <input type="hidden" name="id" value={item.id} />
            {event ? (
              <select
                name="reason"
                defaultValue="UNVERIFIABLE"
                className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                aria-label="Event rejection reason"
              >
                {EVENT_REJECTION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                name="reason"
                defaultValue={resourceRejectionSuggestion}
                placeholder="Rejection reason"
                className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            )}
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
