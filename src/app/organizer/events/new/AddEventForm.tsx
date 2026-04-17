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
        <label className="text-foreground block text-sm font-medium">Event title *</label>
        <input
          name="title"
          type="text"
          required
          maxLength={200}
          placeholder={`${communityName} — Diwali Celebration`}
          className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
        />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title[0]}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="text-foreground block text-sm font-medium">
          Description <span className="text-muted">(optional)</span>
        </label>
        <textarea
          name="description"
          rows={4}
          maxLength={5000}
          className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
          placeholder="What's happening, who should come, what to bring..."
        />
      </div>

      {/* Dates */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-foreground block text-sm font-medium">Start date & time *</label>
          <input
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={defaultStart}
            className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
          />
          {errors.startsAt && <p className="mt-1 text-sm text-red-600">{errors.startsAt[0]}</p>}
        </div>
        <div>
          <label className="text-foreground block text-sm font-medium">
            End time <span className="text-muted">(optional)</span>
          </label>
          <input
            name="endsAt"
            type="datetime-local"
            className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
          />
        </div>
      </div>

      {/* Location */}
      <div className="space-y-3">
        <label className="text-foreground flex items-center gap-2 text-sm">
          <input type="checkbox" name="isOnline" value="true" className="rounded" />
          This is an online event
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-foreground block text-sm font-medium">Venue name</label>
            <input
              name="venueName"
              type="text"
              maxLength={200}
              placeholder="e.g. Kulturhaus Stuttgart"
              className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
            />
          </div>
          <div>
            <label className="text-foreground block text-sm font-medium">Venue address</label>
            <input
              name="venueAddress"
              type="text"
              maxLength={500}
              placeholder="e.g. Theodor-Heuss-Str. 2, 70174 Stuttgart"
              className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-foreground block text-sm font-medium">
            Online link <span className="text-muted">(for online events)</span>
          </label>
          <input
            name="onlineLink"
            type="url"
            placeholder="https://meet.google.com/..."
            className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
          />
        </div>
      </div>

      {/* Cost + Registration */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-foreground block text-sm font-medium">Cost</label>
          <select
            name="cost"
            defaultValue="free"
            className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
          >
            <option value="free">Free</option>
            <option value="paid">Paid</option>
            <option value="unclear">Unclear / contact organizer</option>
          </select>
        </div>
        <div>
          <label className="text-foreground block text-sm font-medium">
            Registration URL <span className="text-muted">(optional)</span>
          </label>
          <input
            name="registrationUrl"
            type="url"
            placeholder="https://eventbrite.com/..."
            className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
          />
        </div>
      </div>

      {/* Featured image */}
      <div>
        <label className="text-foreground block text-sm font-medium">
          Featured image URL <span className="text-muted">(optional)</span>
        </label>
        <input
          name="imageUrl"
          type="url"
          placeholder="https://example.com/event-banner.jpg"
          className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
        />
        {errors.imageUrl && <p className="mt-1 text-sm text-red-600">{errors.imageUrl[0]}</p>}
      </div>

      {errors._ && <p className="text-sm text-red-600">{errors._[0]}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary px-6 py-2.5 text-sm disabled:opacity-50"
        >
          {isPending ? 'Publishing...' : 'Publish event'}
        </button>
        <Link href="/organizer" className="btn-secondary px-6 py-2.5 text-sm">
          Cancel
        </Link>
      </div>
    </form>
  );
}
