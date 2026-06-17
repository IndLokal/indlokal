'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { communityOptions } from '@indlokal/shared';
import { FormFieldError, FormGlobalError } from '@/components/forms/FormFeedback';
import { editCommunityProfile, type EditProfileResult } from './actions';

type Community = {
  name: string;
  description: string | null;
  descriptionLong: string | null;
  logoUrl: string | null;
  organizationType: string | null;
  personaSegments: string[];
  languages: string[];
  foundedYear: number | null;
  memberCountApprox: number | null;
  accessChannels: { id: string }[];
};

export default function EditProfileForm({ community }: { community: Community }) {
  const [state, formAction, isPending] = useActionState<EditProfileResult, FormData>(
    editCommunityProfile,
    null,
  );

  const errors = state?.success === false ? state.errors : {};
  const profileChecks = [
    { label: 'Name', done: !!community.name },
    { label: 'Short description', done: !!community.description },
    { label: 'Long description', done: !!community.descriptionLong },
    { label: 'Logo', done: !!community.logoUrl },
    { label: 'Audience segments', done: community.personaSegments.length > 0 },
    { label: 'Languages', done: community.languages.length > 0 },
    { label: 'Access links', done: community.accessChannels.length > 0 },
  ];
  const doneCount = profileChecks.filter((item) => item.done).length;
  const pct = Math.round((doneCount / profileChecks.length) * 100);

  return (
    <form action={formAction} className="space-y-6">
      <FormGlobalError errors={errors._} />

      <div className="card-base p-4">
        <div className="flex items-center justify-between">
          <p className="text-foreground text-sm font-semibold">Public profile readiness</p>
          <span className="text-brand-600 text-sm font-semibold">{pct}%</span>
        </div>
        <div className="bg-muted-bg mt-2 h-2 overflow-hidden rounded-full">
          <div className="bg-brand-500 h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {profileChecks.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className={item.done ? 'text-success' : 'text-border'}>
                {item.done ? '✓' : '○'}
              </span>
              <span className={item.done ? 'text-foreground' : 'text-muted'}>{item.label}</span>
            </div>
          ))}
        </div>
        <p className="text-muted mt-3 text-xs">
          Tip: after saving this page, update join links in{' '}
          <Link href="/organizer/links" className="text-brand-600 hover:underline">
            Community links
          </Link>{' '}
          and publish upcoming activities via{' '}
          <Link href="/organizer/events/new" className="text-brand-600 hover:underline">
            Add event
          </Link>
          .
        </p>
      </div>

      {state?.success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          ✓ Profile updated successfully.{' '}
          <Link href="/organizer" className="underline">
            Back to organizer home
          </Link>
        </div>
      )}

      {/* Name */}
      <div>
        <label className="text-foreground block text-sm font-medium">Community name *</label>
        <input
          name="name"
          type="text"
          required
          defaultValue={community.name}
          className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
        />
        <FormFieldError errors={errors.name} />
      </div>

      {/* Short description */}
      <div>
        <label className="text-foreground block text-sm font-medium">Short description *</label>
        <textarea
          name="description"
          required
          rows={3}
          defaultValue={community.description ?? ''}
          className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
        />
        <FormFieldError errors={errors.description} />
      </div>

      {/* Long description */}
      <div>
        <label className="text-foreground block text-sm font-medium">
          Full description <span className="text-muted">(optional)</span>
        </label>
        <textarea
          name="descriptionLong"
          rows={6}
          defaultValue={community.descriptionLong ?? ''}
          className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
          placeholder="More detailed information about the community, its history, activities..."
        />
      </div>

      {/* Logo URL */}
      <div>
        <label className="text-foreground block text-sm font-medium">
          Logo image URL <span className="text-muted">(optional)</span>
        </label>
        <input
          name="logoUrl"
          type="url"
          defaultValue={community.logoUrl ?? ''}
          className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
          placeholder="https://..."
        />
        <p className="text-muted mt-1 text-xs">
          Use a public square image URL for the best card appearance.
        </p>
        <FormFieldError errors={errors.logoUrl} />
      </div>

      {/* Organization type */}
      <div>
        <label className="text-foreground block text-sm font-medium">
          Organization type <span className="text-muted">(optional)</span>
        </label>
        <select
          name="organizationType"
          defaultValue={community.organizationType ?? ''}
          className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
        >
          <option value="">Not specified</option>
          {communityOptions.ORGANIZATION_TYPE_VALUES.map((value) => (
            <option key={value} value={value}>
              {communityOptions.ORGANIZATION_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
        <p className="text-muted mt-1 text-xs">
          Helps people find the right kind of group (association, student group, temple, etc.).
        </p>
      </div>

      {/* Languages + audience */}
      <div className="grid gap-4 lg:grid-cols-2">
        <fieldset className="border-border rounded-[var(--radius-card)] border bg-white p-4">
          <legend className="text-foreground px-1 text-sm font-medium">Languages</legend>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
            {communityOptions.COMMUNITY_LANGUAGE_VALUES.map((lang) => (
              <label key={lang} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="languages"
                  value={lang}
                  defaultChecked={community.languages.includes(lang)}
                  className="rounded"
                />
                <span className="text-foreground text-sm">{lang}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="border-border rounded-[var(--radius-card)] border bg-white p-4">
          <legend className="text-foreground px-1 text-sm font-medium">
            Who this community is for
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {communityOptions.PERSONA_SEGMENT_VALUES.map((segment) => (
              <label key={segment} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="personaSegments"
                  value={segment}
                  defaultChecked={community.personaSegments.includes(segment)}
                  className="rounded"
                />
                <span className="text-foreground text-sm">
                  {communityOptions.PERSONA_SEGMENT_LABELS[segment]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Founded year + member count */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-foreground block text-sm font-medium">Founded year</label>
          <input
            name="foundedYear"
            type="number"
            min={1900}
            max={new Date().getFullYear()}
            defaultValue={community.foundedYear ?? ''}
            className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
            placeholder="e.g. 2018"
          />
        </div>
        <div>
          <label className="text-foreground block text-sm font-medium">
            Approximate member count
          </label>
          <input
            name="memberCountApprox"
            type="number"
            min={0}
            defaultValue={community.memberCountApprox ?? ''}
            className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
            placeholder="e.g. 150"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary px-6 py-2.5 text-sm disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save changes'}
        </button>
        <Link href="/organizer" className="btn-secondary px-6 py-2.5 text-sm">
          Cancel
        </Link>
      </div>
    </form>
  );
}
