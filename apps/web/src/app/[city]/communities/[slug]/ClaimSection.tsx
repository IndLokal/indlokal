'use client';

import { useState, useActionState } from 'react';
import Link from 'next/link';
import { content, communityOptions } from '@indlokal/shared';
import {
  claimCommunity,
  requestOrganizerAccess,
  type AccessRequestResult,
  type ClaimResult,
} from './actions';

type Props = {
  communityId: string;
  communityName: string;
  claimState: string;
};

type EvidenceRow = {
  id: number;
  type: communityOptions.CommunityChannelType;
  url: string;
};

const EVIDENCE_TYPES = communityOptions.CHANNEL_TYPE_VALUES.map((value) => ({
  value,
  label: communityOptions.CHANNEL_TYPE_LABELS[value],
}));

const MAX_EVIDENCE_LINKS = 5;

const RELATIONSHIPS = [
  { value: 'organizer', label: 'I am the organizer / founder' },
  { value: 'co-organizer', label: 'I am a co-organizer' },
  { value: 'admin', label: 'I help manage the community' },
  { value: 'member', label: 'I am an active member' },
];

export function ClaimSection({ communityId, communityName, claimState }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [requestExpanded, setRequestExpanded] = useState(false);
  const [evidenceLinks, setEvidenceLinks] = useState<EvidenceRow[]>([
    { id: 1, type: 'WHATSAPP', url: '' },
  ]);
  const [state, formAction, isPending] = useActionState<ClaimResult, FormData>(
    claimCommunity,
    null,
  );
  const [accessState, accessFormAction, accessPending] = useActionState<
    AccessRequestResult,
    FormData
  >(requestOrganizerAccess, null);

  const updateEvidence = (id: number, patch: Partial<EvidenceRow>) => {
    setEvidenceLinks((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addEvidence = () => {
    setEvidenceLinks((prev) => {
      if (prev.length >= MAX_EVIDENCE_LINKS) return prev;
      const nextId = Math.max(...prev.map((row) => row.id)) + 1;
      const selected = new Set(prev.map((row) => row.type));
      const nextType = EVIDENCE_TYPES.find((type) => !selected.has(type.value))?.value ?? 'OTHER';
      return [...prev, { id: nextId, type: nextType, url: '' }];
    });
  };

  const removeEvidence = (id: number) => {
    setEvidenceLinks((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)));
  };

  if (claimState === 'CLAIMED') {
    if (accessState?.success) {
      return (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-center gap-2">
            <span className="text-lg">✓</span>
            <h3 className="font-semibold text-green-800">Access request submitted</h3>
          </div>
          <p className="mt-2 text-sm text-green-700">
            Thanks. Our team will review your organizer access request and get back to you soon.
          </p>
        </div>
      );
    }

    const accessErrors = accessState?.success === false ? accessState.errors : {};

    return (
      <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-700">
        <div className="flex items-center gap-2">
          <span>✓</span>
          <span className="font-medium">Claimed</span>
          <span className="text-green-600">
            - This listing is already managed by an organizer team
          </span>
        </div>

        {!requestExpanded ? (
          <button
            type="button"
            onClick={() => setRequestExpanded(true)}
            className="btn-secondary border-green-300 bg-white px-4 py-2 text-sm"
          >
            Request organizer access
          </button>
        ) : (
          <form
            action={accessFormAction}
            className="space-y-3 rounded-lg border border-green-200 bg-white p-4"
          >
            <input type="hidden" name="communityId" value={communityId} />

            <p className="text-muted text-xs">
              Already helping run this community? Request collaborator access and we&apos;ll review
              it.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="access-name" className="text-foreground block text-sm font-medium">
                  Your Name *
                </label>
                <input
                  id="access-name"
                  name="name"
                  type="text"
                  required
                  className="border-border mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm"
                />
                {accessErrors.name && (
                  <p className="mt-1 text-xs text-red-600">{accessErrors.name[0]}</p>
                )}
              </div>
              <div>
                <label htmlFor="access-email" className="text-foreground block text-sm font-medium">
                  Your Email *
                </label>
                <input
                  id="access-email"
                  name="email"
                  type="email"
                  required
                  className="border-border mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm"
                />
                {accessErrors.email && (
                  <p className="mt-1 text-xs text-red-600">{accessErrors.email[0]}</p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="access-relationship"
                className="text-foreground block text-sm font-medium"
              >
                Your relationship to {communityName} *
              </label>
              <input
                id="access-relationship"
                name="relationship"
                required
                placeholder="e.g. Co-organizer, events lead"
                className="border-border mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm"
              />
              {accessErrors.relationship && (
                <p className="mt-1 text-xs text-red-600">{accessErrors.relationship[0]}</p>
              )}
            </div>

            <div>
              <label htmlFor="access-message" className="text-foreground block text-sm font-medium">
                Message (optional)
              </label>
              <textarea
                id="access-message"
                name="message"
                rows={2}
                maxLength={500}
                className="border-border mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm"
                placeholder="Share context that helps with verification"
              />
              {accessErrors.message && (
                <p className="mt-1 text-xs text-red-600">{accessErrors.message[0]}</p>
              )}
            </div>

            {accessErrors._ && <p className="text-xs text-red-600">{accessErrors._[0]}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={accessPending}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                {accessPending ? 'Submitting...' : 'Submit access request'}
              </button>
              <button
                type="button"
                onClick={() => setRequestExpanded(false)}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
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
          <p>Our team will review your request - this usually takes 1-2 days.</p>
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
    // Don't show anything to random visitors - a pending claim is an internal state
    return null;
  }

  const errors = state?.success === false ? state.errors : {};

  return (
    <div className="border-brand-100 bg-brand-50 rounded-[var(--radius-panel)] border p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-brand-900 font-medium">Do you run this community?</p>
          <p className="text-brand-700 mt-0.5 text-sm">
            {content.COMMUNITY_ACTION_COPY.claimSectionLead}
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

          <p className="text-muted text-sm leading-relaxed">
            {content.COMMUNITY_ACTION_COPY.claimSectionHint}
          </p>

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
              <span className="text-muted font-normal">(optional - helps us verify faster)</span>
            </p>
            <div className="mt-3 space-y-3">
              {evidenceLinks.map((row, index) => {
                const selectedByOthers = new Set(
                  evidenceLinks.filter((item) => item.id !== row.id).map((item) => item.type),
                );
                const availableTypes = EVIDENCE_TYPES.filter(
                  (option) => !selectedByOthers.has(option.value),
                );

                return (
                  <div
                    key={row.id}
                    className="border-border rounded-[var(--radius-button)] border p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-muted text-xs font-medium tracking-wide uppercase">
                        Evidence link {index + 1}
                      </p>
                      {evidenceLinks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEvidence(row.id)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[170px,1fr]">
                      <select
                        value={row.type}
                        onChange={(e) =>
                          updateEvidence(row.id, {
                            type: e.target.value as EvidenceRow['type'],
                          })
                        }
                        className="border-border focus:border-brand-500 focus:ring-brand-100 rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
                      >
                        {availableTypes.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <input
                        type="url"
                        value={row.url}
                        onChange={(e) => updateEvidence(row.id, { url: e.target.value })}
                        className="border-border focus:border-brand-500 focus:ring-brand-100 rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={addEvidence}
                  disabled={evidenceLinks.length >= MAX_EVIDENCE_LINKS}
                  className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
                >
                  + Add proof link
                </button>
                <p className="text-muted text-xs">
                  {evidenceLinks.length}/{MAX_EVIDENCE_LINKS}
                </p>
              </div>

              <input
                type="hidden"
                name="evidenceLinksJson"
                value={JSON.stringify(
                  evidenceLinks
                    .map((row) => ({ type: row.type, url: row.url.trim() }))
                    .filter((row) => row.url.length > 0),
                )}
              />
              {errors.evidenceLinks && (
                <p className="mt-1 text-sm text-red-600">{errors.evidenceLinks[0]}</p>
              )}
            </div>
          </div>

          <p className="text-muted text-xs leading-relaxed">
            By submitting, you agree that IndLokal may process your submitted name and email to
            review this claim, as described in our{' '}
            <Link href="/privacy" className="text-brand-600 hover:underline">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link href="/terms" className="text-brand-600 hover:underline">
              Terms
            </Link>
            .
          </p>

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
