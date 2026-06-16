'use client';

import { startTransition, useState } from 'react';
import { useActionState } from 'react';
import { CitySearchSelect } from '@/components/ui';
import { requestCommunityCityChange, type CityChangeRequestResult } from '../edit/actions';

type CityOption = {
  id: string;
  name: string;
  slug: string;
};

type ExistingRequest = {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  toCityId?: string;
  toCitySlug?: string;
  reason?: string;
  requestedAt?: string;
  reviewNote?: string;
} | null;

function formatRequestedDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export default function CityChangeRequestForm({
  currentCityName,
  currentCityId,
  cityOptions,
  existingRequest,
}: {
  currentCityName: string;
  currentCityId: string;
  cityOptions: CityOption[];
  existingRequest: ExistingRequest;
}) {
  const [state, formAction, isPending] = useActionState<CityChangeRequestResult, FormData>(
    requestCommunityCityChange,
    null,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState('');
  const [cityClientError, setCityClientError] = useState<string | null>(null);

  const selectableCities = cityOptions.filter((city) => city.id !== currentCityId);

  const errors = state?.success === false ? state.errors : {};
  const pendingTarget = existingRequest?.toCityId
    ? cityOptions.find((c) => c.id === existingRequest.toCityId)
    : null;
  const hasPendingRequest = existingRequest?.status === 'PENDING';
  const requestedDateLabel = formatRequestedDate(existingRequest?.requestedAt);

  return (
    <div className="border-border mt-8 rounded-[var(--radius-card)] border bg-white">
      {/* Header row — always visible */}
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <div>
          <p className="text-foreground text-sm font-medium">Community city</p>
          <p className="text-muted text-sm">
            Currently listed in{' '}
            <span className="text-foreground font-medium">{currentCityName}</span>
          </p>
        </div>

        {hasPendingRequest ? (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
            Move pending
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            {isOpen ? 'Cancel' : 'Request city change'}
          </button>
        )}
      </div>

      {/* Pending request banner */}
      {hasPendingRequest && (
        <div className="border-border rounded-b-[var(--radius-card)] border-t bg-amber-50 px-6 py-3 text-sm text-amber-800">
          Awaiting admin approval to move to{' '}
          <span className="font-semibold">{pendingTarget?.name ?? existingRequest?.toCityId}</span>
          {requestedDateLabel ? ` · requested ${requestedDateLabel}` : ''}.
        </div>
      )}

      {/* Rejected note */}
      {existingRequest?.status === 'REJECTED' && existingRequest.reviewNote && (
        <div className="border-border rounded-b-[var(--radius-card)] border-t bg-red-50 px-6 py-3 text-sm text-red-700">
          Last request rejected: {existingRequest.reviewNote}
        </div>
      )}

      {/* Success flash */}
      {state?.success && (
        <div className="border-border rounded-b-[var(--radius-card)] border-t bg-green-50 px-6 py-3 text-sm text-green-700">
          {state.message}
        </div>
      )}

      {/* Collapsible form */}
      {isOpen && !hasPendingRequest && (
        <div className="border-border border-t px-6 pt-4 pb-6">
          <p className="text-muted mb-4 text-sm">
            Same-metro moves are auto-approved. Cross-region moves go to admin review.
          </p>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!selectedCityId) {
                setCityClientError('Please select a city from the list.');
                return;
              }
              const form = event.currentTarget;
              const formData = new FormData(form);
              startTransition(() => {
                formAction(formData);
              });
            }}
          >
            <div>
              <label className="text-foreground block text-sm font-medium">Target city *</label>
              <CitySearchSelect
                className="mt-1"
                name="cityId"
                cities={selectableCities.map((c) => ({ value: c.id, name: c.name }))}
                clientError={cityClientError}
                error={errors.cityId}
                onSelectionChange={(value) => {
                  setSelectedCityId(value);
                  if (value) setCityClientError(null);
                }}
              />
            </div>

            <div>
              <label className="text-foreground block text-sm font-medium">Reason *</label>
              <textarea
                name="reason"
                required
                rows={3}
                className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
                placeholder="Explain what changed (for example relocation, main audience shift, venue move)."
              />
              {errors.reason && <p className="mt-1 text-sm text-red-600">{errors.reason[0]}</p>}
            </div>

            <div>
              <label className="text-foreground block text-sm font-medium">
                Evidence URL <span className="text-muted">(optional)</span>
              </label>
              <input
                name="evidenceUrl"
                type="url"
                placeholder="https://..."
                className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
              />
              {errors.evidenceUrl && (
                <p className="mt-1 text-sm text-red-600">{errors.evidenceUrl[0]}</p>
              )}
            </div>

            {errors._ && <p className="text-sm text-red-600">{errors._[0]}</p>}

            <button
              type="submit"
              disabled={isPending}
              className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
            >
              {isPending ? 'Submitting…' : 'Submit city-change request'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
