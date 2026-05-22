'use client';

import { useTransition } from 'react';
import { updateLeadStage } from '../actions';
import type { OutreachStage } from '@prisma/client';
import { STAGE_LABELS, STAGE_COLOR } from '../OutreachKanban';

const ALL_STAGES: OutreachStage[] = [
  'NEW',
  'RESEARCHING',
  'CONTACTED',
  'IN_CONVERSATION',
  'ONBOARDED',
  'DECLINED',
  'DORMANT',
];

export function StageSelector({ leadId, current }: { leadId: string; current: OutreachStage }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {ALL_STAGES.map((s) => (
        <button
          key={s}
          disabled={isPending || s === current}
          onClick={() => startTransition(() => void updateLeadStage(leadId, s))}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            s === current
              ? STAGE_COLOR[s] + ' ring-2 ring-current ring-offset-1'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          } disabled:opacity-50`}
        >
          {STAGE_LABELS[s]}
        </button>
      ))}
    </div>
  );
}
