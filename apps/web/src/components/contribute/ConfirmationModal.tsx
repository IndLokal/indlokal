'use client';

import Link from 'next/link';
import { useEffect } from 'react';

interface ConfirmationModalProps {
  entityType: 'community' | 'event';
  entityName: string;
  isOpen: boolean;
  backHref: string;
  backLabel?: string;
  similarHref: string;
}

export function ConfirmationModal({
  entityType,
  entityName,
  isOpen,
  backHref,
  backLabel,
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

        <h2 className="text-foreground mb-2 text-lg font-bold">Thanks for the suggestion!</h2>

        <p className="text-muted mb-4 text-sm">
          <strong className="text-foreground">{entityName}</strong> has been submitted for review.
        </p>

        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm">
            <span className="font-semibold text-blue-900">Status:</span>{' '}
            <span className="text-blue-800">Under review</span>
          </p>
          <p className="mt-2 text-xs text-blue-700">
            Expected timeline: <strong>~72 hours</strong>
          </p>
        </div>

        <div className="space-y-3">
          <Link href={backHref} className="btn-primary block w-full py-2.5">
            {backLabel ?? `Back to ${entityType === 'community' ? 'Communities' : 'Events'}`}
          </Link>
          <Link href={similarHref} className="btn-secondary block w-full py-2.5">
            View similar
          </Link>
        </div>

        <p className="text-muted mt-4 text-xs">
          This window will close automatically when you navigate away.
        </p>
      </div>
    </div>
  );
}
