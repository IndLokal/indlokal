'use client';

import { useActionState, useState } from 'react';
import { communityOptions } from '@indlokal/shared';
import { submitAmbassadorCommunity, submitAmbassadorEvent } from './actions';
import type { SubmitResult } from '../lib/form-state';
import { FormField, SelectInput, TextArea, TextInput } from '@/components/forms/fields';

type Mode = 'community' | 'event';

type Category = { slug: string; name: string; icon: string | null };

type Props = {
  cities: Array<{ id: string; name: string }>;
  categories: Category[];
  defaultCityId?: string;
};

const INITIAL_CATEGORY_COUNT = 6;

function ResultBanner({ state }: { state: SubmitResult | null }) {
  if (!state) return null;
  if (state.success) {
    return (
      <div className="mb-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
        {state.message}
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
  );
}

function CategoryChecklist({ categories }: { categories: Category[] }) {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const visibleCategories = showAllCategories
    ? categories
    : categories.slice(0, INITIAL_CATEGORY_COUNT);

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visibleCategories.map((category) => (
          <label
            key={category.slug}
            className="border-border hover:bg-brand-50 hover:border-brand-200 has-[:checked]:bg-brand-50 has-[:checked]:border-brand-300 has-[:checked]:text-brand-700 flex cursor-pointer items-center gap-2 rounded-[var(--radius-button)] border bg-white px-3.5 py-2.5 text-sm transition-all"
          >
            <input
              type="checkbox"
              name="categories"
              value={category.slug}
              className="accent-brand-500"
            />
            <span>
              {category.icon} {category.name}
            </span>
          </label>
        ))}
      </div>
      {categories.length > INITIAL_CATEGORY_COUNT && (
        <button
          type="button"
          onClick={() => setShowAllCategories((prev) => !prev)}
          className="text-brand-700 text-xs font-medium hover:underline"
        >
          {showAllCategories ? 'Show fewer categories' : 'Show all categories'}
        </button>
      )}
    </>
  );
}

function LanguageChecklist() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {communityOptions.COMMUNITY_LANGUAGE_VALUES.map((language) => (
        <label
          key={language}
          className="border-border hover:bg-brand-50 hover:border-brand-200 has-[:checked]:bg-brand-50 has-[:checked]:border-brand-300 has-[:checked]:text-brand-700 flex cursor-pointer items-center gap-2 rounded-[var(--radius-button)] border bg-white px-3.5 py-2.5 text-sm transition-all"
        >
          <input type="checkbox" name="languages" value={language} className="accent-brand-500" />
          <span>{language}</span>
        </label>
      ))}
    </div>
  );
}

function CityField({
  cities,
  defaultCityId,
}: {
  cities: Array<{ id: string; name: string }>;
  defaultCityId?: string;
}) {
  if (defaultCityId) {
    return <input type="hidden" name="cityId" value={defaultCityId} />;
  }

  return (
    <FormField label="City" htmlFor="cityId" required>
      <SelectInput id="cityId" name="cityId" required defaultValue={cities[0]?.id ?? ''}>
        {cities.map((city) => (
          <option key={city.id} value={city.id}>
            {city.name}
          </option>
        ))}
      </SelectInput>
    </FormField>
  );
}

