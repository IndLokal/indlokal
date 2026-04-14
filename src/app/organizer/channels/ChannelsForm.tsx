'use client';

import { useActionState } from 'react';
import { addChannel, deleteChannel, type ChannelResult } from './actions';

const CHANNEL_OPTIONS = [
  { value: 'WHATSAPP', label: '💬 WhatsApp' },
  { value: 'TELEGRAM', label: '✈️ Telegram' },
  { value: 'WEBSITE', label: '🌐 Website' },
  { value: 'FACEBOOK', label: '📘 Facebook' },
  { value: 'INSTAGRAM', label: '📸 Instagram' },
  { value: 'EMAIL', label: '✉️ Email' },
  { value: 'MEETUP', label: '🤝 Meetup' },
  { value: 'YOUTUBE', label: '▶️ YouTube' },
  { value: 'LINKEDIN', label: '💼 LinkedIn' },
  { value: 'OTHER', label: '🔗 Other' },
];

type Channel = {
  id: string;
  channelType: string;
  url: string;
  label: string | null;
  isPrimary: boolean;
};

type Props = {
  channels: Channel[];
  citySlug: string;
  communitySlug: string;
};

export default function ChannelsForm({ channels }: Props) {
  const [state, addFormAction, isPending] = useActionState<ChannelResult, FormData>(
    addChannel,
    null,
  );

  const errors = state?.success === false ? state.errors : {};

  return (
    <div className="mt-8 space-y-8">
      {/* Existing channels */}
      {channels.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-800">Current channels</h2>
          <ul className="mt-4 space-y-3">
            {channels.map((ch) => (
              <li
                key={ch.id}
                className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {ch.channelType}
                    {ch.isPrimary && (
                      <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-600">
                        Primary
                      </span>
                    )}
                  </p>
                  <a
                    href={ch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-xs text-gray-500 hover:underline"
                  >
                    {ch.url}
                  </a>
                </div>
                <form action={deleteChannel}>
                  <input type="hidden" name="channelId" value={ch.id} />
                  <button
                    type="submit"
                    className="shrink-0 text-sm text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add channel form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-800">Add a channel</h2>

        {state?.success && (
          <p className="mt-3 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            ✓ Channel added.
          </p>
        )}

        <form action={addFormAction} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Channel type *</label>
              <select
                name="channelType"
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500"
              >
                <option value="">Select...</option>
                {CHANNEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {errors.channelType && (
                <p className="mt-1 text-sm text-red-600">{errors.channelType[0]}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Custom label</label>
              <input
                name="label"
                type="text"
                maxLength={100}
                placeholder="e.g. Join our WhatsApp group"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">URL *</label>
            <input
              name="url"
              type="url"
              required
              placeholder="https://"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500"
            />
            {errors.url && <p className="mt-1 text-sm text-red-600">{errors.url[0]}</p>}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="isPrimary" value="true" className="rounded" />
            Set as primary channel
          </label>

          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? 'Adding...' : 'Add channel'}
          </button>
        </form>
      </div>
    </div>
  );
}
