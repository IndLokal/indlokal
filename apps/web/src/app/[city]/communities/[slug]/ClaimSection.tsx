'use client';

import { useState, useActionState } from 'react';
import Link from 'next/link';
import { claimCommunity, type ClaimResult } from './actions';

type Props = {
  communityId: string;
  communityName: string;
  claimState: string;
};

const RELATIONSHIPS = [
  { value: 'organizer', label: 'I am the organizer / founder' },
  { value: 'co-organizer', label: 'I am a co-organizer' },
  { value: 'admin', label: 'I help manage the community' },
  { value: 'member', label: 'I am an active member' },
];

export function ClaimSection({ communityId, communityName, claimState }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, isPending] = useActionState<ClaimResult, FormData>(
    claimCommunity,
    null,
  );

  if (claimState === 'CLAIMED') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
        <span>✓</span>
        <span className="font-medium">Claimed</span>
        <span className="text-green-600">— This listing is managed by the community organizer</span>
      </div>
    );
  }

  if (state?.success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5">
        <div className="flex items-center gap-2">
          <span className="text-lg">✓</span>
          <h3 className="font-semibold text-green-800">Claim submitted!</h3>
        </div>
        <div className="mt-3 space-y-2 text-sm text-green-700">
          <p>Our team will review your request — this usually takes 1–2 days.</p>
          <p>
            Once approved, log in at{' '}
            <Link href="/organizer/login" className="font-medium underline">
              /organizer/login
            </Link>{' '}
            with the same email you just used. You&apos;ll get full access to edit your community
            profile, manage channels, and post events.
          </p>
        </div>
      </div>
    );
  }

  if (claimState === 'CLAIM_PENDING') {
    // Don't show anything to random visitors — a pending claim is an internal state
    return null;
  }

  const errors = state?.success === false ? state.errors : {};

  return (
    <div className="border-brand-100 bg-brand-50 rounded-[var(--radius-panel)] border p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-brand-900 font-medium">Is this your community?</p>
          <p className="text-brand-700 mt-0.5 text-sm">
            Claim it to post events to the city feed, manage your profile, and reach hundreds of
            people already searching for communities like yours.
          </p>
        </div>
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="btn-primary shrink-0 px-4 py-2 text-sm"
          >
            Claim this community
          </button>
        )}
      </div>

      {expanded && (
        <form action={formAction} className="mt-5 space-y-4">
          <input type="hidden" name="communityId" value={communityId} />

          {errors.communityId && <p className="text-sm text-red-600">{errors.communityId[0]}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="claim-name" className="text-foreground block text-sm font-medium">
                Your Name *
              </label>
              <input
                id="claim-name"
                name="name"
                type="text"
                required
                className="border-border focus:border-brand-500 focus:ring-brand-100 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name[0]}</p>}
            </div>
            <div>
              <label htmlFor="claim-email" className="text-foreground block text-sm font-medium">
                Your Email *
              </label>
              <input
                id="claim-email"
                name="email"
                type="email"
                required
                className="border-border focus:border-brand-500 focus:ring-brand-100 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email[0]}</p>}
            </div>
          </div>

          <div>
            <label
              htmlFor="claim-relationship"
              className="text-foreground block text-sm font-medium"
            >
              Your relationship to {communityName} *
            </label>
            <select
              id="claim-relationship"
              name="relationship"
              required
              className="border-border focus:border-brand-500 focus:ring-brand-100 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
            >
              <option value="">Select...</option>
              {RELATIONSHIPS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {errors.relationship && (
              <p className="mt-1 text-sm text-red-600">{errors.relationship[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="claim-message" className="text-foreground block text-sm font-medium">
              Additional context (optional)
            </label>
            <textarea
              id="claim-message"
              name="message"
              rows={2}
              maxLength={500}
              className="border-border focus:border-brand-500 focus:ring-brand-100 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
              placeholder="Any additional information that helps us verify your claim..."
            />
          </div>

          <div className="border-border border-t pt-4">
            <p className="text-foreground text-sm font-medium">
              Proof of connection{' '}
              <span className="text-muted font-normal">(optional — helps us verify faster)</span>
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="claim-whatsapp" className="text-muted block text-sm">
                  WhatsApp group link
                </label>
                <input
                  id="claim-whatsapp"
                  name="whatsappUrl"
                  type="url"
                  className="border-border focus:border-brand-500 focus:ring-brand-100 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
                  placeholder="https://chat.whatsapp.com/..."
                />
                {errors.whatsappUrl && (
                  <p className="mt-1 text-sm text-red-600">{errors.whatsappUrl[0]}</p>
                )}
              </div>
              <div>
                <label htmlFor="claim-telegram" className="text-muted block text-sm">
                  Telegram group link
                </label>
                <input
                  id="claim-telegram"
                  name="telegramUrl"
                  type="url"
                  className="border-border focus:border-brand-500 focus:ring-brand-100 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
                  placeholder="https://t.me/..."
                />
                {errors.telegramUrl && (
                  <p className="mt-1 text-sm text-red-600">{errors.telegramUrl[0]}</p>
                )}
              </div>
              <div>
                <label htmlFor="claim-social" className="text-muted block text-sm">
                  Website or social profile
                </label>
                <input
                  id="claim-social"
                  name="socialUrl"
                  type="url"
                  className="border-border focus:border-brand-500 focus:ring-brand-100 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
                  placeholder="https://instagram.com/... or your website"
                />
                {errors.socialUrl && (
                  <p className="mt-1 text-sm text-red-600">{errors.socialUrl[0]}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {isPending ? 'Submitting...' : 'Submit Claim'}
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="btn-secondary px-5 py-2.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
