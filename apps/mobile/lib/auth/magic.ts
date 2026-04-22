import { auth } from '@indlokal/shared';
import type { AuthClient } from './client';

const DEFAULT_MAGIC_REDIRECT = 'https://indlokal.com/auth/magic';

export async function requestMagicLink(
  client: AuthClient,
  email: string,
  redirectTo: string = DEFAULT_MAGIC_REDIRECT,
) {
  const payload = auth.MagicLinkRequest.parse({ email, redirectTo });
  return client.postPublic<typeof payload, auth.MagicLinkRequestResponse>(
    '/api/v1/auth/magic-link/request',
    payload,
  );
}

export async function verifyMagicLinkToken(client: AuthClient, token: string) {
  const payload = auth.MagicLinkVerify.parse({ token });
  const tokens = await client.postPublic<typeof payload, auth.AuthTokens>(
    '/api/v1/auth/magic-link/verify',
    payload,
  );
  const parsed = auth.AuthTokens.parse(tokens);
  await client.setTokens(parsed);
  return parsed;
}

export function extractMagicLinkToken(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('token');
  } catch {
    return null;
  }
}

export async function verifyMagicLinkFromUrl(client: AuthClient, url: string) {
  const token = extractMagicLinkToken(url);
  if (!token) return null;
  return verifyMagicLinkToken(client, token);
}
