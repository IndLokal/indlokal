'use client';

import { useActionState } from 'react';
import { createOutreachLead } from './actions';
import type { OutreachResult } from './actions';

type Props = {
  cities: Array<{ id: string; name: string }>;
  defaultCityId?: string;
  operators: Array<{ id: string; displayName: string | null; email: string }>;
  currentUserId: string;
};

export function CreateLeadForm({ cities, defaultCityId, operators, currentUserId }: Props) {
  const [state, action, pending] = useActionState<OutreachResult | null, FormData>(
    createOutreachLead,
    null,
  );

  return (
    <form action={action} className="space-y-3">
      {state && !state.success && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-600">Lead created.</p>}

      <div>
        <label className="text-muted mb-1 block text-xs font-medium">Community / org name *</label>
        <input
          name="suggestedName"
          required
          placeholder="e.g. Tamil Sangam Frankfurt"
          className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-muted mb-1 block text-xs font-medium">City *</label>
          {defaultCityId ? (
            <input type="hidden" name="cityId" value={defaultCityId} />
          ) : (
            <select
              name="cityId"
              required
              className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {defaultCityId && (
            <p className="text-muted text-xs">{cities.find((c) => c.id === defaultCityId)?.name}</p>
          )}
        </div>
        <div>
          <label className="text-muted mb-1 block text-xs font-medium">Source</label>
          <select
            name="source"
            className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
          >
            {['manual', 'ambassador', 'pipeline', 'partner'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-muted mb-1 block text-xs font-medium">
          Channel hint (WA / IG / email)
        </label>
        <input
          name="channelHint"
          placeholder="https://chat.whatsapp.com/…"
          className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-muted mb-1 block text-xs font-medium">Assign to</label>
          <select
            name="ownerUserId"
            defaultValue={currentUserId}
            className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
          >
            {operators.map((op) => (
              <option key={op.id} value={op.id}>
                {op.displayName ?? op.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-muted mb-1 block text-xs font-medium">Next action date</label>
          <input
            name="nextActionAt"
            type="date"
            className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-brand-600 hover:bg-brand-700 w-full rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create lead'}
      </button>
    </form>
  );
}
