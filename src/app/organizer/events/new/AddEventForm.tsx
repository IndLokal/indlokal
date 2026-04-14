'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { addEvent, type AddEventResult } from './actions';

export default function AddEventForm({ communityName }: { communityName: string }) {
  const [state, formAction, isPending] = useActionState<AddEventResult, FormData>(addEvent, null);

  const errors = state?.success === false ? state.errors : {};

  // Local datetime value for "now + 1 week" as default
  const defaultStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    // Format: YYYY-MM-DDTHH:MM (local, no seconds)
    return d.toISOString().slice(0, 16);
  })();

  return (
    <form action={formAction} className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Event title *</label>
        <input
          name="title"
          type="text"
          required
          maxLength={200}
          placeholder={`${communityName} — Diwali Celebration`}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500"
        />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title[0]}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          name="description"
          rows={4}
          maxLength={5000}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500"
          placeholder="What's happening, who should come, what to bring..."
        />
      </div>

      {/* Dates */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Start date & time *</label>
          <input
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={defaultStart}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500"
          />
          {errors.startsAt && <p className="mt-1 text-sm text-red-600">{errors.startsAt[0]}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            End time <span className="text-gray-400">(optional)</span>
          </label>
          <input
            name="endsAt"
            type="datetime-local"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Location */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="isOnline" value="true" className="rounded" />
          This is an online event
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Venue name</label>
            <input
              name="venueName"
              type="text"
              maxLength={200}
              placeholder="e.g. Kulturhaus Stuttgart"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Venue address</label>
            <input
              name="venueAddress"
              type="text"
              maxLength={500}
              placeholder="e.g. Theodor-Heuss-Str. 2, 70174 Stuttgart"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Online link <span className="text-gray-400">(for online events)</span>
          </label>
          <input
            name="onlineLink"
            type="url"
            placeholder="https://meet.google.com/..."
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Cost + Registration */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Cost</label>
          <select
            name="cost"
            defaultValue="free"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500"
          >
            <option value="free">Free</option>
            <option value="paid">Paid</option>
            <option value="unclear">Unclear / contact organizer</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Registration URL <span className="text-gray-400">(optional)</span>
          </label>
          <input
            name="registrationUrl"
            type="url"
            placeholder="https://eventbrite.com/..."
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Featured image */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Featured image URL <span className="text-gray-400">(optional)</span>
        </label>
        <input
          name="imageUrl"
          type="url"
          placeholder="https://example.com/event-banner.jpg"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500"
        />
        {errors.imageUrl && <p className="mt-1 text-sm text-red-600">{errors.imageUrl[0]}</p>}
      </div>

      {errors._ && <p className="text-sm text-red-600">{errors._[0]}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? 'Publishing...' : 'Publish event'}
        </button>
        <Link
          href="/organizer"
          className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
