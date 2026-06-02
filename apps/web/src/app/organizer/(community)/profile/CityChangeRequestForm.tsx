'use client';

import { startTransition, useMemo, useState } from 'react';
import { useActionState } from 'react';
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
  const [cityQuery, setCityQuery] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');
  const [isCityMenuOpen, setIsCityMenuOpen] = useState(false);
  const [cityClientError, setCityClientError] = useState<string | null>(null);

  const filteredCities = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    if (!q) return cityOptions.slice(0, 12);
    return cityOptions
      .filter((city) => {
        const name = city.name.toLowerCase();
        const slug = city.slug.toLowerCase();
        return name.includes(q) || slug.includes(q);
      })
      .slice(0, 12);
  }, [cityOptions, cityQuery]);

  const syncCitySelection = (value: string) => {
    const normalized = value.trim().toLowerCase();
    const exact = cityOptions.find((city) => {
      const cityName = city.name.toLowerCase();
      const citySlug = city.slug.toLowerCase();
      return cityName === normalized || citySlug === normalized;
    });
    setSelectedCityId(exact?.id ?? '');
  };

  const handleCityPick = (city: CityOption) => {
    setCityQuery(city.name);
    setSelectedCityId(city.id);
    setCityClientError(null);
    setIsCityMenuOpen(false);
  };

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
              <div className="relative mt-1">
                <input
                  type="text"
                  value={cityQuery}
                  autoComplete="off"
                  placeholder="Search city by name"
                  onChange={(event) => {
                    const value = event.target.value;
                    setCityQuery(value);
                    syncCitySelection(value);
                    setCityClientError(null);
                  }}
                  onFocus={() => setIsCityMenuOpen(true)}
                  onBlur={() => {
                    setIsCityMenuOpen(false);
                    syncCitySelection(cityQuery);
                  }}
                  className="input-base"
                />

                {isCityMenuOpen && filteredCities.length > 0 && (
                  <div className="border-border mt-1 max-h-56 w-full overflow-y-auto rounded-[var(--radius-button)] border bg-white shadow-sm">
                    {filteredCities
                      .filter((city) => city.id !== currentCityId)
                      .map((city) => (
                        <button
                          key={city.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleCityPick(city)}
                          className="hover:bg-brand-50 block w-full px-3 py-2 text-left text-sm"
                        >
                          <span className="text-foreground">{city.name}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <input type="hidden" name="cityId" value={selectedCityId} />
              {cityClientError && <p className="mt-1 text-sm text-red-600">{cityClientError}</p>}
              {errors.cityId && <p className="mt-1 text-sm text-red-600">{errors.cityId[0]}</p>}
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
