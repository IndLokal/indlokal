'use client';

import { editEvent } from './actions';
import { OrganizerEventFormWrapper } from '@/components/organizer/OrganizerEventFormWrapper';
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
  return (
    <OrganizerEventFormWrapper
      action={editEvent.bind(null, event.slug)}
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
      surfaceContributionRequirements
      bannerText="Editing a community event keeps it published and updates the public listing."
    />
  );
}
