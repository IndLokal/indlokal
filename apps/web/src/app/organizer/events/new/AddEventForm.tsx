'use client';

import { useActionState } from 'react';
import { addEvent, type AddEventResult } from './actions';
import { EventFormFields } from '@/components/organizer/event-form-fields';

export default function AddEventForm({ communityName }: { communityName: string }) {
  const [state, formAction, isPending] = useActionState<AddEventResult, FormData>(addEvent, null);

  const errors = state?.success === false ? state.errors : {};

  // Local datetime value for "now + 1 week" as default
  const defaultStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    // Format: YYYY-MM-DDTHH:MM (local, no seconds)
    return d.toISOString().slice(0, 16);
  })();

  // Default end: two hours after the default start.
  const defaultEnd = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(d.getHours() + 2);
    return d.toISOString().slice(0, 16);
  })();

  return (
    <EventFormFields
      action={formAction}
      isPending={isPending}
      errors={errors}
      values={{
        title: '',
        description: '',
        startsAt: defaultStart,
        endsAt: defaultEnd,
        venueName: '',
        venueAddress: '',
        isOnline: false,
        onlineLink: '',
        imageUrl: '',
        registrationUrl: '',
        cost: 'free',
      }}
      titlePlaceholder={`${communityName} - Diwali Celebration`}
      submitLabel="Publish event"
      pendingLabel="Publishing..."
      cancelHref="/organizer"
      showImageUrl
      bannerText="Publish directly to your community summary page."
    />
  );
}
