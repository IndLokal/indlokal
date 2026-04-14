'use client';

import { useActionState } from 'react';
import { updatePreferences, type PreferencesResult } from './actions';

type City = { id: string; name: string; slug: string };

type Props = {
  cities: City[];
  currentCityId: string | null;
  currentPersonas: string[];
  currentLanguages: string[];
};

const PERSONA_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'family', label: 'Family / Parents' },
  { value: 'professional', label: 'Professional' },
  { value: 'newcomer', label: 'Newcomer (< 2 years in Germany)' },
  { value: 'cultural', label: 'Cultural enthusiast' },
  { value: 'religious', label: 'Religious / Spiritual' },
  { value: 'sports', label: 'Sports & Fitness' },
  { value: 'food', label: 'Food & Cooking' },
];

const LANGUAGES = [
  'Hindi',
  'Telugu',
  'Tamil',
  'Kannada',
  'Malayalam',
  'Bengali',
  'Marathi',
  'Gujarati',
  'Punjabi',
  'Odia',
  'Urdu',
  'English',
  'German',
];

export function PreferencesForm({
  cities,
  currentCityId,
  currentPersonas,
  currentLanguages,
}: Props) {
  const [state, formAction, isPending] = useActionState<PreferencesResult, FormData>(
    updatePreferences,
    null,
  );

  return (
    <form action={formAction} className="space-y-6">
      {/* City */}
      <div>
        <label htmlFor="pref-city" className="block text-sm font-medium text-gray-700">
          My City
        </label>
        <select
          id="pref-city"
          name="cityId"
          defaultValue={currentCityId ?? ''}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option value="">No preference</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Persona segments */}
      <div>
        <p className="text-sm font-medium text-gray-700">I identify as</p>
        <p className="mt-0.5 text-xs text-gray-400">Select all that apply</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PERSONA_OPTIONS.map((p) => (
            <label
              key={p.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <input
                type="checkbox"
                name="personaSegments"
                value={p.value}
                defaultChecked={currentPersonas.includes(p.value)}
                className="accent-indigo-600"
              />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      {/* Languages */}
      <div>
        <p className="text-sm font-medium text-gray-700">My Languages</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {LANGUAGES.map((lang) => (
            <label
              key={lang}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <input
                type="checkbox"
                name="preferredLanguages"
                value={lang}
                defaultChecked={currentLanguages.includes(lang)}
                className="accent-indigo-600"
              />
              {lang}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save preferences'}
        </button>
        {state?.success && <span className="text-sm text-green-600">Preferences saved!</span>}
        {state?.success === false && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
