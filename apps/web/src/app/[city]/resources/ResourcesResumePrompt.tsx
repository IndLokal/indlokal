'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Events, useTrackEvent } from '@/lib/analytics';
import {
  getJourneyProgressStorageKey,
  parseJourneyProgress,
  selectNextJourneyAction,
  serializeJourneyProgress,
  type JourneyActionCandidate,
} from './journey-state';

type Props = {
  city: string;
  cityName: string;
  candidates: JourneyActionCandidate[];
  enabled: boolean;
};

export function ResourcesResumePrompt({ city, cityName, candidates, enabled }: Props) {
  const track = useTrackEvent();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const stored = window.localStorage.getItem(getJourneyProgressStorageKey(city));
    setChecked(parseJourneyProgress(stored));
    setHydrated(true);
  }, [city, enabled]);

  const nextAction = useMemo(
    () => selectNextJourneyAction(candidates, checked),
    [candidates, checked],
  );

  const hasProgress = checked.size > 0 && checked.size < candidates.length;

  useEffect(() => {
    if (!enabled || !hydrated || !hasProgress || !nextAction) return;
    track(Events.JOURNEY_RESUME_PROMPT_SHOWN, {
      city,
      progress_completed: checked.size,
      progress_total: candidates.length,
      next_action_id: nextAction.id,
    });
    track(Events.JOURNEY_NEXT_ACTION_IMPRESSION, {
      city,
      source_surface: 'resources_hub',
      next_action_id: nextAction.id,
    });
    track(Events.RESOURCE_CTA_IMPRESSION, {
      city,
      cta_surface: 'resources_hub_resume',
      cta_position: 'primary',
      variant: 'action_first_v1',
    });
  }, [enabled, hydrated, hasProgress, nextAction, city, checked.size, candidates.length, track]);

  if (!enabled || !hydrated || !hasProgress || !nextAction) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase">
            Resume your journey
          </p>
          <h2 className="mt-1 text-lg font-semibold text-emerald-950">
            Pick up where you left off in {cityName}
          </h2>
          <p className="mt-1 text-sm text-emerald-800">
            Next best action: <span className="font-semibold">{nextAction.title}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Link
            href={nextAction.href}
            className="inline-flex items-center rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
            onClick={() => {
              track(Events.JOURNEY_RESUME_CLICKED, {
                city,
                source_surface: 'resources_hub_resume',
                next_action_id: nextAction.id,
              });
              track(Events.JOURNEY_NEXT_ACTION_CLICK, {
                city,
                source_surface: 'resources_hub_resume',
                next_action_id: nextAction.id,
              });
              track(Events.RESOURCE_CTA_CLICK, {
                city,
                cta_surface: 'resources_hub_resume',
                cta_position: 'primary',
                variant: 'action_first_v1',
                next_action_id: nextAction.id,
              });
            }}
          >
            Continue next step
          </Link>
          <button
            type="button"
            className="inline-flex items-center rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
            onClick={() => {
              const empty = new Set<string>();
              setChecked(empty);
              window.localStorage.setItem(
                getJourneyProgressStorageKey(city),
                serializeJourneyProgress(empty),
              );
              track(Events.JOURNEY_PROGRESS_RESET, {
                city,
                source_surface: 'resources_hub_resume',
              });
              track(Events.RESOURCE_CTA_CLICK, {
                city,
                cta_surface: 'resources_hub_resume',
                cta_position: 'secondary',
                variant: 'action_first_v1',
                action: 'reset_progress',
              });
            }}
          >
            Reset progress
          </button>
        </div>
      </div>
    </section>
  );
}
