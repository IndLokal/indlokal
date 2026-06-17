'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Props = {
  fallbackCitySlug: string;
};

type JourneySave = {
  citySlug: string;
  personaSlug: string;
};

const JOURNEY_PREFIX = 'journey:saved:';

function readJourneySaves(): JourneySave[] {
  try {
    const saves: JourneySave[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(JOURNEY_PREFIX)) continue;
      if (localStorage.getItem(key) !== '1') continue;
      const parts = key.split(':');
      if (parts.length < 4) continue;
      saves.push({ citySlug: parts[2], personaSlug: parts[3] });
    }
    return saves;
  } catch {
    return [];
  }
}

export function LocalDeviceSavesCard({ fallbackCitySlug }: Props) {
  const [journeySaves, setJourneySaves] = useState<JourneySave[]>([]);

  useEffect(() => {
    const refresh = () => {
      setJourneySaves(readJourneySaves());
    };

    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('journey:saved-changed', refresh);

    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('journey:saved-changed', refresh);
    };
  }, []);

  const uniqueJourneySaves = useMemo(() => {
    const dedup = new Map<string, JourneySave>();
    for (const save of journeySaves) {
      dedup.set(`${save.citySlug}:${save.personaSlug}`, save);
    }
    return [...dedup.values()];
  }, [journeySaves]);

  return (
    <section>
      <h2 className="text-xl font-semibold">Journey Bookmarks On This Device</h2>
      <p className="text-muted mt-1 text-sm">
        Journey bookmark state remains local to this browser/device. Resource saves are now
        account-backed and sync across devices.
      </p>

      <div className="mt-4">
        <div className="card-base p-4">
          <p className="text-muted text-xs font-semibold tracking-[0.08em] uppercase">Journeys</p>
          <p className="text-foreground mt-2 text-2xl font-semibold">{uniqueJourneySaves.length}</p>
          <p className="text-muted mt-1 text-sm">
            Saved journey bookmark{uniqueJourneySaves.length === 1 ? '' : 's'}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {uniqueJourneySaves.slice(0, 3).map((save) => (
              <Link
                key={`${save.citySlug}:${save.personaSlug}`}
                href={`/${save.citySlug}/journeys/${save.personaSlug}`}
                className="bg-brand-50 text-brand-800 rounded-full px-3 py-1 text-xs font-medium"
              >
                {save.citySlug} / {save.personaSlug}
              </Link>
            ))}
            {uniqueJourneySaves.length > 3 && (
              <span className="text-muted text-xs">+{uniqueJourneySaves.length - 3} more</span>
            )}
            {uniqueJourneySaves.length === 0 && (
              <>
                <span className="text-muted text-xs">No journey bookmarks on this device yet.</span>
                <Link
                  href={`/${fallbackCitySlug}/journeys`}
                  className="text-brand-600 hover:text-brand-700 text-xs font-medium hover:underline"
                >
                  Open journeys →
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
