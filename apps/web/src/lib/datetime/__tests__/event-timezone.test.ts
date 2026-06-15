import { describe, expect, it } from 'vitest';
import {
  formatDateTimeLocalInTimeZone,
  parseDateTimeLocalInTimeZone,
  parseEventDateTimeInTimeZone,
  formatEventTime,
  formatEventDateLong,
  formatEventDateShort,
  formatEventDateTimeMedium,
  formatEventCardDate,
} from '@/lib/datetime/event-timezone';

describe('parseDateTimeLocalInTimeZone', () => {
  it('parses summer datetime-local values in Europe/Berlin to UTC', () => {
    const parsed = parseDateTimeLocalInTimeZone('2026-06-15T10:30', 'Europe/Berlin');
    expect(parsed?.toISOString()).toBe('2026-06-15T08:30:00.000Z');
  });

  it('parses winter datetime-local values in Europe/Berlin to UTC', () => {
    const parsed = parseDateTimeLocalInTimeZone('2026-01-15T10:30', 'Europe/Berlin');
    expect(parsed?.toISOString()).toBe('2026-01-15T09:30:00.000Z');
  });

  it('returns null for invalid datetime-local strings', () => {
    expect(parseDateTimeLocalInTimeZone('invalid', 'Europe/Berlin')).toBeNull();
  });
});

describe('parseEventDateTimeInTimeZone', () => {
  it('combines date and time entered in Europe/Berlin (summer) into UTC', () => {
    // Regression: 22-Jun-2026 11:00 in CEST (+02:00) must store as 09:00Z,
    // and must not depend on the host machine's local timezone.
    const parsed = parseEventDateTimeInTimeZone('2026-06-22', '11:00', 'Europe/Berlin');
    expect(parsed?.toISOString()).toBe('2026-06-22T09:00:00.000Z');
  });

  it('combines an end time entered in Europe/Berlin (summer) into UTC', () => {
    const parsed = parseEventDateTimeInTimeZone('2026-06-22', '17:00', 'Europe/Berlin');
    expect(parsed?.toISOString()).toBe('2026-06-22T15:00:00.000Z');
  });

  it('round-trips through formatDateTimeLocalInTimeZone without shifting', () => {
    const parsed = parseEventDateTimeInTimeZone('2026-06-22', '11:00', 'Europe/Berlin');
    expect(parsed).not.toBeNull();
    expect(formatDateTimeLocalInTimeZone(parsed as Date, 'Europe/Berlin')).toBe('2026-06-22T11:00');
  });

  it('combines date and time in Europe/Berlin (winter) into UTC', () => {
    const parsed = parseEventDateTimeInTimeZone('2026-01-22', '11:00', 'Europe/Berlin');
    expect(parsed?.toISOString()).toBe('2026-01-22T10:00:00.000Z');
  });

  it('defaults missing time to midnight in the target timezone', () => {
    const parsed = parseEventDateTimeInTimeZone('2026-06-22', null, 'Europe/Berlin');
    expect(parsed?.toISOString()).toBe('2026-06-21T22:00:00.000Z');
  });

  it('returns null when the date is missing', () => {
    expect(parseEventDateTimeInTimeZone('', '11:00', 'Europe/Berlin')).toBeNull();
    expect(parseEventDateTimeInTimeZone(null, '11:00', 'Europe/Berlin')).toBeNull();
  });
});

describe('formatDateTimeLocalInTimeZone', () => {
  it('formats UTC timestamps as datetime-local in the target timezone', () => {
    const value = formatDateTimeLocalInTimeZone(
      new Date('2026-06-15T08:30:00.000Z'),
      'Europe/Berlin',
    );
    expect(value).toBe('2026-06-15T10:30');
  });
});

// ---------------------------------------------------------------------------
// Display formatter tests
// These prove the regression: a Berlin event stored as 09:00Z (UTC) must
// display as "11:00 AM", never "9:00 AM".
// ---------------------------------------------------------------------------

/** UTC Date representing "22-Jun-2026 11:00 AM" in Europe/Berlin (CEST, +02:00). */
const BERLIN_11AM_UTC = new Date('2026-06-22T09:00:00.000Z');
/** UTC Date representing "22-Jun-2026 05:00 PM" in Europe/Berlin. */
const BERLIN_5PM_UTC = new Date('2026-06-22T15:00:00.000Z');
/** UTC Date representing "22-Jan-2026 11:00 AM" in Europe/Berlin (CET, +01:00). */
const BERLIN_WINTER_11AM_UTC = new Date('2026-01-22T10:00:00.000Z');

describe('formatEventTime', () => {
  it('regression: 09:00Z displayed in Europe/Berlin shows 11:00 AM not 9:00 AM', () => {
    expect(formatEventTime(BERLIN_11AM_UTC, 'Europe/Berlin')).toBe('11:00 AM');
  });

  it('displays end time correctly in Europe/Berlin (summer)', () => {
    expect(formatEventTime(BERLIN_5PM_UTC, 'Europe/Berlin')).toBe('5:00 PM');
  });

  it('handles winter offset (CET +01:00) correctly', () => {
    expect(formatEventTime(BERLIN_WINTER_11AM_UTC, 'Europe/Berlin')).toBe('11:00 AM');
  });

  it('displays in UTC when timezone is UTC', () => {
    expect(formatEventTime(BERLIN_11AM_UTC, 'UTC')).toBe('9:00 AM');
  });
});

describe('formatEventDateLong', () => {
  it('returns the full date in the target timezone', () => {
    expect(formatEventDateLong(BERLIN_11AM_UTC, 'Europe/Berlin')).toBe('Monday, June 22, 2026');
  });

  it('does not shift date when UTC and local calendar day differ', () => {
    // 2026-06-22T22:30:00Z = 2026-06-23 00:30 in Berlin — must show June 23
    const lateNight = new Date('2026-06-22T22:30:00.000Z');
    const result = formatEventDateLong(lateNight, 'Europe/Berlin');
    expect(result).toContain('June 23');
  });
});

describe('formatEventDateShort', () => {
  it('returns a compact date string in the target timezone', () => {
    expect(formatEventDateShort(BERLIN_11AM_UTC, 'Europe/Berlin')).toBe('22 Jun 2026');
  });
});

describe('formatEventDateTimeMedium', () => {
  it('regression: Berlin event stored as 09:00Z must show 11:00 AM in medium format', () => {
    const result = formatEventDateTimeMedium(BERLIN_11AM_UTC, 'Europe/Berlin');
    expect(result).toContain('11:00 AM');
    expect(result).not.toContain('9:00 AM');
    expect(result).toContain('Jun');
  });

  it('includes the date portion', () => {
    const result = formatEventDateTimeMedium(BERLIN_11AM_UTC, 'Europe/Berlin');
    expect(result).toContain('22');
    expect(result).toContain('2026');
  });
});

describe('formatEventCardDate', () => {
  it('regression: Berlin event at 09:00Z must show 11:00 AM in card label', () => {
    // A future event — use a date well in the future to avoid flaky "Today" matches.
    const farFuture = new Date('2099-06-22T09:00:00.000Z');
    const result = formatEventCardDate(farFuture, 'Europe/Berlin');
    expect(result).toContain('11:00 AM');
    expect(result).not.toContain('9:00 AM');
  });

  it('uses UTC time when timezone is UTC', () => {
    const farFuture = new Date('2099-06-22T09:00:00.000Z');
    const result = formatEventCardDate(farFuture, 'UTC');
    expect(result).toContain('9:00 AM');
  });
});
