'use client';

import { addEvent } from './actions';
import { OrganizerEventFormWrapper } from '@/components/organizer/OrganizerEventFormWrapper';
import { DEFAULT_RECURRENCE_PRESET } from '@/lib/events/recurrence';

type Category = { slug: string; name: string; icon: string | null };

export default function AddEventForm({
  communityName,
  categories,
}: {
  communityName: string;
  categories: Category[];
}) {
  function toLocalInputValue(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }

  // Local datetime value for "now + 1 week" as default
  const defaultStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    // Format: YYYY-MM-DDTHH:MM (local, no seconds)
    return toLocalInputValue(d);
  })();

  // Default end: two hours after the default start.
  const defaultEnd = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(d.getHours() + 2);
    return toLocalInputValue(d);
  })();

  return (
    <OrganizerEventFormWrapper
      action={addEvent}
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
        imageUrl: '',
        registrationUrl: '',
        cost: 'free',
      }}
      titlePlaceholder={`${communityName} - Diwali Celebration`}
      submitLabel="Publish event"
      pendingLabel="Publishing..."
      cancelHref="/organizer"
      categories={categories}
      showImageUrl
      surfaceContributionRequirements
      bannerText="Publish directly to your community summary page."
    />
  );
}
