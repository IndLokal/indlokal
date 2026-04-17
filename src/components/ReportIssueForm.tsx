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
    return <p className="text-success text-xs">Thanks — we&apos;ll review your report shortly.</p>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-muted hover:text-foreground text-xs underline-offset-2 transition-colors hover:underline"
      >
        Report an issue
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="border-border/50 bg-muted-bg mt-2 space-y-2 rounded-[var(--radius-card)] border p-3"
    >
      <input type="hidden" name="communityId" value={communityId} />

      <p className="text-foreground text-xs font-medium">What&apos;s the issue?</p>

      <div className="space-y-1">
        {REPORT_TYPES.map((rt) => (
          <label key={rt.value} className="text-foreground flex items-center gap-2 text-xs">
            <input
              type="radio"
              name="reportType"
              value={rt.value}
              required
              className="accent-brand-500"
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
        className="border-border focus:border-brand-500 w-full rounded-[var(--radius-button)] border px-2 py-1.5 text-xs transition-colors focus:outline-none"
      />

      <input
        type="email"
        name="reporterEmail"
        placeholder="Your email (optional — for followup)"
        className="border-border focus:border-brand-500 w-full rounded-[var(--radius-button)] border px-2 py-1.5 text-xs transition-colors focus:outline-none"
      />

      {state?.success === false && <p className="text-destructive text-xs">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className="btn-primary px-3 py-1.5 text-xs">
          {isPending ? 'Sending…' : 'Submit report'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted hover:text-foreground text-xs transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
