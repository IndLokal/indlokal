import { describe, expect, it } from 'vitest';
import {
  formatDateTimeLocalInTimeZone,
  parseDateTimeLocalInTimeZone,
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

describe('formatDateTimeLocalInTimeZone', () => {
  it('formats UTC timestamps as datetime-local in the target timezone', () => {
    const value = formatDateTimeLocalInTimeZone(
      new Date('2026-06-15T08:30:00.000Z'),
      'Europe/Berlin',
    );
    expect(value).toBe('2026-06-15T10:30');
  });
});
