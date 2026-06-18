/**
 * Expo binding for the app → web auth hand-off (TDD-0058).
 *
 * Requests a one-time URL via the pure `./web-handoff` module, then opens it in
 * an in-app browser (SFSafariViewController / Chrome Custom Tabs) so the user
 * lands on a web-only surface already authenticated.
 *
 * Pure request/validation logic lives in `./web-handoff.ts` (node-testable);
 * this file owns only the Expo `WebBrowser` open.
 */

import { useCallback, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { describeAuthError } from './auth-errors';
import { requestWebHandoffUrl, type WebHandoffInput } from './web-handoff';
import type { AuthClient } from './client';

export { isHttpsUrl, requestWebHandoffUrl } from './web-handoff';
export type { WebHandoffInput } from './web-handoff';

/**
 * Mint a hand-off URL and open it in an in-app browser. Returns the
 * `WebBrowser` result on success; throws a friendly, non-leaky error otherwise.
 */
export async function openWebHandoff(
  client: Pick<AuthClient, 'postAuthed'>,
  input: WebHandoffInput = {},
): Promise<WebBrowser.WebBrowserResult> {
  const url = await requestWebHandoffUrl(client, input);
  return WebBrowser.openBrowserAsync(url);
}

/**
 * React hook for opening a web-only surface authenticated. `open(next?)`
 * returns true on success, false on failure (and surfaces `error`).
 */
export function useWebHandoff(client: Pick<AuthClient, 'postAuthed'>) {
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(
    async (input: WebHandoffInput = {}): Promise<boolean> => {
      setError(null);
      setIsOpening(true);
      try {
        await openWebHandoff(client, input);
        return true;
      } catch (err) {
        setError(describeAuthError(err, 'session'));
        return false;
      } finally {
        setIsOpening(false);
      }
    },
    [client],
  );

  return { open, isOpening, error };
}
