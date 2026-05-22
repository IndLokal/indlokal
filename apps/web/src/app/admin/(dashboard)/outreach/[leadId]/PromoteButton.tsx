'use client';

import { useActionState } from 'react';
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
