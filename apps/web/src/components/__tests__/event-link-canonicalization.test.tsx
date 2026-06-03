import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventCard } from '../EventCard';

describe('Event link canonicalization', () => {
  it('uses the metro canonical slug for satellite city links', () => {
    const event = {
      id: 'evt1',
      title: 'Fiesta International 2026',
      slug: 'fiesta-international-2026-mpwltpaq',
      startsAt: new Date().toISOString(),
      categories: [],
      isRecurring: false,
      venueName: 'International Fiesta',
      isOnline: false,
      cost: 'unclear',
      community: null,
      city: { name: 'Fellbach', slug: 'fellbach' },
    };

    render(<EventCard event={event as any} city="fellbach" />);

    const link = screen.getByRole('link');
    // Expect metro canonicalization: fellbach -> stuttgart
    expect(link).toHaveAttribute('href', expect.stringContaining('/stuttgart/events/'));
  });
});
