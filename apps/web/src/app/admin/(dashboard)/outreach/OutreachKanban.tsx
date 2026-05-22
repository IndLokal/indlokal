'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { updateLeadStage } from './actions';
import type { OutreachStage } from '@prisma/client';

const STAGES: OutreachStage[] = [
  'NEW',
  'RESEARCHING',
  'CONTACTED',
  'IN_CONVERSATION',
  'ONBOARDED',
  'DECLINED',
  'DORMANT',
];

const STAGE_LABELS: Record<OutreachStage, string> = {
  NEW: 'New',
  RESEARCHING: 'Researching',
  CONTACTED: 'Contacted',
  IN_CONVERSATION: 'In Conversation',
  ONBOARDED: 'Onboarded',
  DECLINED: 'Declined',
  DORMANT: 'Dormant',
};

const STAGE_COLOR: Record<OutreachStage, string> = {
  NEW: 'bg-gray-100 text-gray-700',
  RESEARCHING: 'bg-blue-100 text-blue-700',
  CONTACTED: 'bg-yellow-100 text-yellow-700',
  IN_CONVERSATION: 'bg-orange-100 text-orange-700',
  ONBOARDED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-red-100 text-red-700',
  DORMANT: 'bg-slate-100 text-slate-500',
};

type Lead = {
  id: string;
  suggestedName: string | null;
  communityId: string | null;
  community: { name: string } | null;
  stage: OutreachStage;
  source: string;
  channelHint: string | null;
  nextActionAt: Date | null;
  cityId: string;
  city: { name: string };
  ownerUserId: string;
  _count: { notes: number };
};

type Props = {
  leads: Lead[];
  showCityBadge?: boolean;
};

function LeadCard({ lead }: { lead: Lead }) {
  const [isPending, startTransition] = useTransition();

  const name = lead.community?.name ?? lead.suggestedName ?? '—';
  const isOverdue = lead.nextActionAt && new Date(lead.nextActionAt) < new Date();

  return (
    <div
      className={`border-border rounded-lg border bg-white p-3 shadow-sm ${isPending ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/admin/outreach/${lead.id}`}
          className="text-sm font-medium leading-snug hover:underline"
        >
          {name}
        </Link>
        <span className="text-muted shrink-0 text-[10px]">{lead.source}</span>
      </div>
      <p className="text-muted mt-1 text-xs">{lead.city.name}</p>
      {lead.channelHint && <p className="text-muted mt-0.5 truncate text-xs">{lead.channelHint}</p>}
      <div className="mt-2 flex items-center gap-2">
        {lead.nextActionAt && (
          <span className={`text-[10px] font-medium ${isOverdue ? 'text-red-600' : 'text-muted'}`}>
            Due{' '}
            {new Date(lead.nextActionAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        )}
        {lead._count.notes > 0 && (
          <span className="text-muted text-[10px]">
            {lead._count.notes} note{lead._count.notes !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {/* Stage advance buttons */}
      <div className="mt-2 flex flex-wrap gap-1">
        {STAGES.filter((s) => s !== lead.stage)
          .slice(0, 3)
          .map((s) => (
            <button
              key={s}
              onClick={() => startTransition(() => void updateLeadStage(lead.id, s))}
              disabled={isPending}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-gray-100"
              title={`Move to ${STAGE_LABELS[s]}`}
            >
              → {STAGE_LABELS[s]}
            </button>
          ))}
      </div>
    </div>
  );
}

export function OutreachKanban({ leads, showCityBadge: _showCityBadge }: Props) {
  const byStage = Object.fromEntries(
    STAGES.map((s) => [s, leads.filter((l) => l.stage === s)]),
  ) as Record<OutreachStage, Lead[]>;

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STAGES.map((stage) => {
        const stageleads = byStage[stage];
        return (
          <div key={stage} className="w-60 shrink-0">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLOR[stage]}`}
              >
                {STAGE_LABELS[stage]}
              </span>
              <span className="text-muted text-xs">{stageleads.length}</span>
            </div>
            <div className="space-y-2">
              {stageleads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
              {stageleads.length === 0 && (
                <div className="border-border rounded-lg border border-dashed py-6 text-center">
                  <p className="text-muted text-xs">Empty</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { STAGE_LABELS, STAGE_COLOR };
export type { Lead };
