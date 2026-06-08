'use client';

import Link from 'next/link';
import { Events } from '@/lib/analytics';

export type PersonaOption = {
  persona: string;
  slug: string;
  label: string;
  icon: string;
};

type Props = {
  citySlug: string;
  current: string;
  options: PersonaOption[];
};

/**
 * Horizontal persona pill row shown on a journey page. Switching tracks
 * `journey_persona_switch` and navigates to that persona's journey.
 */
export function PersonaSwitcher({ citySlug, current, options }: Props) {
  const track = (to: string) => {
    fetch('/api/v1/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: Events.JOURNEY_PERSONA_SWITCH,
        citySlug,
        metadata: { from: current, to },
      }),
    }).catch(() => {});
  };

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Choose a journey">
      {options.map((opt) => {
        const active = opt.slug === current;
        return (
          <Link
            key={opt.slug}
            href={`/${citySlug}/journeys/${opt.slug}`}
            role="tab"
            aria-selected={active}
            onClick={() => !active && track(opt.slug)}
            className={
              active
                ? 'bg-brand-600 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium text-white'
                : 'text-foreground hover:border-brand-300 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-sm font-medium transition-colors'
            }
          >
            <span aria-hidden>{opt.icon}</span>
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
