'use client';

import { useState } from 'react';

type Props = {
  submissionId: string;
  defaultGrantOwnership: boolean;
  action: (formData: FormData) => void | Promise<void>;
};

export function ApproveSubmissionForm({ submissionId, defaultGrantOwnership, action }: Props) {
  const [grantOwnership, setGrantOwnership] = useState(defaultGrantOwnership);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={submissionId} />
      <p
        className={`mb-2 inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${
          grantOwnership ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        }`}
      >
        Will grant organizer access on approve: {grantOwnership ? 'Yes' : 'No'}
      </p>
      <label className="mb-2 flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          name="grantOwnership"
          checked={grantOwnership}
          onChange={(event) => setGrantOwnership(event.target.checked)}
          className="accent-brand-500"
        />
        Grant organizer ownership to submitter email
      </label>
      <button
        type="submit"
        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
      >
        Approve
      </button>
    </form>
  );
}
