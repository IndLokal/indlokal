'use client';

import { useActionState, useState } from 'react';
import { reportIssue, type ReportResult } from '@/app/actions/reports';

const REPORT_TYPES = [
  { value: 'STALE_INFO', label: 'Information seems outdated' },
  { value: 'BROKEN_LINK', label: 'Access link is broken / expired' },
  { value: 'INCORRECT_DETAILS', label: 'Details are incorrect' },
  { value: 'OTHER', label: 'Other' },
] as const;

export function ReportIssueForm({ communityId }: { communityId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<ReportResult, FormData>(reportIssue, null);

  if (state?.success) {
    return (
      <p className="text-xs text-green-600">Thanks — we&apos;ll review your report shortly.</p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline"
      >
        Report an issue
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-2 space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3"
    >
      <input type="hidden" name="communityId" value={communityId} />

      <p className="text-xs font-medium text-gray-700">What&apos;s the issue?</p>

      <div className="space-y-1">
        {REPORT_TYPES.map((rt) => (
          <label key={rt.value} className="flex items-center gap-2 text-xs text-gray-700">
            <input
              type="radio"
              name="reportType"
              value={rt.value}
              required
              className="accent-indigo-600"
            />
            {rt.label}
          </label>
        ))}
      </div>

      <textarea
        name="details"
        placeholder="Optional: add details (max 500 chars)"
        maxLength={500}
        rows={2}
        className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-indigo-400 focus:outline-none"
      />

      <input
        type="email"
        name="reporterEmail"
        placeholder="Your email (optional — for followup)"
        className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-indigo-400 focus:outline-none"
      />

      {state?.success === false && <p className="text-xs text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? 'Sending…' : 'Submit report'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
