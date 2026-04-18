'use client';

import { useEffect, useRef } from 'react';
import { usePostHog } from 'posthog-js/react';

type Props = {
  userId: string | null;
};

/**
 * Syncs PostHog identity with the server-side session.
 * - When `userId` is set → calls posthog.identify()
 * - When `userId` transitions from set → null (logout) → calls posthog.reset()
 *
 * Rendered in the root layout so identity stays in sync across navigations.
 */
export function PostHogIdentify({ userId }: Props) {
  const posthog = usePostHog();
  const prevUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog) return;

    if (userId && userId !== prevUserId.current) {
      posthog.identify(userId);
    } else if (!userId && prevUserId.current) {
      // User logged out
      posthog.reset();
    }

    prevUserId.current = userId;
  }, [posthog, userId]);

  return null;
}
