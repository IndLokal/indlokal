import Link from 'next/link';

type Action = {
  href: string;
  label: string;
  variant?: 'primary' | 'secondary';
};

type CitySubpageEmptyStateProps = {
  title: string;
  description: string;
  actions: Action[];
};

export function CitySubpageEmptyState({ title, description, actions }: CitySubpageEmptyStateProps) {
  return (
    <div className="border-border rounded-xl border border-dashed p-10 text-center">
      <p className="text-muted text-lg">{title}</p>
      <p className="text-muted mt-1 text-sm">{description}</p>
      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={
                action.variant === 'primary'
                  ? 'btn-primary inline-block px-4 py-2 text-sm'
                  : 'text-brand-600 hover:text-brand-700 text-sm font-medium hover:underline'
              }
            >
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
