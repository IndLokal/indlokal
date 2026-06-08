'use client';

import { useActionState } from 'react';
import { inviteBusinessConnectGuest, type InviteBusinessConnectResult } from './actions';

export function BusinessConnectInviteCard() {
  const [state, formAction, isPending] = useActionState<InviteBusinessConnectResult, FormData>(
    inviteBusinessConnectGuest,
    null,
  );

  return (
    <div className="card-base p-6">
      <h2 className="text-foreground font-semibold">Invite guests</h2>
      <p className="text-muted mt-1 text-sm">
        Business Connect is invite-only. Add the emails of guests you want to let submit an enquiry
        — each gets a private link tied to their email address. Enquiries are then reviewed manually
        by IndLokal.
      </p>

      {state?.success ? (
        <p className="mt-3 rounded-[var(--radius-button)] border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.message}
        </p>
      ) : null}

      <form action={formAction} className="mt-4 space-y-3">
        <div>
          <label htmlFor="bc-invite-emails" className="text-foreground block text-sm font-medium">
            Guest emails
          </label>
          <textarea
            id="bc-invite-emails"
            name="emails"
            rows={3}
            required
            className="input-base mt-1"
            placeholder="priya@example.com, arjun@example.com"
          />
          <p className="text-muted mt-1 text-xs">
            Separate multiple emails with commas or new lines.
          </p>
          {state?.success === false && state.errors.emails ? (
            <p className="mt-1 text-sm text-red-600">{state.errors.emails[0]}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="bc-invite-note" className="text-foreground block text-sm font-medium">
            Internal note (optional)
          </label>
          <input
            id="bc-invite-note"
            name="note"
            type="text"
            maxLength={300}
            className="input-base mt-1"
            placeholder="e.g. Founders from the 23 June roundtable"
          />
        </div>

        {state?.success === false && state.errors._ ? (
          <p className="text-sm text-red-600">{state.errors._[0]}</p>
        ) : null}

        <button type="submit" disabled={isPending} className="btn-primary px-4 py-2 text-sm">
          {isPending ? 'Sending…' : 'Send invites'}
        </button>
      </form>
    </div>
  );
}