function CommunityFields({ cities, categories, defaultCityId }: Props) {
  return (
    <>
      <fieldset className="card-base space-y-4 p-5">
        <legend className="text-foreground -ml-1 text-base font-bold">Community details</legend>
        <CityField cities={cities} defaultCityId={defaultCityId} />
        <FormField label="Community name" htmlFor="name" required>
          <TextInput id="name" name="name" required placeholder="e.g. Stuttgart Tamil Sangam" />
        </FormField>
        <FormField label="Short description" htmlFor="description">
          <TextArea
            id="description"
            name="description"
            rows={3}
            placeholder="What is this community about? Who is it for?"
          />
        </FormField>
      </fieldset>

      <fieldset className="card-base space-y-4 p-5">
        <legend className="text-foreground -ml-1 text-base font-bold">
          Categories & languages
        </legend>
        <div className="space-y-3">
          <FormField
            label="Categories"
            hint="Choose the tags that best describe this community."
            className="space-y-3"
          >
            <CategoryChecklist categories={categories} />
          </FormField>
          <FormField
            label="Languages"
            hint="Optional, but helpful for review and discovery."
            className="space-y-3"
          >
            <LanguageChecklist />
          </FormField>
        </div>
      </fieldset>

      <fieldset className="card-base space-y-4 p-5">
        <legend className="text-foreground -ml-1 text-base font-bold">Access details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Primary channel" htmlFor="channelType">
            <SelectInput
              id="channelType"
              name="channelType"
              defaultValue={communityOptions.CHANNEL_TYPE_VALUES[0]}
            >
              {communityOptions.CHANNEL_TYPE_VALUES.map((channelType) => (
                <option key={channelType} value={channelType}>
                  {communityOptions.CHANNEL_TYPE_ICONS[channelType]}{' '}
                  {communityOptions.CHANNEL_TYPE_LABELS[channelType]}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField
            label="Channel link / handle"
            htmlFor="channelValue"
            hint="For email, enter an address. For social channels, paste the invite or profile link."
          >
            <TextInput
              id="channelValue"
              name="channelValue"
              placeholder="https://… or hello@example.com"
            />
          </FormField>
        </div>
        <FormField label="Contact email" htmlFor="contactEmail">
          <TextInput
            id="contactEmail"
            name="contactEmail"
            type="email"
            placeholder="hello@example.com"
          />
        </FormField>
        <FormField label="Notes for reviewer" htmlFor="communityNotes">
          <TextArea
            id="communityNotes"
            name="notes"
            rows={3}
            placeholder="Anything the reviewer should know..."
          />
        </FormField>
      </fieldset>
    </>
  );
}

function EventFields({ cities, categories, defaultCityId }: Props) {
  return (
    <>
      <fieldset className="card-base space-y-4 p-5">
        <legend className="text-foreground -ml-1 text-base font-bold">Event details</legend>
        <CityField cities={cities} defaultCityId={defaultCityId} />
        <FormField label="Event title" htmlFor="title" required>
          <TextInput
            id="title"
            name="title"
            required
            placeholder="e.g. Diwali Night Stuttgart 2026"
          />
        </FormField>
        <FormField label="Description" htmlFor="eventDescription">
          <TextArea
            id="eventDescription"
            name="description"
            rows={3}
            placeholder="What is happening, who is it for, and what should attendees expect?"
          />
        </FormField>
        <FormField label="Community / organiser" htmlFor="communityName">
          <TextInput
            id="communityName"
            name="communityName"
            placeholder="Name of the organising community"
          />
        </FormField>
      </fieldset>

      <fieldset className="card-base space-y-4 p-5">
        <legend className="text-foreground -ml-1 text-base font-bold">Date, time & venue</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Start date" htmlFor="startDate">
            <TextInput id="startDate" name="startDate" type="date" />
          </FormField>
          <FormField label="Start time" htmlFor="startTime">
            <TextInput id="startTime" name="startTime" type="time" />
          </FormField>
          <FormField label="End date" htmlFor="endDate">
            <TextInput id="endDate" name="endDate" type="date" />
          </FormField>
          <FormField label="End time" htmlFor="endTime">
            <TextInput id="endTime" name="endTime" type="time" />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Venue name" htmlFor="venueName">
            <TextInput id="venueName" name="venueName" placeholder="e.g. Community Hall" />
          </FormField>
          <FormField label="Venue address" htmlFor="venueAddress">
            <TextInput id="venueAddress" name="venueAddress" placeholder="Street, area, postcode" />
          </FormField>
        </div>
        <label className="border-border flex items-center gap-2 rounded-[var(--radius-button)] border bg-white px-3.5 py-2.5 text-sm">
          <input type="checkbox" name="isOnline" className="accent-brand-500" />
          <span>Online event</span>
        </label>
      </fieldset>

      <fieldset className="card-base space-y-4 p-5">
        <legend className="text-foreground -ml-1 text-base font-bold">Registration & tags</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Registration URL" htmlFor="registrationUrl">
            <TextInput
              id="registrationUrl"
              name="registrationUrl"
              type="url"
              placeholder="https://…"
            />
          </FormField>
          <FormField label="Source / poster URL" htmlFor="sourceUrl">
            <TextInput id="sourceUrl" name="sourceUrl" type="url" placeholder="https://…" />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Pricing" htmlFor="priceType">
            <SelectInput id="priceType" name="priceType" defaultValue="unknown">
              <option value="unknown">Unknown</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </SelectInput>
          </FormField>
          <FormField label="Cost details" htmlFor="cost">
            <TextInput id="cost" name="cost" placeholder="e.g. €12 / donation / members only" />
          </FormField>
        </div>
        <div className="space-y-3">
          <FormField
            label="Categories"
            hint="Add the tags reviewers expect to see on events."
            className="space-y-3"
          >
            <CategoryChecklist categories={categories} />
          </FormField>
          <FormField
            label="Languages"
            hint="Optional, but useful if the event is language-specific."
            className="space-y-3"
          >
            <LanguageChecklist />
          </FormField>
        </div>
        <FormField label="Notes for reviewer" htmlFor="eventNotes">
          <TextArea
            id="eventNotes"
            name="notes"
            rows={3}
            placeholder="Anything the reviewer should know..."
          />
        </FormField>
      </fieldset>
    </>
  );
}

export function AmbassadorSubmitForm({ cities, categories, defaultCityId }: Props) {
  const [mode, setMode] = useState<Mode>('community');

  const [communityState, communityAction, communityPending] = useActionState<
    SubmitResult | null,
    FormData
  >(submitAmbassadorCommunity, null);
  const [eventState, eventAction, eventPending] = useActionState<SubmitResult | null, FormData>(
    submitAmbassadorEvent,
    null,
  );

  const state = mode === 'community' ? communityState : eventState;

  return (
    <div>
      <div className="mb-6 flex rounded-lg border border-gray-200 bg-gray-100 p-1">
        {(['community', 'event'] as Mode[]).map((modeOption) => (
          <button
            key={modeOption}
            type="button"
            onClick={() => setMode(modeOption)}
            className={`flex-1 rounded-md py-2 text-sm font-medium capitalize transition-colors ${
              mode === modeOption ? 'bg-white shadow-sm' : 'text-muted hover:text-foreground'
            }`}
          >
            {modeOption}
          </button>
        ))}
      </div>

      <ResultBanner state={state} />

      {mode === 'community' ? (
        <form action={communityAction} className="space-y-5">
          <CommunityFields cities={cities} categories={categories} defaultCityId={defaultCityId} />
          <button
            type="submit"
            disabled={communityPending}
            className="bg-brand-600 hover:bg-brand-700 w-full rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            {communityPending ? 'Submitting…' : 'Submit community'}
          </button>
        </form>
      ) : (
        <form action={eventAction} className="space-y-5">
          <EventFields cities={cities} categories={categories} defaultCityId={defaultCityId} />
          <button
            type="submit"
            disabled={eventPending}
            className="bg-brand-600 hover:bg-brand-700 w-full rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            {eventPending ? 'Submitting…' : 'Submit event'}
          </button>
        </form>
      )}

      <p className="text-muted mt-4 text-center text-xs">
        Your submissions are tagged as ambassador fast-track and go to the top of the review queue.
      </p>
    </div>
  );
}
