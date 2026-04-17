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
        <Link href="/submit" className="btn-primary mt-6 inline-block px-5 py-2.5 text-sm">
          Submit another community
        </Link>
      </div>
    );
  }

  const errors = state?.success === false ? state.errors : {};

  return (
    <form action={formAction} className="space-y-8">
      {/* Community details */}
      <fieldset className="card-base space-y-5 p-6">
        <legend className="text-foreground -ml-1 text-lg font-bold">Community Details</legend>

        <div>
          <label htmlFor="name" className="text-foreground block text-sm font-medium">
            Community Name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="input-base mt-1"
            placeholder="e.g. Telugu Association Stuttgart"
          />
          <FieldError errors={errors.name} />
        </div>

        <div>
          <label htmlFor="description" className="text-foreground block text-sm font-medium">
            Description *
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={4}
            className="input-base mt-1"
            placeholder="What does your community do? Who is it for? How often do you meet?"
          />
          <FieldError errors={errors.description} />
        </div>

        <div>
          <label htmlFor="citySlug" className="text-foreground block text-sm font-medium">
            City *
          </label>
          <select id="citySlug" name="citySlug" required className="input-base mt-1">
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
      <fieldset className="card-base space-y-4 p-6">
        <legend className="text-foreground -ml-1 text-lg font-bold">Categories *</legend>
        <p className="text-muted text-sm">Select at least one that fits your community.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categories.map((cat) => (
            <label
              key={cat.slug}
              className="border-border hover:bg-brand-50 hover:border-brand-200 has-[:checked]:bg-brand-50 has-[:checked]:border-brand-300 has-[:checked]:text-brand-700 flex cursor-pointer items-center gap-2 rounded-[var(--radius-button)] border bg-white px-3.5 py-2.5 text-sm transition-all"
            >
              <input
                type="checkbox"
                name="categories"
                value={cat.slug}
                className="accent-brand-500"
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
      <fieldset className="card-base space-y-4 p-6">
        <legend className="text-foreground -ml-1 text-lg font-bold">Languages</legend>
        <p className="text-muted text-sm">Which languages are used in your community?</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {LANGUAGES.map((lang) => (
            <label
              key={lang}
              className="border-border hover:bg-brand-50 hover:border-brand-200 has-[:checked]:bg-brand-50 has-[:checked]:border-brand-300 has-[:checked]:text-brand-700 flex cursor-pointer items-center gap-2 rounded-[var(--radius-button)] border bg-white px-3.5 py-2.5 text-sm transition-all"
            >
              <input type="checkbox" name="languages" value={lang} className="accent-brand-500" />
              <span>{lang}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Access Channels */}
      <fieldset className="card-base space-y-5 p-6">
        <legend className="text-foreground -ml-1 text-lg font-bold">Access Channel *</legend>
        <p className="text-muted text-sm">
          How can people find/join your community? At least one link is required.
        </p>

        <div className="border-border rounded-[var(--radius-button)] border p-4">
          <p className="text-muted mb-2 text-sm font-medium">Primary Channel</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              name="primaryChannelType"
              required
              className="border-border rounded-[var(--radius-button)] border px-3 py-2 text-sm"
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
              className="border-border flex-1 rounded-[var(--radius-button)] border px-3 py-2 text-sm"
            />
          </div>
          <FieldError errors={errors.primaryChannelUrl} />
        </div>

        <div className="border-border rounded-[var(--radius-button)] border border-dashed p-4">
          <p className="text-muted mb-2 text-sm font-medium">Secondary Channel (optional)</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              name="secondaryChannelType"
              className="border-border rounded-[var(--radius-button)] border px-3 py-2 text-sm"
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
              className="border-border flex-1 rounded-[var(--radius-button)] border px-3 py-2 text-sm"
            />
          </div>
        </div>
      </fieldset>

      {/* Contact Information */}
      <fieldset className="card-base space-y-5 p-6">
        <legend className="text-foreground -ml-1 text-lg font-bold">
          Your Contact Information
        </legend>
        <p className="text-muted text-sm">
          We&apos;ll use this to follow up about your submission. Not displayed publicly.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="contactName" className="text-foreground block text-sm font-medium">
              Your Name *
            </label>
            <input
              id="contactName"
              name="contactName"
              type="text"
              required
              className="input-base mt-1"
            />
            <FieldError errors={errors.contactName} />
          </div>
          <div>
            <label htmlFor="contactEmail" className="text-foreground block text-sm font-medium">
              Your Email *
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              required
              className="input-base mt-1"
            />
            <FieldError errors={errors.contactEmail} />
          </div>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={isPending}
        className="btn-primary w-full px-5 py-3 text-sm disabled:opacity-50"
      >
        {isPending ? 'Submitting...' : 'Submit Community for Review'}
      </button>
    </form>
  );
}
