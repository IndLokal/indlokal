'use client';

import { useActionState } from 'react';
import { inviteCollaborator, type InviteCollaboratorResult } from './collaborators/actions';

type CollaboratorInviteCardProps = {
  title?: string;
  description?: string;
};

export function CollaboratorInviteCard({
  title = 'Collaborators',
  description = 'Invite another organizer by email. Access becomes active when they accept the invite link.',
}: CollaboratorInviteCardProps) {
  const [state, formAction, isPending] = useActionState<InviteCollaboratorResult, FormData>(
    inviteCollaborator,
    null,
  );

  return (
    <div className="card-base p-6">
      <h2 className="text-foreground font-semibold">{title}</h2>
      <p className="text-muted mt-1 text-sm">{description}</p>

      {state?.success ? (
        <p className="mt-3 rounded-[var(--radius-button)] border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.message}
        </p>
      ) : null}

      <form action={formAction} className="mt-4 space-y-3">
        <div>
          <label htmlFor="invite-name" className="text-foreground block text-sm font-medium">
            Collaborator name (optional)
          </label>
          <input
            id="invite-name"
            name="name"
            type="text"
            maxLength={120}
            className="input-base mt-1"
            placeholder="Priya Sharma"
          />
          {state?.success === false && state.errors.name ? (
            <p className="mt-1 text-sm text-red-600">{state.errors.name[0]}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="invite-email" className="text-foreground block text-sm font-medium">
            Collaborator email
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            className="input-base mt-1"
            placeholder="organizer@example.com"
          />
          {state?.success === false && state.errors.email ? (
            <p className="mt-1 text-sm text-red-600">{state.errors.email[0]}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="invite-note" className="text-foreground block text-sm font-medium">
            Note (optional)
          </label>
          <textarea
            id="invite-note"
            name="note"
            rows={2}
            maxLength={300}
            className="input-base mt-1"
            placeholder="Optional context for admin review"
          />
        </div>

        {state?.success === false && state.errors._ ? (
          <p className="text-sm text-red-600">{state.errors._[0]}</p>
        ) : null}

        <button type="submit" disabled={isPending} className="btn-secondary px-4 py-2 text-sm">
          {isPending ? 'Submitting...' : 'Invite collaborator'}
        </button>
      </form>
    </div>
  );
}
