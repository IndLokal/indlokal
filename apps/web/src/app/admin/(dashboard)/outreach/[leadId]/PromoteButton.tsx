'use client';

import { useActionState } from 'react';
import { communityOptions } from '@indlokal/shared';
import { promoteLeadToCommunity } from '../actions';
import type { OutreachResult } from '../actions';

export function PromoteButton({
  leadId,
  communityId,
}: {
  leadId: string;
  communityId: string | null;
}) {
  const [state, action, pending] = useActionState<OutreachResult | null, FormData>(
    promoteLeadToCommunity,
    null,
  );

  if (communityId) {
    return <p className="text-sm text-green-700">Already linked to a community.</p>;
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />

      <div className="rounded-lg border border-dashed border-slate-300 p-3">
        <p className="mb-2 text-xs font-medium text-slate-700">Optional starter channel</p>
        <div className="grid gap-2 sm:grid-cols-[160px,1fr]">
          <select
            name="channelType"
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">None</option>
            {communityOptions.CHANNEL_TYPE_VALUES.map((channelType) => (
              <option key={channelType} value={channelType}>
                {communityOptions.CHANNEL_TYPE_LABELS[channelType]}
              </option>
            ))}
          </select>
          <input
            name="channelUrl"
            type="url"
            placeholder="https://..."
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <input
          name="channelLabel"
          type="text"
          placeholder="Optional label"
          className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </div>

      {state?.success && <p className="text-sm text-green-600">{state.message}</p>}
      {state && !state.success && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-green-600 px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-50 disabled:opacity-50"
      >
        {pending ? 'Creating community…' : '→ Promote to community'}
      </button>
    </form>
  );
}
