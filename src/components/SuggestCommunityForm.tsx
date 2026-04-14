'use client';

import { useActionState } from 'react';
import { suggestCommunity, type SuggestResult } from '@/app/actions/reports';

export function SuggestCommunityForm({ citySlug }: { citySlug: string }) {
  const [state, formAction, isPending] = useActionState<SuggestResult, FormData>(
    suggestCommunity,
    null,
  );

  if (state?.success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
        <p className="text-sm font-medium text-green-800">Thanks for the suggestion!</p>
        <p className="mt-1 text-xs text-green-700">
          We&apos;ll look into adding <strong>{state.name}</strong> to LocalPulse.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="citySlug" value={citySlug} />

      <div>
        <label htmlFor="suggestedName" className="block text-sm font-medium text-gray-700">
          Community name <span className="text-red-500">*</span>
        </label>
        <input
          id="suggestedName"
          name="suggestedName"
          type="text"
          required
          maxLength={120}
          placeholder="e.g. Frankfurt Tamil Sangam"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="suggDetails" className="block text-sm font-medium text-gray-700">
          Any extra details?
        </label>
        <textarea
          id="suggDetails"
          name="details"
          rows={2}
          maxLength={500}
          placeholder="WhatsApp link, website, description — anything useful"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="suggEmail" className="block text-sm font-medium text-gray-700">
          Your email (optional)
        </label>
        <input
          id="suggEmail"
          name="reporterEmail"
          type="email"
          placeholder="We'll let you know when it's live"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {state?.success === false && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {isPending ? 'Submitting…' : 'Suggest this community'}
      </button>
    </form>
  );
}
