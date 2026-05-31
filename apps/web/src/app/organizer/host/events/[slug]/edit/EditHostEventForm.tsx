'use client';

import { useActionState } from 'react';
import { editHostEvent, type EditHostEventResult } from './actions';
import { EventFormFields } from '@/components/organizer/event-form-fields';

type City = { id: string; name: string };

type EventDefaults = {
  slug: string;
  title: string;
  description: string | null;
  cityId: string;
  startsAt: string;
  endsAt: string;
  venueName: string | null;
  venueAddress: string | null;
  isOnline: boolean;
  onlineLink: string | null;
  registrationUrl: string | null;
  cost: string | null;
};

export default function EditHostEventForm({ event, city }: { event: EventDefaults; city: City }) {
  const [state, formAction, isPending] = useActionState<EditHostEventResult, FormData>(
    editHostEvent,
    null,
  );

  const errors = state?.success === false ? state.errors : {};

  return (
    <EventFormFields
      action={formAction}
      isPending={isPending}
      errors={errors}
      values={{
        ...event,
        description: event.description ?? '',
        venueName: event.venueName ?? '',
        venueAddress: event.venueAddress ?? '',
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
      bannerText="Editing a host event sends it back to review before it appears publicly."
    />
  );
}
