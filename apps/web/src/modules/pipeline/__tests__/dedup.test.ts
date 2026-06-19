import { describe, expect, it } from 'vitest';
import { parseEventStart } from '../quality/dedup';

describe('parseEventStart (timezone-standardized)', () => {
  it('interprets date/time in the default event timezone (Europe/Berlin summer)', () => {
    // 11:00 in CEST (+02:00) → 09:00Z. This must not depend on the server TZ.
    expect(parseEventStart('2026-06-22', '11:00')?.toISOString()).toBe('2026-06-22T09:00:00.000Z');
  });

  it('honors an explicit timezone override', () => {
    expect(parseEventStart('2026-06-22', '11:00', 'America/New_York')?.toISOString()).toBe(
      '2026-06-22T15:00:00.000Z',
    );
  });

  it('defaults a missing time to midnight in the target timezone', () => {
    expect(parseEventStart('2026-06-22', null, 'Europe/Berlin')?.toISOString()).toBe(
      '2026-06-21T22:00:00.000Z',
    );
  });

  it('returns null when the date is missing', () => {
    expect(parseEventStart(null, '11:00')).toBeNull();
    expect(parseEventStart('', '11:00')).toBeNull();
  });

  it('keeps relative comparisons consistent across both operands', () => {
    const a = parseEventStart('2026-06-22', '11:00');
    const b = parseEventStart('2026-06-22', '17:00');
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    const hours = ((b as Date).getTime() - (a as Date).getTime()) / (1000 * 60 * 60);
    expect(hours).toBe(6);
  });
});
