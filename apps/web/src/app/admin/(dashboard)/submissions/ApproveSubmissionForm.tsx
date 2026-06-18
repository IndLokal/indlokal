'use client';

import { useState } from 'react';
import { ConfirmSubmitButton } from '@/components/ui';

type Props = {
  contributionId: string;
  defaultGrantOrganizerAccess: boolean;
  action: (formData: FormData) => void | Promise<void>;
};

export function ApproveCommunityContributionForm({
  contributionId,
  defaultGrantOrganizerAccess,
  action,
}: Props) {
  const [grantOrganizerAccess, setGrantOrganizerAccess] = useState(defaultGrantOrganizerAccess);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={contributionId} />
      <p
        className={`mb-2 inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${
          grantOrganizerAccess ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        }`}
      >
        Organizer access on approve: {grantOrganizerAccess ? 'Yes' : 'No'}
      </p>
      <label className="mb-2 flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          name="grantOrganizerAccess"
          checked={grantOrganizerAccess}
          onChange={(event) => setGrantOrganizerAccess(event.target.checked)}
          className="accent-brand-500"
        />
        Grant organizer access to submitter email
      </label>
      <ConfirmSubmitButton
        triggerLabel="Approve"
        title="Approve this community contribution?"
        description={
          grantOrganizerAccess
            ? 'This will publish the community and grant organizer access to the submitter email.'
            : 'This will publish the community without granting organizer access.'
        }
        confirmLabel="Approve contribution"
        tone="primary"
        triggerClassName="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
      />
    </form>
  );
}
