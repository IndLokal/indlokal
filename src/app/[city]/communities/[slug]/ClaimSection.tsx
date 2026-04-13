'use client';

import { useState, useActionState } from 'react';
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

  if (claimState === 'CLAIM_PENDING' || state?.success) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
        <span>⏳</span>
        <span className="font-medium">Claim pending review</span>
        <span className="text-amber-600">
          — Our team will verify and approve this claim shortly
        </span>
      </div>
    );
  }

  const errors = state?.success === false ? state.errors : {};

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-gray-800">Do you manage this community?</p>
          <p className="mt-0.5 text-sm text-gray-500">
            Claim this listing to update its profile, add events, and show a verified badge.
          </p>
        </div>
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
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
              <label htmlFor="claim-name" className="block text-sm font-medium text-gray-700">
                Your Name *
              </label>
              <input
                id="claim-name"
                name="name"
                type="text"
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name[0]}</p>}
            </div>
            <div>
              <label htmlFor="claim-email" className="block text-sm font-medium text-gray-700">
                Your Email *
              </label>
              <input
                id="claim-email"
                name="email"
                type="email"
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email[0]}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="claim-relationship" className="block text-sm font-medium text-gray-700">
              Your relationship to {communityName} *
            </label>
            <select
              id="claim-relationship"
              name="relationship"
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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
            <label htmlFor="claim-message" className="block text-sm font-medium text-gray-700">
              Additional context (optional)
            </label>
            <textarea
              id="claim-message"
              name="message"
              rows={2}
              maxLength={500}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Any additional information that helps us verify your claim..."
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? 'Submitting...' : 'Submit Claim'}
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
