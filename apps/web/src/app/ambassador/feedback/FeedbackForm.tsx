'use client';

import { useActionState } from 'react';
import { CitySearchSelect } from '@/components/ui';
import { submitFeedback } from './actions';
import type { SubmitResult } from '../lib/form-state';
import { FormField, SelectInput, TextArea } from '@/components/forms/fields';

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
        <FormField label="City" htmlFor="feedbackCityId">
          <CitySearchSelect
            inputId="feedbackCityId"
            name="cityId"
            cities={cities.map((c) => ({ value: c.id, name: c.name }))}
            placeholder="Search city (leave blank if not city-specific)"
          />
        </FormField>
      )}

      <FormField label="Subject" htmlFor="feedbackSubject">
        <SelectInput id="feedbackSubject" name="subject">
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectInput>
      </FormField>

      <FormField label="Details" htmlFor="feedbackDetails" required>
        <TextArea
          id="feedbackDetails"
          name="details"
          rows={5}
          required
          placeholder="Describe what you found, what you expected, and any links/names…"
        />
      </FormField>

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
