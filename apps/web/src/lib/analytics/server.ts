import { PostHog } from 'posthog-node';

/**
 * Server-side PostHog client (posthog-node).
 * Used in server actions and API routes to capture server-side events.
 * Returns null when NEXT_PUBLIC_POSTHOG_KEY is not configured (dev / CI).
 */
function createPostHogClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  return new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    // Flush immediately in serverless environments (no long-lived process)
    flushAt: 1,
    flushInterval: 0,
  });
}

// Module-level singleton — re-used across requests in the same worker
let _client: PostHog | null | undefined;

export function getPostHogClient(): PostHog | null {
  if (_client === undefined) {
    _client = createPostHogClient();
  }
  return _client;
}

/**
 * Capture a server-side analytics event.
 * Silently no-ops when PostHog is not configured.
 */
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const client = getPostHogClient();
  if (!client) return;

  try {
    client.capture({ distinctId, event, properties: properties ?? {} });
    await client.flush();
  } catch {
    // Analytics must never break the application
  }
}
