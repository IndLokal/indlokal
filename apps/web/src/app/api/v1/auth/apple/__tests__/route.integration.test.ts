/**
 * Integration tests — /api/v1/auth/apple.
 *
 * @db — requires the test database. We don't talk to Apple; instead we
 * inject a local JWKS resolver and sign tokens with a generated key,
 * exercising the same `jwtVerify()` code path as production.
 */
import { describe, it, expect, beforeEach, afterAll, beforeAll, vi } from 'vitest';
import { SignJWT, generateKeyPair, exportJWK, type JWK } from 'jose';
import { testDb, cleanDb } from '@/test/db-helpers';

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  return { ...mod, db: testDb };
});

const { POST, __setAppleJwksForTests } = await import('../route');

const APPLE_AUD = 'com.indlokal.app';
const APPLE_ISS = 'https://appleid.apple.com';

let signKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let publicJwk: JWK;
const KID = 'test-key-1';

beforeAll(async () => {
  process.env.APPLE_CLIENT_ID = APPLE_AUD;
  const pair = await generateKeyPair('RS256', { extractable: true });
  signKey = pair.privateKey;
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: KID, alg: 'RS256', use: 'sig' };

  // Local JWKS resolver matching jose's createRemoteJWKSet signature.
  const jwksFn = (async (header: { kid?: string }) => {
    if (header.kid && header.kid !== KID) throw new Error('kid mismatch');
    const { importJWK } = await import('jose');
    return importJWK(publicJwk, 'RS256');
  }) as unknown as ReturnType<
    typeof import('jose').createRemoteJWKSet
  >;
  __setAppleJwksForTests(jwksFn);
});

beforeEach(() => cleanDb());
afterAll(async () => {
  __setAppleJwksForTests(null);
  await testDb.$disconnect();
});

async function signAppleIdentityToken(claims: { sub: string; email?: string }): Promise<string> {
  const builder = new SignJWT({ ...(claims.email ? { email: claims.email } : {}) })
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setSubject(claims.sub)
    .setIssuer(APPLE_ISS)
    .setAudience(APPLE_AUD)
    .setIssuedAt()
    .setExpirationTime('5m');
  return builder.sign(signKey);
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/auth/apple', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/auth/apple', () => {
  it('400 on invalid body', async () => {
    const res = await POST(makeRequest({ identityToken: '' }) as never);
    expect(res.status).toBe(400);
  });

  it('creates a user when Apple supplies the email in the JWT', async () => {
    const idToken = await signAppleIdentityToken({
      sub: 'apple-sub-1',
      email: 'apple@example.com',
    });

    const res = await POST(
      makeRequest({ identityToken: idToken, authorizationCode: 'auth' }) as never,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.email).toBe('apple@example.com');

    const user = await testDb.user.findUnique({ where: { email: 'apple@example.com' } });
    expect(user!.appleId).toBe('apple-sub-1');
  });

  it('uses first-time payload email when JWT email is absent', async () => {
    const idToken = await signAppleIdentityToken({ sub: 'apple-sub-2' });
    const res = await POST(
      makeRequest({
        identityToken: idToken,
        authorizationCode: 'auth',
        user: { email: 'first@example.com', name: { firstName: 'First', lastName: 'Time' } },
      }) as never,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.email).toBe('first@example.com');
    expect(json.user.displayName).toBe('First Time');
  });

  it('links appleId to an existing email account', async () => {
    await testDb.user.create({ data: { email: 'shared@example.com', displayName: 'Shared' } });
    const idToken = await signAppleIdentityToken({
      sub: 'apple-sub-3',
      email: 'shared@example.com',
    });

    const res = await POST(
      makeRequest({ identityToken: idToken, authorizationCode: 'auth' }) as never,
    );
    expect(res.status).toBe(200);

    const after = await testDb.user.findUnique({ where: { email: 'shared@example.com' } });
    expect(after!.appleId).toBe('apple-sub-3');
  });

  it('400 when no email is available on first-ever sign-in', async () => {
    const idToken = await signAppleIdentityToken({ sub: 'apple-sub-4' });
    const res = await POST(
      makeRequest({ identityToken: idToken, authorizationCode: 'auth' }) as never,
    );
    expect(res.status).toBe(400);
  });

  it('401 on a token signed with the wrong key', async () => {
    const otherPair = await generateKeyPair('RS256', { extractable: true });
    const badToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: KID })
      .setSubject('apple-sub-bad')
      .setIssuer(APPLE_ISS)
      .setAudience(APPLE_AUD)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(otherPair.privateKey);

    const res = await POST(
      makeRequest({ identityToken: badToken, authorizationCode: 'auth' }) as never,
    );
    expect(res.status).toBe(401);
  });
});
