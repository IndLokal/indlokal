/**
 * Pure app → web hand-off request (no Expo/React-Native imports) so it can be
 * unit-tested in Node. The Expo-coupled in-app-browser open lives in
 * `./web-handoff.expo.ts`, which re-exports this for callers.
 *
 * Asks the backend (`POST /api/v1/auth/handoff`, authenticated with the mobile
 * JWT) for a one-time URL that lands the user authenticated on web, validates
 * the response, and returns the https URL to open.
 */

import { auth } from '@indlokal/shared';
import type { AuthClient } from './client';

export type WebHandoffInput = {
  /** In-product path to land on after the web session is established. */
  next?: string;
};

/** Whether a string is an absolute https URL (the only kind we will open). */
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Request a one-time hand-off URL. Validates the response envelope and that the
 * URL is https before returning it. Throws on backend/validation failure.
 */
export async function requestWebHandoffUrl(
  client: Pick<AuthClient, 'postAuthed'>,
  input: WebHandoffInput = {},
): Promise<string> {
  const payload = auth.WebHandoffRequest.parse({ next: input.next });
  const response = await client.postAuthed<typeof payload, auth.WebHandoffResponse>(
    '/api/v1/auth/handoff',
    payload,
  );
  const parsed = auth.WebHandoffResponse.parse(response);
  if (!isHttpsUrl(parsed.url)) {
    throw new Error('web handoff returned a non-https url');
  }
  return parsed.url;
}
