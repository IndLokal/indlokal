/**
 * JWT issuance + verification — TDD-0001 §1, §3.
 *
 * - Access tokens: short-lived (15 min), RS256-signed, contain user claims.
 * - Refresh tokens: opaque random strings (NOT JWTs); hashed at rest in
 *   the RefreshToken table. Issued + verified by lib/auth/refresh.ts (TBD).
 *
 * Key strategy:
 * - Production: RSA private key in env (AUTH_JWT_PRIVATE_KEY, PEM). Public
 *   key derived from it. KMS integration is a future hardening step.
 * - Dev/test: a deterministic key pair is generated on first call and
 *   cached in-process so handlers can be exercised without secrets.
 *
 * Failure modes (TDD-0001 §8):
 * - ±60s clock skew tolerance on verification.
 * - KMS/env key absent → fall back to dev key with a console warning.
 */

import {
  SignJWT,
  jwtVerify,
  importPKCS8,
  importSPKI,
  exportSPKI,
  generateKeyPair,
  type JWTPayload,
} from 'jose';

type CryptoKeyLike = Awaited<ReturnType<typeof importPKCS8>>;

const ALG = 'RS256';
const CLOCK_TOLERANCE_SECONDS = 60;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

const ISSUER = process.env.AUTH_JWT_ISSUER ?? 'https://indlokal.com';
const AUDIENCE = process.env.AUTH_JWT_AUDIENCE ?? 'indlokal-api';

type KeyMaterial = {
  privateKey: CryptoKeyLike;
  publicKey: CryptoKeyLike;
  /** PEM SPKI for clients that want to verify out-of-band (JWKS endpoint). */
  publicKeyPem: string;
};

let cachedKeys: KeyMaterial | null = null;
let warnedDevKey = false;

async function loadKeysFromEnv(): Promise<KeyMaterial | null> {
  const privatePem = process.env.AUTH_JWT_PRIVATE_KEY;
  const publicPem = process.env.AUTH_JWT_PUBLIC_KEY;
  if (!privatePem || !publicPem) return null;

  const privateKey = await importPKCS8(privatePem.replace(/\\n/g, '\n'), ALG);
  const publicKey = await importSPKI(publicPem.replace(/\\n/g, '\n'), ALG);
  return { privateKey, publicKey, publicKeyPem: publicPem };
}

async function getOrCreateDevKeys(): Promise<KeyMaterial> {
  if (!warnedDevKey && process.env.NODE_ENV !== 'test') {
    console.warn(
      '[auth/jwt] AUTH_JWT_PRIVATE_KEY/PUBLIC_KEY not set; using ephemeral dev key. ' +
        'Set both env vars in production.',
    );
    warnedDevKey = true;
  }
  const { privateKey, publicKey } = await generateKeyPair(ALG, { extractable: true });
  const publicKeyPem = await exportSPKI(publicKey);
  return { privateKey, publicKey, publicKeyPem };
}

async function getKeys(): Promise<KeyMaterial> {
  if (cachedKeys) return cachedKeys;
  cachedKeys = (await loadKeysFromEnv()) ?? (await getOrCreateDevKeys());
  return cachedKeys;
}

/** Reset the cached key material — for tests only. */
export function __resetJwtCacheForTests(): void {
  cachedKeys = null;
  warnedDevKey = false;
}

/** Returns the current public key in PEM SPKI form (for a JWKS endpoint). */
export async function getPublicKeyPem(): Promise<string> {
  const { publicKeyPem } = await getKeys();
  return publicKeyPem;
}

export type AccessTokenInput = {
  userId: string;
  email: string;
  role: string;
  /** ID of the refresh-token chain that minted this access token. */
  jti: string;
};

export type IssuedAccessToken = {
  token: string;
  expiresAt: Date;
};

/** Issue a short-lived access token. */
export async function issueAccessToken(input: AccessTokenInput): Promise<IssuedAccessToken> {
  const { privateKey } = await getKeys();
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ACCESS_TOKEN_TTL_SECONDS;

  const token = await new SignJWT({
    email: input.email,
    role: input.role,
  })
    .setProtectedHeader({ alg: ALG, typ: 'JWT' })
    .setSubject(input.userId)
    .setJti(input.jti)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .sign(privateKey);

  return { token, expiresAt: new Date(expiresAt * 1000) };
}

export type VerifiedAccessToken = {
  userId: string;
  email: string;
  role: string;
  jti: string;
  expiresAt: Date;
};

export class TokenVerificationError extends Error {
  constructor(
    public readonly code: 'TOKEN_EXPIRED' | 'TOKEN_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'TokenVerificationError';
  }
}

/** Verify a token and return its claims, or throw a TokenVerificationError. */
export async function verifyAccessToken(token: string): Promise<VerifiedAccessToken> {
  const { publicKey } = await getKeys();
  let payload: JWTPayload;
  try {
    const result = await jwtVerify(token, publicKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      algorithms: [ALG],
    });
    payload = result.payload;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'verification failed';
    const expired = /expired/i.test(message);
    throw new TokenVerificationError(
      expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
      message,
    );
  }

  if (
    typeof payload.sub !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.role !== 'string' ||
    typeof payload.jti !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    throw new TokenVerificationError('TOKEN_INVALID', 'malformed claims');
  }

  return {
    userId: payload.sub,
    email: payload.email,
    role: payload.role,
    jti: payload.jti,
    expiresAt: new Date(payload.exp * 1000),
  };
}
