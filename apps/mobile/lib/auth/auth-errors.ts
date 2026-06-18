/**
 * Maps low-level auth failures to short, user-facing messages.
 *
 * Pure module (no Expo/React-Native imports) so it can be unit-tested in Node
 * and reused by every mobile sign-in path (Google, Apple, magic link).
 *
 * It NEVER surfaces server internals — only a friendly, generic message keyed
 * off the AuthClientError `code`/`status` (or a network failure).
 */

import { AuthClientError } from './client';

export type AuthErrorContext = 'google' | 'apple' | 'magic' | 'session';

const NETWORK_MESSAGE = "Can't reach IndLokal. Check your connection and try again.";

const CONTEXT_FALLBACK: Record<AuthErrorContext, string> = {
  google: "We couldn't complete Google sign-in. Please try again.",
  apple: "We couldn't complete Apple sign-in. Please try again.",
  magic: 'Unable to send your magic link. Please try again.',
  session: 'Your session has expired. Please sign in again.',
};

function isNetworkError(error: unknown): boolean {
  // fetch() rejects with a TypeError when the host is unreachable.
  return error instanceof TypeError;
}

export function describeAuthError(error: unknown, context: AuthErrorContext): string {
  if (isNetworkError(error)) return NETWORK_MESSAGE;

  if (error instanceof AuthClientError) {
    // Backend signalled OAuth isn't configured/available server-side.
    if (error.code === 'INTERNAL' || error.status >= 500) {
      return `${
        context === 'google' ? 'Google' : context === 'apple' ? 'Apple' : 'Sign-in'
      } sign-in isn't available right now. Please try again later.`;
    }
    if (error.status === 401) {
      return context === 'session' ? CONTEXT_FALLBACK.session : CONTEXT_FALLBACK[context];
    }
  }

  return CONTEXT_FALLBACK[context];
}
