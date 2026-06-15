import { describe, expect, it } from 'vitest';
import {
  formatDateTimeLocalInTimeZone,
  parseDateTimeLocalInTimeZone,
  parseEventDateTimeInTimeZone,
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
