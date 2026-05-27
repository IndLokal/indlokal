'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type OrganizerNavLink = {
  href: string;
  label: string;
};

function isActivePath(pathname: string, href: string) {
  if (href === '/organizer') return pathname === '/organizer';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function OrganizerNav({ links }: { links: OrganizerNavLink[] }) {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex h-11 w-full max-w-6xl items-center gap-1 overflow-x-auto px-4 text-[13px] font-semibold sm:px-6 lg:px-8">
      {links.map((link) => {
        const active = isActivePath(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'text-foreground border-border shrink-0 whitespace-nowrap rounded-[var(--radius-button)] border bg-white px-3 py-1.5 leading-5 shadow-sm transition-colors'
                : 'text-muted hover:text-foreground shrink-0 whitespace-nowrap rounded-[var(--radius-button)] px-3 py-1.5 leading-5 transition-colors hover:bg-white'
            }
          >
            {link.label}
          </Link>
        );
      })}
      <Link
        href="/organizer/events/new"
        className="text-brand-600 hover:text-brand-700 ml-auto shrink-0 whitespace-nowrap rounded-[var(--radius-button)] px-3 py-1.5 leading-5 transition-colors hover:bg-white"
      >
        + New Event
      </Link>
    </nav>
  );
}
