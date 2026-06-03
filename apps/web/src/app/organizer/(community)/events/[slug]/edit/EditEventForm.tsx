'use client';

import { useActionState } from 'react';
import { editEvent, type EditEventResult } from './actions';
import { EventFormFields } from '@/components/organizer/event-form-fields';
import { type RecurrencePreset } from '@/lib/events/recurrence';

type EventDefaults = {
  slug: string;
  title: string;
  description: string | null;
  categorySlugs: string[];
  startsAt: string;
  endsAt: string;
  recurrencePreset: RecurrencePreset;
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
  categories,
}: {
  event: EventDefaults;
  communityName: string;
  categories: { slug: string; name: string; icon: string | null }[];
}) {
  const [state, formAction, isPending] = useActionState<EditEventResult, FormData>(
    editEvent.bind(null, event.slug),
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
        imageUrl: event.imageUrl ?? '',
        registrationUrl: event.registrationUrl ?? '',
        cost: (event.cost ?? 'free') as 'free' | 'paid' | 'unclear',
      }}
      titlePlaceholder={`${communityName} - Diwali Celebration`}
      submitLabel="Save changes"
      pendingLabel="Saving..."
      cancelHref="/organizer/events"
      categories={categories}
      showImageUrl
      bannerText="Editing a community event keeps it published and updates the public listing."
    />
  );
}
