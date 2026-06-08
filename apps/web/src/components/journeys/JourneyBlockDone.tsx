'use client';

import { useSyncExternalStore } from 'react';

type Props = {
  citySlug: string;
  personaSlug: string;
  blockId: string;
};

const keyFor = (citySlug: string, personaSlug: string) => `journey:done:${citySlug}:${personaSlug}`;
const STORE_EVENT = 'journey:done-changed';

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(STORE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(STORE_EVENT, callback);
  };
}

function readDone(citySlug: string, personaSlug: string): Set<string> {
  try {
    const raw = localStorage.getItem(keyFor(citySlug, personaSlug));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/**
 * Per-block "done" checkbox. Progress is stored client-side (localStorage), so
 * it works without an account — same approach as the resources checklist.
 * Hydration-safe via useSyncExternalStore (server snapshot is always "not done").
 */
export function JourneyBlockDone({ citySlug, personaSlug, blockId }: Props) {
  const done = useSyncExternalStore(
    subscribe,
    () => readDone(citySlug, personaSlug).has(blockId),
    () => false,
  );

  const toggle = () => {
    const set = readDone(citySlug, personaSlug);
    if (set.has(blockId)) set.delete(blockId);
    else set.add(blockId);
    try {
      localStorage.setItem(keyFor(citySlug, personaSlug), JSON.stringify([...set]));
    } catch {
      /* storage unavailable */
    }
    window.dispatchEvent(new Event(STORE_EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={done}
      title={done ? 'Mark as not done' : 'Mark as done'}
      className={
        done
          ? 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs text-white'
          : 'text-muted inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-black/15 text-xs hover:border-emerald-400'
      }
    >
      {done ? '✓' : ''}
    </button>
  );
}
