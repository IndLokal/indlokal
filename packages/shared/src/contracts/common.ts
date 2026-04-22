/**
 * Common primitives shared across all contracts.
 *
 * Per ADR-0002, every endpoint imports its request/response Zod
 * schemas from this package; OpenAPI is generated from them.
 */

import { z } from 'zod';

/**
 * CUID v1/v2 — Prisma's default ID format.
 * Permissive on length to avoid coupling to Prisma version.
 */
export const Cuid = z.string().min(20).max(40);
export type Cuid = z.infer<typeof Cuid>;

/**
 * RFC 3339 date-time string (ISO 8601 subset).
 */
export const IsoDateTime = z.string().datetime({ offset: true });

/**
 * Generic ack response — used by mutations that have no useful payload
 * to return (e.g. logout, magic-link-request).
 */
export const Ack = z.object({
  ok: z.literal(true),
});
export type Ack = z.infer<typeof Ack>;

/**
 * Standard error envelope. Every non-2xx response from /api/v1/*
 * MUST conform to this shape so mobile + web can share error handling.
 */
export const ApiErrorCode = z.enum([
  'BAD_REQUEST',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
  'TOKEN_REUSED',
  'INTERNAL',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

export const ApiError = z.object({
  error: z.object({
    code: ApiErrorCode,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

/**
 * Cursor-based pagination envelope. Modules wrap their item type
 * with this when needed.
 */
export function Page<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().optional(),
  });
}
