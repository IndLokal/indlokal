'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { content, communityOptions } from '@indlokal/shared';
import { submitCommunity, type SubmitResult } from './actions';
import { ContentCallout } from '@/components/content/community-actions';

type Props = {
  cities: { slug: string; name: string }[];
  categories: { slug: string; name: string; icon: string | null }[];
};

type ChannelDraft = {
  id: number;
  channelType: (typeof communityOptions.CHANNEL_TYPE_VALUES)[number];
  url: string;
  label: string;
  isPrimary: boolean;
};

const MAX_CHANNELS = 6;

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null;
  return <p className="mt-1 text-sm text-red-600">{errors[0]}</p>;
}

function FormError({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null;
  return (
    <div className="rounded-[var(--radius-button)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      {errors[0]}
    </div>
  );
}

export function SubmitForm({ cities, categories }: Props) {
  const [state, formAction, isPending] = useActionState<SubmitResult, FormData>(
    submitCommunity,
    null,
  );
  const [channels, setChannels] = useState<ChannelDraft[]>([
    {
      id: 1,
      channelType: communityOptions.CHANNEL_TYPE_VALUES[0],
      url: '',
      label: '',
      isPrimary: true,
    },
  ]);

  const addChannelRow = () => {
    setChannels((prev) => {
      if (prev.length >= MAX_CHANNELS) return prev;
      const nextId = Math.max(...prev.map((c) => c.id)) + 1;
      return [
        ...prev,
        {
          id: nextId,
          channelType: communityOptions.CHANNEL_TYPE_VALUES[0],
          url: '',
          label: '',
          isPrimary: false,
        },
      ];
    });
  };

  const removeChannelRow = (id: number) => {
    setChannels((prev) => {
      if (prev.length === 1) return prev;
      const removed = prev.find((c) => c.id === id);
      const next = prev.filter((c) => c.id !== id);
      if (removed?.isPrimary && next.length > 0) {
        return next.map((c, index) => ({ ...c, isPrimary: index === 0 }));
      }
      return next;
    });
  };

  const updateChannel = (id: number, patch: Partial<ChannelDraft>) => {
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const setPrimary = (id: number) => {
    setChannels((prev) => prev.map((c) => ({ ...c, isPrimary: c.id === id })));
  };

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
      <FormError errors={errors._} />

      <ContentCallout
        title={content.COMMUNITY_ACTION_COPY.submitFormHint}
        body={content.COMMUNITY_ACTION_COPY.submitFormBody}
      />
      <p className="text-muted text-sm">
        Fields marked * are required. This usually takes 2-3 minutes.
      </p>

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
          {communityOptions.COMMUNITY_LANGUAGE_VALUES.map((lang) => (
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
        <legend className="text-foreground -ml-1 text-lg font-bold">Access Channels *</legend>
        <p className="text-muted text-sm">
          Add where people can join or follow your community. Max {MAX_CHANNELS} links.
        </p>
        <div className="space-y-3">
          {channels.map((channel, index) => (
            <div
              key={channel.id}
              className="border-border rounded-[var(--radius-button)] border p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-muted text-sm font-medium">Channel {index + 1}</p>
                {channels.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeChannelRow(channel.id)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-[180px,1fr]">
                <select
                  value={channel.channelType}
                  onChange={(e) =>
                    updateChannel(channel.id, {
                      channelType: e.target.value as ChannelDraft['channelType'],
                    })
                  }
                  className="border-border rounded-[var(--radius-button)] border px-3 py-2 text-sm"
                >
                  {communityOptions.CHANNEL_TYPE_VALUES.map((channelType) => (
                    <option key={channelType} value={channelType}>
                      {communityOptions.CHANNEL_TYPE_LABELS[channelType]}
                    </option>
                  ))}
                </select>
                <input
                  type="url"
                  value={channel.url}
                  onChange={(e) => updateChannel(channel.id, { url: e.target.value })}
                  placeholder="https://..."
                  className="border-border rounded-[var(--radius-button)] border px-3 py-2 text-sm"
                />
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr,180px]">
                <input
                  type="text"
                  value={channel.label}
                  onChange={(e) => updateChannel(channel.id, { label: e.target.value })}
                  placeholder="Optional label (e.g. Join on Telegram)"
                  className="border-border rounded-[var(--radius-button)] border px-3 py-2 text-sm"
                />
                <label className="text-foreground flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={channel.isPrimary}
                    onChange={() => setPrimary(channel.id)}
                    className="accent-brand-500"
                  />
                  Set as primary
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={addChannelRow}
            disabled={channels.length >= MAX_CHANNELS}
            className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
          >
            + Add channel
          </button>
          <p className="text-muted text-xs">
            {channels.length}/{MAX_CHANNELS} channels
          </p>
        </div>

        <input
          type="hidden"
          name="channelsJson"
          value={JSON.stringify(
            channels.map(({ channelType, url, label, isPrimary }) => ({
              channelType,
              url,
              label,
              isPrimary,
            })),
          )}
        />
        <FieldError errors={errors.channels} />
      </fieldset>

      {/* Contact Information */}
      <fieldset className="card-base space-y-5 p-6">
        <legend className="text-foreground -ml-1 text-lg font-bold">
          Your Contact Information
        </legend>
        <p className="text-muted text-sm">
          We&apos;ll use this to follow up about your submission. Not displayed publicly.
        </p>

        <label className="border-border hover:border-brand-300 flex cursor-pointer items-start gap-3 rounded-[var(--radius-button)] border bg-white px-4 py-3 text-sm transition-colors">
          <input type="checkbox" name="ownershipIntent" className="accent-brand-500 mt-0.5" />
          <span className="text-foreground leading-relaxed">
            I represent this community and want organizer ownership after approval.
            <span className="text-muted mt-1 block text-xs">
              Use the same email for organizer login after approval.
            </span>
          </span>
        </label>
        <FieldError errors={errors.ownershipIntent} />

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
