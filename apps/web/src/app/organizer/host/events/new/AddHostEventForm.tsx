'use client';

import { useActionState } from 'react';
import { addHostEvent } from './actions';
import type { AddHostEventResult } from './actions';
import { EventFormFields } from '@/components/organizer/event-form-fields';
import { DEFAULT_RECURRENCE_PRESET } from '@/lib/events/recurrence';

type City = { id: string; name: string };
type Category = { slug: string; name: string; icon: string | null };

type Props = {
  cities: City[];
  categories: Category[];
  defaultCityId?: string;
};

export function AddHostEventForm({ cities, categories, defaultCityId }: Props) {
  const [state, action, pending] = useActionState<AddHostEventResult, FormData>(addHostEvent, null);

  const errors = state && !state.success ? state.errors : {};

  const selectedCityId = defaultCityId ?? cities[0]?.id ?? '';

  return (
    <EventFormFields
      action={action}
      isPending={pending}
      errors={errors}
      values={{
        title: '',
        description: '',
        categorySlugs: [],
        startsAt: '',
        endsAt: '',
        recurrencePreset: DEFAULT_RECURRENCE_PRESET,
        venueName: '',
        venueAddress: '',
        isOnline: false,
        onlineLink: '',
        registrationUrl: '',
        cost: 'free',
      }}
      titlePlaceholder="e.g. Bharatanatyam Workshop - Summer 2026"
      submitLabel="Publish event"
      pendingLabel="Publishing…"
      cancelHref="/organizer/host"
      cityMode={defaultCityId ? 'hidden' : 'select'}
      cities={cities}
      selectedCityId={selectedCityId}
      categories={categories}
      showImageUrl={false}
      surfaceContributionRequirements
      bannerText="Submit to the host review queue; edits after publish return to review."
    />
  );
}
