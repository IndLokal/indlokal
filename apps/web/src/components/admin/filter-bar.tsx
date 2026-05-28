'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

function resetFilterControls(form: HTMLFormElement) {
  for (const control of Array.from(form.elements)) {
    if (control instanceof HTMLSelectElement) {
      control.selectedIndex = 0;
      continue;
    }

    if (control instanceof HTMLTextAreaElement) {
      control.value = '';
      continue;
    }

    if (control instanceof HTMLInputElement) {
      if (control.type === 'checkbox' || control.type === 'radio') {
        control.checked = false;
      } else if (
        control.type !== 'hidden' &&
        control.type !== 'submit' &&
        control.type !== 'button'
      ) {
        control.value = '';
      }
    }
  }
}

type AdminFilterBarProps = {
  children: ReactNode;
  className?: string;
};

export function AdminFilterBar({ children, className }: AdminFilterBarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filterStateKey = `${pathname}?${searchParams.toString()}`;

  return (
    <div
      key={filterStateKey}
      className={
        className
          ? `rounded-[var(--radius-card)] border bg-white p-4 shadow-sm ${className}`
          : 'rounded-[var(--radius-card)] border bg-white p-4 shadow-sm'
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  );
}

type AdminFilterItemProps = {
  label: string;
  children: ReactNode;
};

export function AdminFilterItem({ label, children }: AdminFilterItemProps) {
  return (
    <div>
      <label className="text-muted mb-1 block text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}

type AdminFilterActionsProps = {
  resetHref: string;
  submitLabel?: string;
  showReset?: boolean;
};

export function AdminFilterActions({
  resetHref,
  submitLabel = 'Apply',
  showReset = true,
}: AdminFilterActionsProps) {
  return (
    <div className="border-border/70 mt-1 flex items-center justify-end gap-2 border-t pt-3 sm:col-span-2 lg:col-span-4">
      {showReset ? (
        <Link
          href={resetHref}
          onClick={(event) => {
            const form = event.currentTarget.closest('form');
            if (form) resetFilterControls(form);
          }}
          className="text-muted hover:text-foreground rounded-md px-3 py-2 text-sm transition-colors"
        >
          Reset filters
        </Link>
      ) : null}
      <button
        type="submit"
        className="bg-brand-600 hover:bg-brand-700 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors"
      >
        {submitLabel}
      </button>
    </div>
  );
}
