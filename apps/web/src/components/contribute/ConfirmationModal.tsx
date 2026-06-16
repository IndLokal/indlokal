'use client';

import Link from 'next/link';
import { useEffect } from 'react';

interface ConfirmationModalProps {
  entityType: 'community' | 'event';
  entityName: string;
  isOpen: boolean;
  backHref: string;
  backLabel?: string;
  dismissHref: string;
  dismissLabel?: string;
  similarHref: string;
}

export function ConfirmationModal({
  entityType,
  entityName,
  isOpen,
  backHref,
  backLabel,
  dismissHref,
  dismissLabel,
  similarHref,
}: ConfirmationModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="animate-fade-in mx-4 w-full max-w-md rounded-lg bg-white p-8 text-center shadow-lg">
        <div className="mb-4 flex justify-center">
          <div className="animate-scale-in flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg
              className="h-8 w-8 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <h2 className="text-foreground mb-2 text-lg font-bold">Thanks for your contribution</h2>

        <p className="text-muted mb-6 text-sm">
          <strong className="text-foreground">{entityName}</strong> was received and is now in
          review.
        </p>

        <div className="space-y-3">
          <a href={backHref} className="btn-primary block w-full py-2.5">
            {backLabel ?? `Back to ${entityType === 'community' ? 'Communities' : 'Events'}`}
          </a>
          <Link href={similarHref} className="btn-secondary block w-full py-2.5">
            View similar
          </Link>
          <a href={dismissHref} className="text-muted hover:text-foreground block pt-1 text-sm">
            {dismissLabel ?? 'Done'}
          </a>
        </div>
      </div>
    </div>
  );
}
