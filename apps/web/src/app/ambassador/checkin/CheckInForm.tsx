'use client';

import { useActionState } from 'react';
import { checkInToEvent } from './actions';
import type { SubmitResult } from '../submit/actions';

export function CheckInForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState<SubmitResult | null, FormData>(
    checkInToEvent,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />

      {state?.success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          {state.message}
        </div>
      )}
      {state && !state.success && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      )}

      <div>
        <label className="text-muted mb-1 block text-xs font-medium">
          Photo evidence (optional)
        </label>
        <p className="text-muted mb-2 text-xs">
          Upload a photo to support the attendance signal. Coming soon — direct upload via
          pre-signed URL.
        </p>
        <input
          name="photoKey"
          type="text"
          placeholder="Paste an uploaded image key (S3/R2 key)"
          className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
        />
      </div>

      <div>
        <label className="text-muted mb-1 block text-xs font-medium">Notes</label>
        <textarea
          name="notes"
          rows={3}
          placeholder="How was the event? Approx attendance, vibe, etc."
          className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending || state?.success}
        className="bg-brand-600 hover:bg-brand-700 w-full rounded-lg py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50"
      >
        {pending ? 'Logging check-in…' : state?.success ? 'Checked in ✓' : 'Confirm attendance'}
      </button>
    </form>
  );
}
