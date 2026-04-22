/**
 * Pure unit tests for quiet-hours window logic. The outbox processor itself
 * is integration tested separately with a real Postgres.
 */
import { describe, expect, it } from 'vitest';
import { isQuietHours } from '../outbox';

describe('isQuietHours', () => {
  it('returns true within a non-wrapping window', () => {
    const now = new Date('2026-01-15T13:30:00Z'); // 14:30 Berlin (winter UTC+1)
    expect(
      isQuietHours(now, { startMin: 14 * 60, endMin: 15 * 60, timezone: 'Europe/Berlin' }),
    ).toBe(true);
  });

  it('returns false outside a non-wrapping window', () => {
    const now = new Date('2026-01-15T13:30:00Z'); // 14:30 Berlin
    expect(
      isQuietHours(now, { startMin: 16 * 60, endMin: 18 * 60, timezone: 'Europe/Berlin' }),
    ).toBe(false);
  });

  it('returns true inside a window that wraps midnight (late night)', () => {
    const now = new Date('2026-01-15T23:00:00Z'); // 00:00 Berlin
    expect(
      isQuietHours(now, { startMin: 22 * 60, endMin: 8 * 60, timezone: 'Europe/Berlin' }),
    ).toBe(true);
  });

  it('returns true inside a window that wraps midnight (early morning)', () => {
    const now = new Date('2026-01-15T05:30:00Z'); // 06:30 Berlin
    expect(
      isQuietHours(now, { startMin: 22 * 60, endMin: 8 * 60, timezone: 'Europe/Berlin' }),
    ).toBe(true);
  });

  it('returns false outside a wrapping window', () => {
    const now = new Date('2026-01-15T11:30:00Z'); // 12:30 Berlin
    expect(
      isQuietHours(now, { startMin: 22 * 60, endMin: 8 * 60, timezone: 'Europe/Berlin' }),
    ).toBe(false);
  });

  it('returns false when window is empty (start === end)', () => {
    const now = new Date('2026-01-15T13:30:00Z');
    expect(isQuietHours(now, { startMin: 600, endMin: 600, timezone: 'Europe/Berlin' })).toBe(
      false,
    );
  });
});
