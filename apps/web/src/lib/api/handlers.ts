/**
 * Centralised error-handling wrappers — three building blocks for every
 * layer of the stack.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  withDb(fn)       — server components / layouts                 │
 * │  withAction(fn)   — 'use server' actions                        │
 * │  apiHandler(fn)   — /api/* route handlers                       │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Why this exists
 * ---------------
 * Neon (free tier) suspends the database after ~5 min idle. The first
 * request after a cold-start throws a P1001 connection error before any
 * application logic runs. Without a safety net this crashes pages,
 * silently hangs forms, or returns HTTP 500 to the mobile client.
 *
 * The wrappers centralise the catch so individual callers stay thin and
 * consistent. They log the error once (server-side only — never leaking
 * internals to the client) and return a safe fallback.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiError } from './error';

// ─── withDb ──────────────────────────────────────────────────────────────────

/**
 * Wrap a DB call in a server component or layout.
 * Returns `null` on any error so the page degrades gracefully instead of
 * throwing an unhandled exception.
 *
 * @example
 *   const user = await withDb(() => db.user.findUnique({ where: { id } }));
 *   if (!user) return <SignInPrompt />;
 */
export async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error('[withDb] database error:', err);
    return null;
  }
}

// ─── withAction ──────────────────────────────────────────────────────────────

/**
 * Whether an error is a Next.js internal redirect / notFound throw.
 * These must be re-thrown so Next.js can handle them correctly.
 */
function isNextInternalError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'digest' in err &&
    typeof (err as { digest: unknown }).digest === 'string' &&
    /^NEXT_(?:REDIRECT|NOT_FOUND)/.test((err as { digest: string }).digest)
  );
}

/**
 * Wrap the body of a `'use server'` action.
 *
 * Any unhandled throw (e.g. DB cold-start) is caught and passed to the
 * `onError` callback, which should return the action's typed failure shape.
 * Next.js internal throws (redirect, notFound) are re-thrown transparently.
 *
 * @example
 *   export async function myAction(fd: FormData): Promise<MyResult> {
 *     return withAction(
 *       async () => { ... },
 *       () => ({ success: false, errors: { _: ['Something went wrong'] } }),
 *     );
 *   }
 */
export async function withAction<T>(
  fn: () => Promise<T>,
  onError: (err: unknown) => T,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error('[withAction] unhandled action error:', err);
    return onError(err);
  }
}

// ─── apiHandler ──────────────────────────────────────────────────────────────

/**
 * Wrap a Next.js route handler function.
 * Any unhandled throw is caught and returns a canonical `INTERNAL` JSON
 * error envelope (via `apiError`) instead of a plain HTTP 500 page.
 *
 * Two overloads cover both route kinds:
 *   - Simple (no dynamic params): `apiHandler(async (req) => { ... })`
 *   - Dynamic segments:           `apiHandler(async (req, ctx: Ctx) => { ... })`
 *
 * TypeScript infers `Ctx` from the callback so no explicit generic is needed
 * in most cases.
 */
// Simple routes (no ctx)
export function apiHandler(
  fn: (req: NextRequest) => Promise<NextResponse>,
): (req: NextRequest) => Promise<NextResponse>;
// Dynamic routes (typed ctx)
export function apiHandler<C>(
  fn: (req: NextRequest, ctx: C) => Promise<NextResponse>,
): (req: NextRequest, ctx: C) => Promise<NextResponse>;
// Implementation
export function apiHandler(fn: unknown): unknown {
  return async (req: NextRequest, ctx?: unknown) => {
    try {
      return await (fn as (req: NextRequest, ctx?: unknown) => Promise<NextResponse>)(req, ctx);
    } catch (err) {
      console.error('[apiHandler] unhandled route error:', err);
      return apiError('INTERNAL', 'an unexpected error occurred');
    }
  };
}
