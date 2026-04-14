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
        <label className="block text-sm font-medium text-gray-700">Community name *</label>
        <input
          name="name"
          type="text"
          required
          defaultValue={community.name}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name[0]}</p>}
      </div>

      {/* Short description */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Short description *</label>
        <textarea
          name="description"
          required
          rows={3}
          defaultValue={community.description ?? ''}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500"
        />
        {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description[0]}</p>}
      </div>

      {/* Long description */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Full description <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          name="descriptionLong"
          rows={6}
          defaultValue={community.descriptionLong ?? ''}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500"
          placeholder="More detailed information about the community, its history, activities..."
        />
      </div>

      {/* Languages */}
      <div>
        <p className="block text-sm font-medium text-gray-700">Languages</p>
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
              <span className="text-sm text-gray-700">{lang}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Founded year + member count */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Founded year</label>
          <input
            name="foundedYear"
            type="number"
            min={1900}
            max={new Date().getFullYear()}
            defaultValue={community.foundedYear ?? ''}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500"
            placeholder="e.g. 2018"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Approximate member count
          </label>
          <input
            name="memberCountApprox"
            type="number"
            min={0}
            defaultValue={community.memberCountApprox ?? ''}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500"
            placeholder="e.g. 150"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save changes'}
        </button>
        <Link
          href="/organizer"
          className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
