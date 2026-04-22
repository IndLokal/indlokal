/**
 * Test helpers for /api/v1 endpoints.
 *
 * `bearerHeaders(userId)` returns a Headers object with a freshly
 * minted access JWT for the given user — saves every test from
 * having to call `issueAccessToken` itself.
 */

import { issueAccessToken } from '@/lib/auth/jwt';

export async function bearerHeaders(args: {
  userId: string;
  email?: string;
  role?: string;
  jti?: string;
}): Promise<Record<string, string>> {
  const { token } = await issueAccessToken({
    userId: args.userId,
    email: args.email ?? `${args.userId}@example.test`,
    role: args.role ?? 'USER',
    jti: args.jti ?? `jti-${args.userId}`,
  });
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  };
}
