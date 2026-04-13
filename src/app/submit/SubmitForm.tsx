'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { submitCommunity, type SubmitResult } from './actions';

type Props = {
  cities: { slug: string; name: string }[];
  categories: { slug: string; name: string; icon: string | null }[];
};

const CHANNEL_OPTIONS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'TELEGRAM', label: 'Telegram' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'MEETUP', label: 'Meetup' },
  { value: 'OTHER', label: 'Other' },
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

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null;
  return <p className="mt-1 text-sm text-red-600">{errors[0]}</p>;
}

export function SubmitForm({ cities, categories }: Props) {
  const [state, formAction, isPending] = useActionState<SubmitResult, FormData>(
    submitCommunity,
    null,
  );

  if (state?.success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="text-4xl">🎉</div>
        <h2 className="mt-4 text-xl font-semibold text-green-800">Community submitted!</h2>
        <p className="mt-2 text-green-700">
          <strong>{state.communityName}</strong> has been submitted for review. Our team will review
          it and make it live within a few days.
        </p>
        <Link
          href="/submit"
          className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Submit another community
        </Link>
      </div>
    );
  }

  const errors = state?.success === false ? state.errors : {};

  return (
    <form action={formAction} className="space-y-8">
      {/* Community details */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Community Details</legend>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Community Name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="e.g. Telugu Association Stuttgart"
          />
          <FieldError errors={errors.name} />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description *
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={4}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="What does your community do? Who is it for? How often do you meet?"
          />
          <FieldError errors={errors.description} />
        </div>

        <div>
          <label htmlFor="citySlug" className="block text-sm font-medium text-gray-700">
            City *
          </label>
          <select
            id="citySlug"
            name="citySlug"
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">Select a city</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <FieldError errors={errors.citySlug} />
        </div>
      </fieldset>

      {/* Categories */}
      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold">Categories *</legend>
        <p className="text-sm text-gray-500">Select at least one that fits your community.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categories.map((cat) => (
            <label
              key={cat.slug}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <input
                type="checkbox"
                name="categories"
                value={cat.slug}
                className="accent-indigo-600"
              />
              <span>
                {cat.icon} {cat.name}
              </span>
            </label>
          ))}
        </div>
        <FieldError errors={errors.categories} />
      </fieldset>

      {/* Languages */}
      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold">Languages</legend>
        <p className="text-sm text-gray-500">Which languages are used in your community?</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {LANGUAGES.map((lang) => (
            <label
              key={lang}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <input type="checkbox" name="languages" value={lang} className="accent-indigo-600" />
              <span>{lang}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Access Channels */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Access Channel *</legend>
        <p className="text-sm text-gray-500">
          How can people find/join your community? At least one link is required.
        </p>

        <div className="rounded-lg border border-gray-200 p-4">
          <p className="mb-2 text-sm font-medium text-gray-600">Primary Channel</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              name="primaryChannelType"
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {CHANNEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              name="primaryChannelUrl"
              type="url"
              required
              placeholder="https://chat.whatsapp.com/..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <FieldError errors={errors.primaryChannelUrl} />
        </div>

        <div className="rounded-lg border border-dashed border-gray-200 p-4">
          <p className="mb-2 text-sm font-medium text-gray-400">Secondary Channel (optional)</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              name="secondaryChannelType"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">None</option>
              {CHANNEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              name="secondaryChannelUrl"
              type="url"
              placeholder="https://..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </fieldset>

      {/* Contact Information */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Your Contact Information</legend>
        <p className="text-sm text-gray-500">
          We&apos;ll use this to follow up about your submission. Not displayed publicly.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="contactName" className="block text-sm font-medium text-gray-700">
              Your Name *
            </label>
            <input
              id="contactName"
              name="contactName"
              type="text"
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            <FieldError errors={errors.contactName} />
          </div>
          <div>
            <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700">
              Your Email *
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            <FieldError errors={errors.contactEmail} />
          </div>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {isPending ? 'Submitting...' : 'Submit Community for Review'}
      </button>
    </form>
  );
}
