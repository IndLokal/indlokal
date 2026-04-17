'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Initialise posthog-js once on the client.
 * Skipped when the key is not configured (dev / CI by default).
 */
function PostHogInit() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;

    posthog.init(key, {
      api_host: '/ingest', // proxied via next.config.ts to avoid ad-blockers
      ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com',
      capture_pageview: false, // we handle this manually below
      capture_pageleave: true,
      session_recording: { maskAllInputs: true },
      persistence: 'localStorage+cookie',
    });
  }, []);

  return null;
}

/**
 * Fires a $pageview event on every client-side route change.
 * Required because Next.js App Router navigation doesn't reload the page.
 */
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (!ph) return;
    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
    ph.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams, ph]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PostHogInit />
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
