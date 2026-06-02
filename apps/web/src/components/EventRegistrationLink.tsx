'use client';

import { Events } from '@/lib/analytics';

type Props = {
  href: string;
  eventId: string;
  city: string;
  lensContext?: 'business_careers';
};

export function EventRegistrationLink({ href, eventId, city, lensContext }: Props) {
  function handleClick() {
    const metadata = lensContext ? { lens_context: lensContext } : undefined;

    fetch('/api/v1/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: Events.EVENT_REGISTER_CLICKED,
        entityType: 'EVENT',
        entityId: eventId,
        citySlug: city,
        metadata,
      }),
    }).catch(() => {});
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="btn-secondary px-4 py-2 text-sm"
    >
      Register
    </a>
  );
}
