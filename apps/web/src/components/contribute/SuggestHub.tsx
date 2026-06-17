'use client';

import Link from 'next/link';

interface SuggestHubProps {
  baseHref: string;
}

export function SuggestHub({ baseHref }: SuggestHubProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Link
        href={`${baseHref}?type=community`}
        className="group hover:border-brand-400 relative overflow-hidden rounded-lg border border-gray-200 bg-white p-6 transition-all hover:shadow-md"
      >
        <div className="flex flex-col items-start">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 transition-colors group-hover:bg-blue-200">
            <svg
              className="h-6 w-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM18 20a6 6 0 11-12 0 6 6 0 0112 0z"
              />
            </svg>
          </div>
          <h3 className="text-foreground mb-2 text-lg font-semibold">Contribute a community</h3>
          <p className="text-muted mb-4 flex-grow text-sm">
            Tell us about a cultural group, organization, or community that should be listed.
          </p>
          <span className="text-brand-600 group-hover:text-brand-700 text-sm font-medium">
            Get started {'->'}
          </span>
        </div>
      </Link>

      <Link
        href={`${baseHref}?type=event`}
        className="group hover:border-brand-400 relative overflow-hidden rounded-lg border border-gray-200 bg-white p-6 transition-all hover:shadow-md"
      >
        <div className="flex flex-col items-start">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 transition-colors group-hover:bg-green-200">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-foreground mb-2 text-lg font-semibold">Contribute an event</h3>
          <p className="text-muted mb-4 flex-grow text-sm">
            Know about a cultural, professional, or social event we should add?
          </p>
          <span className="text-brand-600 group-hover:text-brand-700 text-sm font-medium">
            Get started {'->'}
          </span>
        </div>
      </Link>

      <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-6 opacity-70 sm:col-span-2">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
          <svg
            className="h-6 w-6 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v11.494m-5.197-7.197 10.394 0M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"
            />
          </svg>
        </div>
        <h3 className="text-foreground mb-2 text-lg font-semibold">Contribute a resource</h3>
        <p className="text-muted mb-2 text-sm">
          Resource suggestions are locked for v1.1 while scope and region dedup rules are finalized.
        </p>
        <span className="text-sm font-medium text-slate-500">Coming soon</span>
      </div>
    </div>
  );
}
