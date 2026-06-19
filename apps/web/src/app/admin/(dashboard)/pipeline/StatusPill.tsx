export function StatusPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-button)] border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-[11px] tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
