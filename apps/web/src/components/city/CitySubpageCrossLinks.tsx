import Link from 'next/link';

type LinkItem = {
  href: string;
  label: string;
};

type LeadItem = {
  text: string;
  href: string;
  label: string;
};

type CitySubpageCrossLinksProps = {
  links: LinkItem[];
  lead?: LeadItem;
};

export function CitySubpageCrossLinks({ links, lead }: CitySubpageCrossLinksProps) {
  return (
    <div className="border-border/50 bg-muted-bg text-muted flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-[var(--radius-card)] border p-4 text-sm">
      {lead && (
        <>
          <span>
            {lead.text}{' '}
            <Link
              href={lead.href}
              className="text-brand-600 hover:text-brand-700 font-medium hover:underline"
            >
              {lead.label}
            </Link>
          </span>
          {links.length > 0 && <span className="text-border hidden sm:inline">|</span>}
        </>
      )}

      {links.map((item, index) => (
        <div key={item.href} className="contents">
          <Link
            href={item.href}
            className="text-brand-600 hover:text-brand-700 font-medium hover:underline"
          >
            {item.label}
          </Link>
          {index < links.length - 1 && <span className="text-border hidden sm:inline">|</span>}
        </div>
      ))}
    </div>
  );
}
