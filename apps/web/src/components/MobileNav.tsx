'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type NavLink = {
  href: string;
  label: string;
  highlight?: boolean;
};

export function MobileNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <div className="sm:hidden">
      {/* Hamburger — 44×44 tap target */}
      <button
        onClick={() => setOpen(!open)}
        className="text-foreground hover:bg-muted-bg flex h-11 w-11 items-center justify-center rounded-[var(--radius-button)] transition-colors"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
      >
        {open ? (
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
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />
          {/* Dropdown — aligned to h-16 header bottom */}
          <div className="border-border fixed top-16 right-0 left-0 z-50 border-b bg-white px-4 py-3 shadow-lg">
            <nav className="flex flex-col gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={close}
                  className={
                    link.highlight
                      ? 'btn-primary rounded-[var(--radius-button)] px-3 py-3 text-center text-sm active:scale-[0.97]'
                      : 'text-foreground hover:bg-muted-bg active:bg-muted-bg rounded-[var(--radius-button)] px-3 py-3 text-sm transition-colors active:opacity-70'
                  }
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
