'use client';

import Link from 'next/link';
import { Events } from '@/lib/analytics';

type Props = {
  citySlug: string;
  personaSlug: string;
  label: string;
  tagline: string;
  icon: string;
  gradient: string;
  /** Where the entry point is shown — for analytics attribution. */
  surface: string;
};

/**
 * A persona entry card used on the landing page and city feed. Clicking tracks
 * `journey_entry_click` (surface-attributed) and opens the journey.
 */
export function JourneyEntryCard({
  citySlug,
  personaSlug,
  label,
  tagline,
  icon,
  gradient,
  surface,
}: Props) {
  const track = () => {
    fetch('/api/v1/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: Events.JOURNEY_ENTRY_CLICK,
        entityType: 'RESOURCE',
        entityId: `journey:${personaSlug}`,
        citySlug,
        metadata: { persona_slug: personaSlug, surface },
      }),
    }).catch(() => {});
  };

  return (
    <Link
      href={`/${citySlug}/journeys/${personaSlug}`}
      onClick={track}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-5 ring-1 ring-black/[0.02] transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${gradient}`} />
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-2xl shadow-sm`}
        aria-hidden
      >
        {icon}
      </span>
      <div>
        <h3 className="text-foreground font-semibold">{label}</h3>
        <p className="text-muted mt-1 text-sm">{tagline}</p>
      </div>
      <span className="text-brand-700 mt-auto text-sm font-medium group-hover:underline">
        See the guide →
      </span>
    </Link>
  );
}
