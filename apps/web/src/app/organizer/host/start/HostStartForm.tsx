'use client';

import { useActionState, useState } from 'react';
import { hostSignUp } from './actions';
import type { HostStartResult } from './actions';

type City = { id: string; name: string };

export function HostStartForm({ cities }: { cities: City[] }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [state, action, pending] = useActionState<HostStartResult, FormData>(hostSignUp, null);

  if (state?.success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-green-800">
        <h2 className="font-semibold">Check your email</h2>
        <p className="mt-1 text-sm">
          We sent a one-time sign-in link to <strong>{state.email}</strong>. Click it to access your
          host space.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {state && !state.success && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
            step === 1 ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'
          }`}
        >
          1
        </span>
        <span className={step === 1 ? 'font-medium' : 'text-muted'}>Your details</span>
        <span className="text-muted mx-2">→</span>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
            step === 2 ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'
          }`}
        >
          2
        </span>
        <span className={step === 2 ? 'font-medium' : 'text-muted'}>Add links</span>
      </div>

      {step === 1 && (
        <>
          <div>
            <label className="text-muted mb-1 block text-xs font-medium">Your email *</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="border-border w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="text-muted mb-1 block text-xs font-medium">Display name *</label>
            <input
              name="displayName"
              required
              minLength={2}
              maxLength={100}
              placeholder="e.g. Priya Mehta or Nrityalaya Dance School"
              className="border-border w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="text-muted mb-1 block text-xs font-medium">Your city *</label>
            <select
              name="cityId"
              required
              className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
            >
              <option value="">Select city…</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            Next: Add links
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <p className="text-muted text-sm">
            Optional: paste links to your website, Instagram, WhatsApp group, etc.
          </p>
          <div>
            <label className="text-muted mb-1 block text-xs font-medium">Link 1</label>
            <input
              name="link1"
              type="url"
              placeholder="https://instagram.com/yourstudio"
              className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-muted mb-1 block text-xs font-medium">Link 2</label>
            <input
              name="link2"
              type="url"
              placeholder="https://chat.whatsapp.com/…"
              className="border-border w-full rounded-lg border px-3 py-2.5 text-sm"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="border-border flex-1 rounded-lg border py-2.5 text-sm font-medium hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {pending ? 'Sending link…' : 'Get sign-in link'}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
