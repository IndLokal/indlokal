import { createRemoteJWKSet } from 'jose';

const APPLE_JWKS_URL = new URL('https://appleid.apple.com/auth/keys');

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export function getAppleJwks() {
  jwks ??= createRemoteJWKSet(APPLE_JWKS_URL);
  return jwks;
}

/** Test-only: swap the JWKS resolver. */
export function __setAppleJwksForTests(
  override: ReturnType<typeof createRemoteJWKSet> | null,
): void {
  jwks = override;
}
