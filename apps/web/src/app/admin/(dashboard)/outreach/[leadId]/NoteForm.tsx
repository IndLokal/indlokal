'use client';

import { useActionState } from 'react';
import { addLeadNote } from '../actions';
import type { OutreachResult } from '../actions';

export function NoteForm({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState<OutreachResult | null, FormData>(
    addLeadNote,
    null,
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}
      <textarea
        name="body"
        rows={3}
        placeholder="Add a note (supports Markdown)…"
        className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Add note'}
      </button>
    </form>
  );
}
