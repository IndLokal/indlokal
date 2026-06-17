'use client';

import { useActionState } from 'react';
import { CitySearchSelect } from '@/components/ui';
import { updateHostProfile, type UpdateHostProfileResult } from './actions';

type City = { id: string; name: string };

export function HostProfileForm({
  cities,
  defaultDisplayName,
  defaultCityId,
  defaultLinks,
}: {
  cities: City[];
  defaultDisplayName: string;
  defaultCityId: string;
  defaultLinks: string[];
}) {
  const [state, action, pending] = useActionState<UpdateHostProfileResult, FormData>(
    updateHostProfile,
    null,
  );

  return (
    <form action={action} className="space-y-5">
      {state && !state.success && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
      )}
      {state?.success && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          Profile saved. This is how you appear as the host on your events.
        </p>
      )}

      <div>
        <label className="text-muted mb-1 block text-xs font-medium">Display name *</label>
        <input
          name="displayName"
          required
          minLength={2}
          maxLength={100}
          defaultValue={defaultDisplayName}
          placeholder="e.g. Priya Mehta or Nrityalaya Dance School"
          className="border-border w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none"
        />
        <p className="text-muted mt-1 text-xs">Shown as “Hosted by…” on every event you post.</p>
      </div>

      <div>
        <label className="text-muted mb-1 block text-xs font-medium">Your city *</label>
        <CitySearchSelect
          name="cityId"
          cities={cities.map((c) => ({ value: c.id, name: c.name }))}
          defaultValue={defaultCityId}
        />
      </div>

      {[0, 1, 2].map((i) => (
        <div key={i}>
          <label className="text-muted mb-1 block text-xs font-medium">Link {i + 1}</label>
          <input
            name={`link${i + 1}`}
            type="url"
            defaultValue={defaultLinks[i] ?? ''}
            placeholder="https://instagram.com/yourstudio"
            className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
          />
        </div>
      ))}

      <button
        type="submit"
        disabled={pending}
        className="bg-brand-600 hover:bg-brand-700 w-full rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}
