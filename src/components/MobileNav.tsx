'use client';

import { useState } from 'react';
import Link from 'next/link';

type NavLink = {
  href: string;
  label: string;
  highlight?: boolean;
};

export function MobileNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="text-foreground hover:bg-muted-bg flex h-9 w-9 items-center justify-center rounded-[var(--radius-button)] transition-colors"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
      >
        {open ? (
          // X icon
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          // Hamburger icon
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        )}
      </button>

      {open && (
        <div className="border-border absolute top-14 right-0 left-0 z-50 border-b bg-white px-4 py-3 shadow-lg">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={
                  link.highlight
                    ? 'btn-primary rounded-[var(--radius-button)] px-3 py-2 text-center text-sm'
                    : 'text-foreground hover:bg-muted-bg rounded-[var(--radius-button)] px-3 py-2 text-sm transition-colors'
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
