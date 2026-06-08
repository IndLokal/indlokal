'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';

type Option = { slug: string; label: string; icon: string };
type Props = {
  citySlug: string;
  /** Allowlisted personas for this city (so we never link to a hidden journey). */
  options: Option[];
};

const KEY = 'journey:last';
const STORE_EVENT = 'journey:last-changed';

/**
 * Record the persona a visitor last opened, so a returning user can continue
 * where they left off. Client-only, no account, no server state — mirrors the
 * localStorage approach used by JourneySaveButton/JourneyBlockDone.
 */
export function recordLastJourney(citySlug: string, personaSlug: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ citySlug, personaSlug, ts: Date.now() }));
    window.dispatchEvent(new Event(STORE_EVENT));
  } catch {
    /* storage unavailable */
  }
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(STORE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(STORE_EVENT, callback);
  };
}

// Cache for the last parsed snapshot to avoid allocating new objects on every read
let cachedSnapshot: { citySlug: string; personaSlug: string } | null = null;
let cachedRaw: string | null = null;

function readLast(): { citySlug: string; personaSlug: string } | null {
  try {
    const raw = localStorage.getItem(KEY);

    // Return cached snapshot if raw value hasn't changed
    if (raw === cachedRaw && cachedSnapshot !== null) {
      return cachedSnapshot;
    }

    if (!raw) {
      cachedRaw = null;
      cachedSnapshot = null;
      return null;
    }

    const parsed = JSON.parse(raw) as { citySlug?: unknown; personaSlug?: unknown };
    if (typeof parsed?.citySlug === 'string' && typeof parsed?.personaSlug === 'string') {
      // Cache the snapshot and raw value for next read
      cachedRaw = raw;
      cachedSnapshot = { citySlug: parsed.citySlug, personaSlug: parsed.personaSlug };
      return cachedSnapshot;
    }

    cachedRaw = null;
    cachedSnapshot = null;
    return null;
  } catch {
    cachedRaw = null;
    cachedSnapshot = null;
    return null;
  }
}

/**
 * "Continue your {persona} guide" chip for returning visitors. Renders nothing
 * on the server and for first-time visitors (hydration-safe via
 * useSyncExternalStore), then appears once the client reconciles the last
 * persona this device opened — but only when it belongs to this city and is
 * still allowlisted.
 */
export function ContinueJourneyChip({ citySlug, options }: Props) {
  const last = useSyncExternalStore(subscribe, readLast, () => null);
  if (!last || last.citySlug !== citySlug) return null;
  const match = options.find((o) => o.slug === last.personaSlug);
  if (!match) return null;

  return (
    <Link
      href={`/${citySlug}/journeys/${match.slug}`}
      className="border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
    >
      <span aria-hidden>{match.icon}</span>
      Continue your {match.label} guide
      <span aria-hidden>→</span>
    </Link>
  );
}
