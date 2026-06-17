'use client';

import { useActionState, useEffect, useState } from 'react';
import { contributeEvent, type ContributeEventResult } from '@/app/actions/contributions';
import { ConfirmationModal } from './ConfirmationModal';
import { Events, useTrackEvent } from '@/lib/analytics';
import { EventFormFields } from '@/components/organizer/event-form-fields';
import { DEFAULT_RECURRENCE_PRESET } from '@/lib/events/recurrence';

type ContributeEventCategory = { slug: string; name: string; icon: string | null };
type ContributeEventCity = { id: string; slug: string; name: string };
type ContributeEventCommunity = { id: string; name: string; cityId: string };

function toLocalInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ContributeEventForm({
  citySlug,
  cityId,
  cityName,
  cities,
  communities,
  prefillCommunityName,
  categories,
}: {
  citySlug?: string;
  cityId?: string;
  cityName?: string;
  cities?: ContributeEventCity[];
  communities?: ContributeEventCommunity[];
  prefillCommunityName?: string;
  categories: ContributeEventCategory[];
}) {
  const [state, formAction, isPending] = useActionState<ContributeEventResult, FormData>(
    contributeEvent,
    null,
  );
  const track = useTrackEvent();
  const defaultSelectedCitySlug =
    citySlug ?? (cityId ? cities?.find((city) => city.id === cityId)?.slug : undefined);
  const [selectedCitySlug, setSelectedCitySlug] = useState(defaultSelectedCitySlug);
  const [selectedCityId, setSelectedCityId] = useState(cityId);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [selectedCommunityName, setSelectedCommunityName] = useState(prefillCommunityName ?? '');

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
    const routeCitySlug = citySlug ? selectedCitySlug : undefined;
    const contributeAnotherHref = routeCitySlug
      ? `/${routeCitySlug}/contribute?type=event`
      : '/contribute?type=event';
    const dismissHref = routeCitySlug ? `/${routeCitySlug}/contribute` : '/contribute';
    return (
      <ConfirmationModal
        entityType="event"
        entityName={state.title}
        isOpen={true}
        backHref={contributeAnotherHref}
        backLabel="Contribute another event"
        dismissHref={dismissHref}
        dismissLabel="Back to contribute"
        similarHref={routeCitySlug ? `/${routeCitySlug}/search?q=${query}` : `/search?q=${query}`}
      />
    );
  }

  const errorMap: Record<string, string[]> = state?.success === false ? { _: [state.error] } : {};
  const routeCitySlug = citySlug ? selectedCitySlug : undefined;
  const cancelHref = routeCitySlug ? `/${routeCitySlug}/contribute` : '/contribute';
  const communityNameQuery = selectedCommunityName.trim()
    ? `&communityName=${encodeURIComponent(selectedCommunityName.trim())}`
    : '';
  const communityAddHref = routeCitySlug
    ? `/${routeCitySlug}/contribute?type=community&returnType=event${communityNameQuery}`
    : `/contribute?type=community&returnType=event${communityNameQuery}`;

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
      cancelHref={cancelHref}
      cityMode="select"
      cities={cities}
      selectedCityId={selectedCityId}
      cityName={cityName}
      onCitySelectionChange={(value) => {
        const nextCity = cities?.find((city) => city.id === value);
        setSelectedCitySlug(nextCity?.slug);
        setSelectedCityId(value);
        setSelectedCommunityId('');
      }}
      communityMode="select"
      communities={communities}
      selectedCommunityId={selectedCommunityId}
      selectedCommunityName={selectedCommunityName}
      onCommunitySelectionChange={(value) => {
        setSelectedCommunityId(value);
        const selected = communities?.find((community) => community.id === value);
        setSelectedCommunityName(selected?.name ?? selectedCommunityName);
      }}
      onCommunityNameChange={(value) => setSelectedCommunityName(value)}
      communityAddHref={communityAddHref}
      categories={categories}
      bannerText="Share full details so the event can be verified and published faster."
      showSourceUrl
      surfaceContributionRequirements
      preserveValuesOnError
      extraFields={
        <>
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
