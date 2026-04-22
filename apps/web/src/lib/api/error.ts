/**
 * Canonical JSON error envelope for /api/v1/* — TDD-0001 §3, ADR-0002.
 *
 * Every non-2xx response from a v1 route handler MUST go through this
 * helper so the wire shape stays in lockstep with `ApiError` from
 * `@indlokal/shared`.
 */

import { NextResponse } from 'next/server';
import type { common } from '@indlokal/shared';

type ApiErrorCode = common.ApiErrorCode;

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  TOKEN_EXPIRED: 401,
  TOKEN_INVALID: 401,
  TOKEN_REUSED: 401,
  INTERNAL: 500,
};

export function apiError(
  code: ApiErrorCode,
  message: string,
  options: { status?: number; details?: unknown; headers?: HeadersInit } = {},
): NextResponse {
  const status = options.status ?? STATUS_BY_CODE[code];
  return NextResponse.json(
    { error: { code, message, ...(options.details !== undefined ? { details: options.details } : {}) } },
    { status, headers: options.headers },
  );
}
