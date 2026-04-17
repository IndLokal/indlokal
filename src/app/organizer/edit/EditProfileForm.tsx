'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { editCommunityProfile, type EditProfileResult } from './actions';

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

type Community = {
  name: string;
  description: string | null;
  descriptionLong: string | null;
  languages: string[];
  foundedYear: number | null;
  memberCountApprox: number | null;
};

export default function EditProfileForm({ community }: { community: Community }) {
  const [state, formAction, isPending] = useActionState<EditProfileResult, FormData>(
    editCommunityProfile,
    null,
  );

  const errors = state?.success === false ? state.errors : {};

  return (
    <form action={formAction} className="space-y-6">
      {state?.success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          ✓ Profile updated successfully.{' '}
          <Link href="/organizer" className="underline">
            Back to dashboard
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
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name[0]}</p>}
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
        {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description[0]}</p>}
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

      {/* Languages */}
      <div>
        <p className="text-foreground block text-sm font-medium">Languages</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LANGUAGES.map((lang) => (
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
