import Link from 'next/link';
import type { ReactNode } from 'react';

type OrganizerPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  className?: string;
};

export function OrganizerPageHeader({
  title,
  description,
  backHref,
  backLabel,
  actions,
  className,
}: OrganizerPageHeaderProps) {
  return (
    <div
      className={
        className
          ? `mb-6 flex flex-wrap items-start justify-between gap-4 ${className}`
          : 'mb-6 flex flex-wrap items-start justify-between gap-4'
      }
    >
      <div className="min-w-0">
        <h1 className="text-foreground text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h1>
        {description && <p className="text-muted mt-1 text-sm leading-6">{description}</p>}
      </div>

      <div className="flex items-center gap-3 pt-0.5">
        {actions}
        {backHref && (
          <Link
            href={backHref}
            className="text-brand-600 hover:text-brand-700 text-sm font-medium hover:underline"
          >
            ← {backLabel ?? 'Back'}
          </Link>
        )}
      </div>
    </div>
  );
}
