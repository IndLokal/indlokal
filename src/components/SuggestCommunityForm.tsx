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
      <div className="rounded-[var(--radius-card)] border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm">
        <p className="text-base font-semibold text-emerald-800">🎉 Thanks for the suggestion!</p>
        <p className="mt-2 text-sm text-emerald-700">
          We&apos;ll look into adding <strong>{state.name}</strong> to LocalPulse.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="citySlug" value={citySlug} />

      <div>
        <label htmlFor="suggestedName" className="text-foreground block text-sm font-semibold">
          Community name <span className="text-destructive">*</span>
        </label>
        <input
          id="suggestedName"
          name="suggestedName"
          type="text"
          required
          maxLength={120}
          placeholder="e.g. Frankfurt Tamil Sangam"
          className="border-border text-foreground placeholder:text-muted focus:border-brand-500 focus:ring-brand-500 mt-1.5 block w-full rounded-[var(--radius-button)] border bg-white px-3.5 py-2.5 text-sm transition-colors focus:ring-1 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="suggDetails" className="text-foreground block text-sm font-semibold">
          Any extra details?
        </label>
        <textarea
          id="suggDetails"
          name="details"
          rows={3}
          maxLength={500}
          placeholder="WhatsApp link, website, description — anything useful"
          className="border-border text-foreground placeholder:text-muted focus:border-brand-500 focus:ring-brand-500 mt-1.5 block w-full rounded-[var(--radius-button)] border bg-white px-3.5 py-2.5 text-sm transition-colors focus:ring-1 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="suggEmail" className="text-foreground block text-sm font-semibold">
          Your email <span className="text-muted font-normal">(optional)</span>
        </label>
        <input
          id="suggEmail"
          name="reporterEmail"
          type="email"
          placeholder="We'll let you know when it's live"
          className="border-border text-foreground placeholder:text-muted focus:border-brand-500 focus:ring-brand-500 mt-1.5 block w-full rounded-[var(--radius-button)] border bg-white px-3.5 py-2.5 text-sm transition-colors focus:ring-1 focus:outline-none"
        />
      </div>

      {state?.success === false && (
        <p className="bg-destructive/10 text-destructive rounded-[var(--radius-button)] px-3.5 py-2.5 text-sm font-medium">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="btn-primary mt-2 w-full py-2.5 text-base"
      >
        {isPending ? 'Submitting…' : 'Suggest this community'}
      </button>
    </form>
  );
}
