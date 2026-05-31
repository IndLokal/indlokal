'use client';

import { useActionState } from 'react';
import { editEvent, type EditEventResult } from './actions';
import { EventFormFields } from '@/components/organizer/event-form-fields';

type EventDefaults = {
  slug: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  venueName: string | null;
  venueAddress: string | null;
  isOnline: boolean;
  onlineLink: string | null;
  imageUrl: string | null;
  registrationUrl: string | null;
  cost: string | null;
};

export default function EditEventForm({
  event,
  communityName,
}: {
  event: EventDefaults;
  communityName: string;
}) {
  const [state, formAction, isPending] = useActionState<EditEventResult, FormData>(editEvent, null);

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
        imageUrl: event.imageUrl ?? '',
        registrationUrl: event.registrationUrl ?? '',
        cost: (event.cost ?? 'free') as 'free' | 'paid' | 'unclear',
      }}
      titlePlaceholder={`${communityName} - Diwali Celebration`}
      submitLabel="Save changes"
      pendingLabel="Saving..."
      cancelHref="/organizer/events"
      showImageUrl
      bannerText="Editing a community event keeps it published and updates the public listing."
    />
  );
}
