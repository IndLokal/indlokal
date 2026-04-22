'use client';

import { useEffect } from 'react';
import Link from 'next/link';

type ErrorFallbackAction = {
  label: string;
  href: string;
};

type ErrorFallbackProps = {
  error: Error & { digest?: string };
  reset: () => void;
  /** Heading text. Defaults to "Something went wrong". */
  title?: string;
  /** Body text. */
  message?: string;
  /** Secondary navigation link (e.g. "Browse cities" → "/"). */
  action?: ErrorFallbackAction;
  /** Optional HTTP-style code to display. */
  code?: string;
};

/**
 * Shared error boundary UI.
 *
 * Each route's `error.tsx` re-exports this with its own config:
 *
 *   export default function CityError(props) {
 *     return <ErrorFallback {...props} action={{ label: 'Browse cities', href: '/' }} />;
 *   }
 */
export function ErrorFallback({
  error,
  reset,
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  action,
  code,
}: ErrorFallbackProps) {
  useEffect(() => {
    console.error('ErrorFallback:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      {code && <p className="text-border text-6xl font-bold">{code}</p>}
      <h2 className="text-foreground mt-4 text-xl font-semibold">{title}</h2>
      <p className="text-muted mt-2 max-w-md">{message}</p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="btn-primary px-5 py-2.5 text-sm">
          Try again
        </button>
        {action && (
          <Link href={action.href} className="btn-secondary px-5 py-2.5 text-sm">
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}
