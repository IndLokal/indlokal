/**
 * Mobile analytics client (Expo wrapper) - PRD/TDD-0040.
 *
 * Fire-and-forget: posts behavioral events to POST /api/v1/track. Auth is
 * optional server-side; we attach the bearer token when the user is signed in
 * so the interaction is attributed. Failures are swallowed - tracking must
 * never block or break the UX (TDD-0040 §8).
 */

import { authClient } from '@/lib/auth/client.expo';
import { buildTrackPayload, type TrackInput } from './events';

export function track(input: TrackInput): void {
  const payload = buildTrackPayload(input);
  void (async () => {
    try {
      const tokens = await authClient.getTokens();
      if (tokens?.accessToken) {
        await authClient.postAuthed('/api/v1/track', payload as unknown as Record<string, unknown>);
      } else {
        await authClient.postPublic('/api/v1/track', payload as unknown as Record<string, unknown>);
      }
    } catch {
      // Tracking is non-critical - never surface or rethrow.
    }
  })();
}
