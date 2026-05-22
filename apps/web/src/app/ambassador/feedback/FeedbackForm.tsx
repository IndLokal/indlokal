'use client';

import { useActionState } from 'react';
import { submitFeedback } from './actions';
import type { SubmitResult } from '../submit/actions';

const SUBJECTS = [
  'Wrong or outdated information',
  'Missing community in the directory',
  'Duplicate listing',
  'Event already happened',
  'Platform bug / broken feature',
  'Other',
];

type Props = {
  cities: Array<{ id: string; name: string }>;
  defaultCityId?: string;
};

export function FeedbackForm({ cities, defaultCityId }: Props) {
  const [state, action, pending] = useActionState<SubmitResult | null, FormData>(
    submitFeedback,
    null,
  );

  return (
    <form action={action} className="space-y-5">
      {defaultCityId && <input type="hidden" name="cityId" value={defaultCityId} />}

      {!defaultCityId && (
        <div>
          <label className="text-muted mb-1 block text-xs font-medium">City</label>
          <select
            name="cityId"
            className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
          >
            <option value="">All / not city-specific</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="text-muted mb-1 block text-xs font-medium">Subject</label>
        <select
          name="subject"
          className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-muted mb-1 block text-xs font-medium">Details *</label>
        <textarea
          name="details"
          rows={5}
          required
          placeholder="Describe what you found, what you expected, and any links/names…"
          className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
        />
      </div>

      {state?.success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          {state.message}
        </div>
      )}
      {state && !state.success && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-brand-600 hover:bg-brand-700 w-full rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Submit feedback'}
      </button>
    </form>
  );
}
