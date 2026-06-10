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
} from '../journey-state';

type Props = {
  city: string;
  cityName: string;
  candidates: JourneyActionCandidate[];
  enabled: boolean;
};

export function JourneyNextBestAction({ city, cityName, candidates, enabled }: Props) {
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
  const total = candidates.length;

  useEffect(() => {
    if (!enabled || !hydrated) return;
    track(Events.JOURNEY_VIEW, { city, source_surface: 'resources_journey' });
  }, [enabled, hydrated, city, track]);

  useEffect(() => {
    if (!enabled || !hydrated || !nextAction) return;
    track(Events.JOURNEY_NEXT_ACTION_IMPRESSION, {
      city,
      source_surface: 'resources_journey',
      next_action_id: nextAction.id,
      progress_completed: checked.size,
      progress_total: total,
    });
    track(Events.RESOURCE_CTA_IMPRESSION, {
      city,
      cta_surface: 'resources_journey_next_action',
      cta_position: 'primary',
      variant: 'action_first_v1',
    });
  }, [enabled, hydrated, nextAction, city, checked.size, total, track]);

  useEffect(() => {
    if (!enabled || !hydrated || !hasProgress || !nextAction) return;
    track(Events.JOURNEY_RESUME_PROMPT_SHOWN, {
      city,
      source_surface: 'resources_journey',
      next_action_id: nextAction.id,
      progress_completed: checked.size,
      progress_total: total,
    });
  }, [enabled, hydrated, hasProgress, nextAction, city, checked.size, total, track]);

  if (!enabled || !hydrated || total === 0) {
    return null;
  }

  if (!nextAction) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
        <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase">All done</p>
        <h2 className="mt-1 text-lg font-semibold text-emerald-950">
          You have completed all current journey steps in {cityName}
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/${city}/resources`}
            className="inline-flex items-center rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            Browse all resources
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
                source_surface: 'resources_journey',
              });
            }}
          >
            Start over
          </button>
        </div>
      </section>
    );
  }

  const markDone = () => {
    if (checked.has(nextAction.id)) return;
    const next = new Set(checked);
    next.add(nextAction.id);
    setChecked(next);
    window.localStorage.setItem(getJourneyProgressStorageKey(city), serializeJourneyProgress(next));
    track(Events.JOURNEY_STEP_COMPLETED, {
      city,
      source_surface: 'resources_journey',
      action_id: nextAction.id,
    });
    track(Events.JOURNEY_NEXT_ACTION_COMPLETED, {
      city,
      source_surface: 'resources_journey',
      action_id: nextAction.id,
    });
  };

  return (
    <section className="border-brand-200 bg-brand-50/80 rounded-2xl border p-5">
      <p className="text-brand-700 text-xs font-semibold tracking-wide uppercase">
        {hasProgress ? 'Resume' : 'Next best action'}
      </p>
      <h2 className="text-brand-950 mt-1 text-lg font-semibold">{nextAction.title}</h2>
      <p className="text-brand-800 mt-1 text-sm">
        {checked.size} of {total} completed
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={nextAction.href}
          className="bg-brand-700 hover:bg-brand-800 inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold text-white transition"
          onClick={() => {
            track(Events.JOURNEY_NEXT_ACTION_CLICK, {
              city,
              source_surface: 'resources_journey',
              next_action_id: nextAction.id,
            });
            if (hasProgress) {
              track(Events.JOURNEY_RESUME_CLICKED, {
                city,
                source_surface: 'resources_journey',
                next_action_id: nextAction.id,
              });
            }
            track(Events.RESOURCE_CTA_CLICK, {
              city,
              cta_surface: 'resources_journey_next_action',
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
          className="border-brand-300 text-brand-800 hover:bg-brand-100 inline-flex items-center rounded-lg border bg-white px-3 py-2 text-sm font-semibold transition"
          onClick={() => {
            markDone();
            track(Events.RESOURCE_CTA_CLICK, {
              city,
              cta_surface: 'resources_journey_next_action',
              cta_position: 'secondary',
              variant: 'action_first_v1',
              action: 'mark_complete',
            });
          }}
        >
          Mark complete
        </button>
        {checked.size > 0 && (
          <button
            type="button"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            onClick={() => {
              const empty = new Set<string>();
              setChecked(empty);
              window.localStorage.setItem(
                getJourneyProgressStorageKey(city),
                serializeJourneyProgress(empty),
              );
              track(Events.JOURNEY_PROGRESS_RESET, {
                city,
                source_surface: 'resources_journey',
              });
            }}
          >
            Reset progress
          </button>
        )}
      </div>
    </section>
  );
}
