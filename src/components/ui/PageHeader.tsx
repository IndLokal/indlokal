import Link from 'next/link';

type EmptyStateProps = {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    href: string;
  };
};

/**
 * Consistent empty state for lists, feeds, search results.
 * Renders a centered card with icon, message, and optional CTA.
 */
export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="border-brand-200 bg-brand-50/30 rounded-[var(--radius-panel)] border border-dashed px-6 py-14 text-center">
      <span className="ring-border/50 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm ring-1">
        {icon}
      </span>
      <p className="text-foreground mt-4 font-semibold">{title}</p>
      {description && <p className="text-muted mt-1 text-sm">{description}</p>}
      {action && (
        <Link href={action.href} className="btn-primary mt-5 inline-block px-5 py-2.5 text-sm">
          {action.label}
        </Link>
      )}
    </div>
  );
}

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: { label: string; href: string };
};

/**
 * Section header with optional "See all →" link.
 * Used for feed sections, community lists, etc.
 */
export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <div>
        <h2 className="text-foreground text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-muted mt-1 text-sm">{subtitle}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="text-brand-600 hover:text-brand-700 -mr-2 shrink-0 rounded-lg px-2 py-2 text-sm font-semibold transition-colors"
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}
