'use client';

import { useState, useTransition } from 'react';
import { applyImportAction, planImportAction, type ImportPlan } from '../actions';

type Resource = 'city' | 'category' | 'community';

export function ImportClient() {
  const [resource, setResource] = useState<Resource>('city');
  const [payload, setPayload] = useState<string>('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [applied, setApplied] = useState<ImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPayload(String(reader.result ?? ''));
    reader.readAsText(f);
  }

  function preview() {
    setError(null);
    setApplied(null);
    setPlan(null);
    const fd = new FormData();
    fd.set('resource', resource);
    fd.set('payload', payload);
    startTransition(async () => {
      try {
        const result = await planImportAction(fd);
        setPlan(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Preview failed');
      }
    });
  }

  function apply() {
    setError(null);
    const fd = new FormData();
    fd.set('resource', resource);
    fd.set('payload', payload);
    startTransition(async () => {
      try {
        const result = await applyImportAction(fd);
        setApplied(result);
        setPlan(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Apply failed');
      }
    });
  }

  return (
    <div className="border-border mt-6 rounded-[var(--radius-card)] border p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-muted">Resource</span>
          <select
            value={resource}
            onChange={(e) => setResource(e.target.value as Resource)}
            className="border-border mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="city">Cities</option>
            <option value="category">Categories / Personas</option>
            <option value="community">Communities</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-muted">Upload file (.csv or .json)</span>
          <input
            type="file"
            accept=".csv,.json,application/json,text/csv"
            onChange={onFile}
            className="border-border mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <label className="mt-4 block text-sm">
        <span className="text-muted">Or paste payload</span>
        <textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          rows={10}
          className="border-border mt-1 w-full rounded-md border px-2 py-1.5 font-mono text-xs"
          placeholder="Paste CSV or JSON here…"
        />
      </label>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          disabled={pending || !payload.trim()}
          onClick={preview}
          className="border-border rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending && !applied ? 'Working…' : 'Preview'}
        </button>
        <button
          type="button"
          disabled={pending || !plan || plan.errors > 0}
          onClick={apply}
          className="bg-brand-600 hover:bg-brand-700 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Apply
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {plan && <PlanView plan={plan} title="Preview" />}
      {applied && <PlanView plan={applied} title="Applied ✓" />}
    </div>
  );
}

function PlanView({ plan, title }: { plan: ImportPlan; title: string }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="text-muted mt-1 text-xs">
        {plan.total} rows · {plan.toCreate} create · {plan.toUpdate} update · {plan.errors} errors
      </div>
      <div className="border-border mt-2 max-h-72 overflow-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="border-border bg-muted-bg sticky top-0 border-b text-left">
            <tr>
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5">Action</th>
              <th className="px-2 py-1.5">Slug / Row</th>
              <th className="px-2 py-1.5">Message</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((r) => (
              <tr key={r.index} className="border-border border-b last:border-b-0">
                <td className="px-2 py-1">{r.index + 1}</td>
                <td
                  className={`px-2 py-1 ${r.action === 'error' ? 'text-red-600' : r.action === 'create' ? 'text-green-700' : 'text-amber-700'}`}
                >
                  {r.action}
                </td>
                <td className="px-2 py-1 font-mono">{r.slug}</td>
                <td className="px-2 py-1">{r.message ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
