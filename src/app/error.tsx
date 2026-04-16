'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-gray-200">500</h1>
      <h2 className="mt-4 text-xl font-semibold text-gray-800">Something went wrong</h2>
      <p className="mt-2 max-w-md text-gray-500">An unexpected error occurred. Please try again.</p>
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Try again
      </button>
    </div>
  );
}
