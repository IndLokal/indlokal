'use client';

import { useActionState, useState } from 'react';
import { submitAmbassadorCommunity, submitAmbassadorEvent } from './actions';
import type { SubmitResult } from './actions';

type Mode = 'community' | 'event';

type Props = {
  cities: Array<{ id: string; name: string }>;
  defaultCityId?: string;
};

export function AmbassadorSubmitForm({ cities, defaultCityId }: Props) {
  const [mode, setMode] = useState<Mode>('community');

  const [communityState, communityAction, communityPending] = useActionState<
    SubmitResult | null,
    FormData
  >(submitAmbassadorCommunity, null);
  const [eventState, eventAction, eventPending] = useActionState<SubmitResult | null, FormData>(
    submitAmbassadorEvent,
    null,
  );

  const state = mode === 'community' ? communityState : eventState;

  return (
    <div>
      {/* Mode toggle */}
      <div className="mb-6 flex rounded-lg border border-gray-200 bg-gray-100 p-1">
        {(['community', 'event'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md py-2 text-sm font-medium capitalize transition-colors ${
              mode === m ? 'bg-white shadow-sm' : 'text-muted hover:text-foreground'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Success banner */}
      {state?.success && (
        <div className="mb-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          {state.message}
        </div>
      )}
      {state && !state.success && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {mode === 'community' ? (
        <form action={communityAction} className="space-y-4">
          <input type="hidden" name="cityId" value={defaultCityId ?? ''} />

          {!defaultCityId && (
            <div>
              <label className="text-muted mb-1 block text-xs font-medium">City *</label>
              <select
                name="cityId"
                required
                className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
              >
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-muted mb-1 block text-xs font-medium">Community name *</label>
            <input
              name="name"
              required
              placeholder="e.g. Stuttgart Tamil Sangam"
              className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="text-muted mb-1 block text-xs font-medium">Short description</label>
            <textarea
              name="description"
              rows={2}
              placeholder="What is this community about?"
              className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-muted mb-1 block text-xs font-medium">Channel type</label>
              <select
                name="channelType"
                className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
              >
                {['WHATSAPP', 'TELEGRAM', 'INSTAGRAM', 'FACEBOOK', 'WEBSITE', 'OTHER'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-muted mb-1 block text-xs font-medium">
                Channel / link URL
              </label>
              <input
                name="channelUrl"
                type="url"
                placeholder="https://..."
                className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-muted mb-1 block text-xs font-medium">Notes for reviewer</label>
            <textarea
              name="notes"
              rows={2}
              placeholder="Anything the reviewer should know..."
              className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={communityPending}
            className="bg-brand-600 hover:bg-brand-700 w-full rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            {communityPending ? 'Submitting…' : 'Submit community'}
          </button>
        </form>
      ) : (
        <form action={eventAction} className="space-y-4">
          <input type="hidden" name="cityId" value={defaultCityId ?? ''} />

          {!defaultCityId && (
            <div>
              <label className="text-muted mb-1 block text-xs font-medium">City *</label>
              <select
                name="cityId"
                required
                className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
              >
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-muted mb-1 block text-xs font-medium">Event title *</label>
            <input
              name="title"
              required
              placeholder="e.g. Diwali Night Stuttgart 2026"
              className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="text-muted mb-1 block text-xs font-medium">
              Community / organiser
            </label>
            <input
              name="communityName"
              placeholder="Name of the organising community"
              className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-muted mb-1 block text-xs font-medium">Date</label>
              <input
                name="startDate"
                type="date"
                className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-muted mb-1 block text-xs font-medium">Location</label>
              <input
                name="location"
                placeholder="Venue or online"
                className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-muted mb-1 block text-xs font-medium">
              Source URL (poster / social post)
            </label>
            <input
              name="sourceUrl"
              type="url"
              placeholder="https://..."
              className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="text-muted mb-1 block text-xs font-medium">Notes for reviewer</label>
            <textarea
              name="notes"
              rows={2}
              placeholder="Anything the reviewer should know..."
              className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={eventPending}
            className="bg-brand-600 hover:bg-brand-700 w-full rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            {eventPending ? 'Submitting…' : 'Submit event'}
          </button>
        </form>
      )}

      <p className="text-muted mt-4 text-center text-xs">
        Your submissions are tagged as ambassador fast-track and go to the top of the review queue.
      </p>
    </div>
  );
}
