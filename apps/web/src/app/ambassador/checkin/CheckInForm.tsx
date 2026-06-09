'use client';

import { useActionState } from 'react';
import { checkInToEvent } from './actions';
import type { SubmitResult } from '../lib/form-state';
import { FormField, TextArea, TextInput } from '@/components/forms/fields';

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

      <FormField
        label="Photo evidence (optional)"
        htmlFor="checkinPhotoKey"
        hint="Upload a photo to support the attendance signal. Coming soon - direct upload via pre-signed URL."
      >
        <TextInput
          id="checkinPhotoKey"
          name="photoKey"
          type="text"
          placeholder="Paste an uploaded image key (S3/R2 key)"
        />
      </FormField>

      <FormField label="Notes" htmlFor="checkinNotes">
        <TextArea
          id="checkinNotes"
          name="notes"
          rows={3}
          placeholder="How was the event? Approx attendance, vibe, etc."
        />
      </FormField>

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
