'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import type { ContentLog, ContentLogAction } from '@prisma/client';

type Operator = { id: string; email: string; displayName: string | null };

type Props = {
  logs: ContentLog[];
  operators: Operator[];
};

// ── Entity deep-link map ─────────────────────────────────────────────────────
function entityLink(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case 'community':
      return `/admin/data?tab=communities&id=${entityId}`;
    case 'event':
      return `/admin/data?tab=events&id=${entityId}`;
    case 'pipeline_item':
      return `/admin/pipeline?id=${entityId}`;
    case 'outreach_lead':
      return `/admin/outreach/${entityId}`;
    case 'role_assignment':
      return `/admin/team`;
    default:
      return null;
  }
}

// ── Action chip colors ───────────────────────────────────────────────────────
const ACTION_CHIP: Record<ContentLogAction | string, string> = {
  CREATED: 'bg-green-100 text-green-700',
  UPDATED: 'bg-blue-100 text-blue-700',
  VERIFIED: 'bg-emerald-100 text-emerald-700',
  ARCHIVED: 'bg-gray-100 text-gray-600',
  SCORE_REFRESHED: 'bg-violet-100 text-violet-700',
  ROLE_GRANTED: 'bg-sky-100 text-sky-700',
  ROLE_REVOKED: 'bg-red-100 text-red-700',
};

export function AuditTable({ logs, operators }: Props) {
  const [selected, setSelected] = useState<ContentLog | null>(null);

  const operatorMap = new Map(operators.map((o) => [o.id, o]));

  function actorLabel(changedBy: string | null): string {
    if (!changedBy) return '-';
    if (changedBy === 'system') return 'system';
    const op = operatorMap.get(changedBy);
    return op ? (op.displayName ?? op.email) : changedBy.slice(0, 8) + '…';
  }

  return (
    <>
      {logs.length === 0 ? (
        <div className="border-border mt-6 rounded-[var(--radius-card)] border border-dashed py-16 text-center">
          <p className="text-muted text-sm">No audit records match these filters.</p>
        </div>
      ) : (
        <div className="border-border mt-6 overflow-x-auto rounded-[var(--radius-card)] border">
          <table className="w-full text-sm">
            <thead className="bg-muted-bg">
              <tr className="border-border border-b">
                <th className="px-4 py-2.5 text-left text-xs font-medium">Action</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium">Entity type</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium">Entity ID</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium">Actor</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium">When</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-muted-bg/50 cursor-pointer transition-colors"
                  onClick={() => setSelected(log)}
                >
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ACTION_CHIP[log.action] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {log.action.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="text-muted px-4 py-3 font-mono text-xs">{log.entityType}</td>
                  <td className="px-4 py-3">
                    <span
                      className="text-muted max-w-[120px] cursor-default truncate font-mono text-xs"
                      title={log.entityId}
                    >
                      {log.entityId.slice(0, 12)}…
                    </span>
                  </td>
                  <td className="text-muted px-4 py-3 text-xs">{actorLabel(log.changedBy)}</td>
                  <td className="text-muted px-4 py-3 text-xs" title={log.createdAt.toISOString()}>
                    {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {entityLink(log.entityType, log.entityId) && (
                      <a
                        href={entityLink(log.entityType, log.entityId)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted hover:text-brand-600 text-xs underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View →
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer */}
      {selected && (
        <AuditDrawer
          log={selected}
          actorLabel={actorLabel(selected.changedBy)}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

// ── Drawer ───────────────────────────────────────────────────────────────────
function AuditDrawer({
  log,
  actorLabel,
  onClose,
}: {
  log: ContentLog;
  actorLabel: string;
  onClose: () => void;
}) {
  const metadata = log.metadata as Record<string, unknown> | null;
  const hasDiff = metadata && ('previous' in metadata || 'next' in metadata);
  const deepLink = entityLink(log.entityType, log.entityId);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="border-border flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ACTION_CHIP[log.action] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {log.action.replace('_', ' ')}
            </span>
            <span className="text-muted font-mono text-xs">{log.entityType}</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground text-sm transition-colors"
            aria-label="Close drawer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 p-5">
          {/* Core fields */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-muted text-xs font-medium">Log ID</dt>
              <dd className="mt-0.5 font-mono text-xs" title={log.id}>
                {log.id}
              </dd>
            </div>
            <div>
              <dt className="text-muted text-xs font-medium">Entity ID</dt>
              <dd className="mt-0.5 font-mono text-xs" title={log.entityId}>
                {log.entityId}
              </dd>
            </div>
            <div>
              <dt className="text-muted text-xs font-medium">Actor</dt>
              <dd className="mt-0.5 text-xs">{actorLabel}</dd>
            </div>
            <div>
              <dt className="text-muted text-xs font-medium">Timestamp</dt>
              <dd className="mt-0.5 text-xs">
                {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm:ss')}
              </dd>
            </div>
            {deepLink && (
              <div className="col-span-2">
                <a
                  href={deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 text-sm underline"
                >
                  View entity →
                </a>
              </div>
            )}
          </dl>

          {/* Diff view */}
          {hasDiff && (
            <div>
              <h3 className="mb-2 text-xs font-semibold">Changes</h3>
              <div className="grid grid-cols-2 gap-3">
                {metadata.previous !== undefined && (
                  <div>
                    <p className="text-muted mb-1 text-[10px] font-medium uppercase tracking-wide">
                      Before
                    </p>
                    <pre className="overflow-x-auto rounded-lg bg-red-50 p-3 text-[11px] leading-relaxed text-red-800">
                      {JSON.stringify(metadata.previous, null, 2)}
                    </pre>
                  </div>
                )}
                {metadata.next !== undefined && (
                  <div>
                    <p className="text-muted mb-1 text-[10px] font-medium uppercase tracking-wide">
                      After
                    </p>
                    <pre className="overflow-x-auto rounded-lg bg-green-50 p-3 text-[11px] leading-relaxed text-green-800">
                      {JSON.stringify(metadata.next, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Full metadata */}
          {metadata && (
            <div>
              <h3 className="mb-2 text-xs font-semibold">Full metadata</h3>
              <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-800">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </div>
          )}

          {!metadata && <p className="text-muted text-sm">No metadata recorded for this action.</p>}
        </div>
      </div>
    </>
  );
}
