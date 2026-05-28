import type { ReactNode } from 'react';

type AdminStatItem = {
  key: string;
  label: string;
  value: ReactNode;
};

type AdminStatsStripProps = {
  items: AdminStatItem[];
};

export function AdminStatsStrip({ items }: AdminStatsStripProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {items.map((item) => (
        <div key={item.key} className="border-border rounded-md border px-2.5 py-1 text-center">
          <p className="text-foreground text-base font-semibold leading-none">{item.value}</p>
          <p className="text-muted mt-1 text-[10px] font-medium uppercase tracking-wide">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}
