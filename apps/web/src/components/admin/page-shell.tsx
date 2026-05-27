import Link from 'next/link';
import type { ReactNode } from 'react';

type AdminPageProps = {
  children: ReactNode;
  className?: string;
};

export function AdminPage({ children, className }: AdminPageProps) {
  return <div className={className ? `px-4 py-8 ${className}` : 'px-4 py-8'}>{children}</div>;
}

type AdminPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  className?: string;
};

export function AdminPageHeader({
  title,
  description,
  backHref,
  backLabel = 'Dashboard',
  actions,
  className,
}: AdminPageHeaderProps) {
  return (
    <div
      className={
        className
          ? `mb-8 flex flex-wrap items-start justify-between gap-4 ${className}`
          : 'mb-8 flex flex-wrap items-start justify-between gap-4'
      }
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted mt-1.5 text-sm leading-relaxed">{description}</p>}
      </div>

      <div className="flex items-center gap-3 pt-0.5">
        {actions}
        {backHref && (
          <Link
            href={backHref}
            className="text-brand-600 hover:text-brand-700 text-sm hover:underline"
          >
            ← {backLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
