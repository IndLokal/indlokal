'use client';

import { useSyncExternalStore } from 'react';
import { Events } from '@/lib/analytics';

type Props = {
  citySlug: string;
  persona: string;
  personaSlug: string;
};

const keyFor = (citySlug: string, personaSlug: string) =>
  `journey:saved:${citySlug}:${personaSlug}`;
const STORE_EVENT = 'journey:saved-changed';

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(STORE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(STORE_EVENT, callback);
  };
}

function readSaved(citySlug: string, personaSlug: string): boolean {
  try {
    return localStorage.getItem(keyFor(citySlug, personaSlug)) === '1';
  } catch {
    return false;
  }
}

/**
 * "Save this journey" — persists a lightweight bookmark to localStorage (no
 * account required, mirrors the resources checklist in PRD-0030) and tracks
 * `journey_save`. Hydration-safe via useSyncExternalStore (server snapshot is
 * always unsaved, then the client reconciles from storage).
 */
export function JourneySaveButton({ citySlug, persona, personaSlug }: Props) {
  const saved = useSyncExternalStore(
    subscribe,
    () => readSaved(citySlug, personaSlug),
    () => false,
  );

  const toggle = () => {
    const next = !saved;
    try {
      if (next) localStorage.setItem(keyFor(citySlug, personaSlug), '1');
      else localStorage.removeItem(keyFor(citySlug, personaSlug));
    } catch {
      /* storage unavailable */
    }
    window.dispatchEvent(new Event(STORE_EVENT));
    if (next) {
      fetch('/api/v1/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: Events.JOURNEY_SAVE,
          entityType: 'RESOURCE',
          entityId: `journey:${personaSlug}`,
          citySlug,
          metadata: { persona, persona_slug: personaSlug },
        }),
      }).catch(() => {});
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      className={
        saved
          ? 'border-brand-300 bg-brand-50 text-brand-800 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors'
          : 'text-foreground hover:border-brand-300 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium transition-colors'
      }
    >
      <span aria-hidden>{saved ? '★' : '☆'}</span>
      {saved ? 'Saved' : 'Save this journey'}
    </button>
  );
}
