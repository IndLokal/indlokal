'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function CityError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('City page error:', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-7xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-gray-200">Error</h1>
      <h2 className="mt-4 text-xl font-semibold text-gray-800">Something went wrong</h2>
      <p className="mt-2 max-w-md text-gray-500">
        We had trouble loading this page. Please try again or go back to the homepage.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Browse cities
        </Link>
      </div>
    </div>
  );
}
