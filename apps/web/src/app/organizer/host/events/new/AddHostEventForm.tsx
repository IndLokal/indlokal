'use client';

import { useActionState } from 'react';
import { addHostEvent } from './actions';
import type { AddHostEventResult } from './actions';

type City = { id: string; name: string };

type Props = {
  cities: City[];
  defaultCityId?: string;
};

export function AddHostEventForm({ cities, defaultCityId }: Props) {
  const [state, action, pending] = useActionState<AddHostEventResult, FormData>(addHostEvent, null);

  const errors = state && !state.success ? state.errors : {};

  return (
    <form action={action} className="space-y-5">
      {errors?._ && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors._.join(', ')}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="text-muted mb-1 block text-xs font-medium">Event title *</label>
        <input
          name="title"
          required
          minLength={3}
          maxLength={200}
          placeholder="e.g. Bharatanatyam Workshop - Summer 2026"
          className="border-border w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        {errors?.title && <p className="mt-1 text-xs text-red-600">{errors.title[0]}</p>}
      </div>

      {/* City */}
      <div>
        <label className="text-muted mb-1 block text-xs font-medium">City *</label>
        {defaultCityId ? (
          <>
            <input type="hidden" name="cityId" value={defaultCityId} />
            <p className="text-muted text-sm">{cities.find((c) => c.id === defaultCityId)?.name}</p>
          </>
        ) : (
          <select
            name="cityId"
            required
            className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
          >
            <option value="">Select city…</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Date / Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-muted mb-1 block text-xs font-medium">Start date & time *</label>
          <input
            name="startsAt"
            type="datetime-local"
            required
            className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
          />
          {errors?.startsAt && <p className="mt-1 text-xs text-red-600">{errors.startsAt[0]}</p>}
        </div>
        <div>
          <label className="text-muted mb-1 block text-xs font-medium">End (optional)</label>
          <input
            name="endsAt"
            type="datetime-local"
            className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
          />
        </div>
      </div>

      {/* Venue */}
      <div>
        <label className="text-muted mb-1 block text-xs font-medium">Venue name</label>
        <input
          name="venueName"
          placeholder="e.g. Kulturzentrum Stuttgart"
          className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
        />
      </div>
      <div>
        <label className="text-muted mb-1 block text-xs font-medium">Venue address</label>
        <input
          name="venueAddress"
          placeholder="e.g. Rotebühlplatz 28, 70173 Stuttgart"
          className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-muted mb-1 block text-xs font-medium">Description</label>
        <textarea
          name="description"
          rows={4}
          placeholder="Tell people what to expect at your event…"
          className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
        />
      </div>

      {/* Cost */}
      <div>
        <label className="text-muted mb-1 block text-xs font-medium">Admission</label>
        <select name="cost" className="border-border w-full rounded-lg border px-3 py-2.5 text-sm">
          <option value="free">Free</option>
          <option value="paid">Paid</option>
          <option value="unclear">Unclear / contact organizer</option>
        </select>
      </div>

      {/* Registration URL */}
      <div>
        <label className="text-muted mb-1 block text-xs font-medium">
          Registration / ticket link
        </label>
        <input
          name="registrationUrl"
          type="url"
          placeholder="https://…"
          className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-brand-600 hover:bg-brand-700 w-full rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
      >
        {pending ? 'Publishing…' : 'Publish event'}
      </button>
    </form>
  );
}
