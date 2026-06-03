'use client';

import { useActionState } from 'react';
import { editHostEvent, type EditHostEventResult } from './actions';
import { EventFormFields } from '@/components/organizer/event-form-fields';
import { type RecurrencePreset } from '@/lib/events/recurrence';

type City = { id: string; name: string };

type EventDefaults = {
  slug: string;
  title: string;
  description: string | null;
  cityId: string;
  categorySlugs: string[];
  startsAt: string;
  endsAt: string;
  recurrencePreset: RecurrencePreset;
  venueName: string | null;
  venueAddress: string | null;
  isOnline: boolean;
  onlineLink: string | null;
  registrationUrl: string | null;
  cost: string | null;
};

export default function EditHostEventForm({
  event,
  city,
  categories,
}: {
  event: EventDefaults;
  city: City;
  categories: { slug: string; name: string; icon: string | null }[];
}) {
  const [state, formAction, isPending] = useActionState<EditHostEventResult, FormData>(
    editHostEvent.bind(null, event.slug),
    null,
  );

  const errors = state?.success === false ? state.errors : {};

  return (
    <EventFormFields
      action={formAction}
      isPending={isPending}
      errors={errors}
      values={{
        title: event.title,
        description: event.description ?? '',
        categorySlugs: event.categorySlugs,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        recurrencePreset: event.recurrencePreset,
        venueName: event.venueName ?? '',
        venueAddress: event.venueAddress ?? '',
        isOnline: event.isOnline,
        onlineLink: event.onlineLink ?? '',
        registrationUrl: event.registrationUrl ?? '',
        cost: (event.cost ?? 'free') as 'free' | 'paid' | 'unclear',
      }}
      titlePlaceholder="e.g. Bharatanatyam Workshop - Summer 2026"
      submitLabel="Save changes"
      pendingLabel="Saving..."
      cancelHref="/organizer/host/events"
      cityMode="readonly"
      selectedCityId={event.cityId}
      cityName={city.name}
      categories={categories}
      bannerText="Editing a host event sends it back to review before it appears publicly."
    />
  );
}
