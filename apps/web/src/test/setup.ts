/**
 * Global test setup file — runs before every test file.
 *
 * - Extends Vitest's expect with jest-dom matchers
 *   (toBeInTheDocument, toHaveTextContent, etc.)
 * - Mocks Next.js-specific modules so component tests
 *   don't need the full Next.js runtime.
 */
import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// ─── Next.js module mocks ────────────────────────────────────────────────────

// next/link → plain <a> tag in tests
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => React.createElement('a', { href, className }, children),
}));

// next/navigation → controllable stubs
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

// next/headers → stub for server component tests
vi.mock('next/headers', () => ({
  headers: () => new Headers(),
  cookies: () => ({ get: vi.fn(), set: vi.fn() }),
}));

// next/cache → make unstable_cache a passthrough in tests so route handlers
// can be invoked outside the Next request runtime (no incrementalCache).
vi.mock('next/cache', () => ({
  unstable_cache: <Args extends unknown[], R>(fn: (...args: Args) => Promise<R>) => fn,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));
