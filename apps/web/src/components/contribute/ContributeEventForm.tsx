'use client';

import { useActionState, useEffect } from 'react';
import { contributeEvent, type ContributeEventResult } from '@/app/actions/contributions';
import { ConfirmationModal } from './ConfirmationModal';
import { Events, useTrackEvent } from '@/lib/analytics';
import { EventFormFields } from '@/components/organizer/event-form-fields';
import { DEFAULT_RECURRENCE_PRESET } from '@/lib/events/recurrence';

type ContributeEventCategory = { slug: string; name: string; icon: string | null };
type ContributeEventCity = { id: string; name: string };

function toLocalInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ContributeEventForm({
  citySlug,
  cityId,
  cityName,
  cities,
  categories,
}: {
  citySlug?: string;
  cityId?: string;
  cityName?: string;
  cities?: ContributeEventCity[];
  categories: ContributeEventCategory[];
}) {
  const [state, formAction, isPending] = useActionState<ContributeEventResult, FormData>(
    contributeEvent,
    null,
  );
  const track = useTrackEvent();

  const defaultStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toLocalInputValue(d);
  })();

  const defaultEnd = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(d.getHours() + 2);
    return toLocalInputValue(d);
  })();

  useEffect(() => {
    track(Events.CONTRIBUTION_STARTED, {
      entity_type: 'EVENT',
      city_slug: citySlug ?? null,
    });
  }, [citySlug, track]);

  if (state?.success) {
    const query = encodeURIComponent(state.title);
    return (
      <ConfirmationModal
        entityType="event"
        entityName={state.title}
        isOpen={true}
        backHref={citySlug ? `/${citySlug}/events` : '/contribute'}
        backLabel={citySlug ? 'Back to events' : 'Back to contribute'}
        similarHref={citySlug ? `/${citySlug}/search?q=${query}` : `/search?q=${query}`}
      />
    );
  }

  const errorMap: Record<string, string[]> = state?.success === false ? { _: [state.error] } : {};

  return (
    <EventFormFields
      action={formAction}
      isPending={isPending}
      errors={errorMap}
      values={{
        title: '',
        description: '',
        categorySlugs: [],
        startsAt: defaultStart,
        endsAt: defaultEnd,
        recurrencePreset: DEFAULT_RECURRENCE_PRESET,
        venueName: '',
        venueAddress: '',
        isOnline: false,
        onlineLink: '',
        registrationUrl: '',
        cost: 'unclear',
        accessType: 'UNCLEAR',
      }}
      titlePlaceholder="e.g. Holi Celebration 2026"
      submitLabel="Contribute event"
      pendingLabel="Submitting..."
      cancelHref={citySlug ? `/${citySlug}/contribute` : '/contribute'}
      cityMode={citySlug ? 'readonly' : 'select'}
      cities={cities}
      selectedCityId={cityId}
      cityName={cityName}
      categories={categories}
      bannerText="Share full details so the event can be verified and published faster."
      showSourceUrl
      preserveValuesOnError
      extraFields={
        <>
          {citySlug ? <input type="hidden" name="citySlug" value={citySlug} /> : null}

          <div>
            <label htmlFor="reporterEmail" className="text-foreground block text-sm font-medium">
              Your email <span className="text-muted">(optional)</span>
            </label>
            <input
              id="reporterEmail"
              name="reporterEmail"
              type="email"
              placeholder="We'll notify you after review"
              className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
            />
          </div>
        </>
      }
    />
  );
}
