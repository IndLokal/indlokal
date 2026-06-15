const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Default IANA timezone used to interpret event wall-clock date/time values when
 * a city has no timezone configured. Cities are created with this same default
 * (`City.timezone` is non-nullable), so this fallback is a last-resort guard and
 * should rarely trigger. Centralized here so every event date/time code path
 * shares one explicit, documented default instead of scattered magic strings.
 */
export const DEFAULT_EVENT_TIMEZONE = 'Europe/Berlin';

function getOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'shortOffset',
  }).formatToParts(date);

  const zoneName = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+0';
  const match = zoneName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return 0;

  const sign = match[1] === '+' ? 1 : -1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? '0');
  return sign * (hours * 60 + minutes);
}

export function parseDateTimeLocalInTimeZone(value: string, timeZone: string): Date | null {
  const match = DATETIME_LOCAL_RE.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return null;
  }

  // Start with naive UTC and refine using zone offset. Two iterations are
  // sufficient for DST boundaries in IANA zones.
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let i = 0; i < 2; i += 1) {
    const offsetMinutes = getOffsetMinutes(new Date(utcMs), timeZone);
    const adjustedUtcMs =
      Date.UTC(year, month - 1, day, hour, minute, 0, 0) - offsetMinutes * 60_000;
    if (adjustedUtcMs === utcMs) break;
    utcMs = adjustedUtcMs;
  }

  const parsed = new Date(utcMs);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Combine a separate date (YYYY-MM-DD) and optional time (HH:mm) that were
 * entered in `timeZone` and resolve them to an absolute UTC `Date`.
 *
 * Unlike `new Date(\`${date}T${time}:00\`)`, this does not depend on the
 * server's local timezone: the wall-clock value is always interpreted in the
 * supplied IANA `timeZone`, so an organizer who enters 11:00 in Europe/Berlin
 * is stored as 09:00Z (summer) rather than shifting with the host machine.
 */
export function parseEventDateTimeInTimeZone(
  date: string | null | undefined,
  time: string | null | undefined,
  timeZone: string,
): Date | null {
  const trimmedDate = date?.trim();
  if (!trimmedDate) return null;
  const trimmedTime = time?.trim() || '00:00';
  return parseDateTimeLocalInTimeZone(`${trimmedDate}T${trimmedTime}`, timeZone);
}

export function formatDateTimeLocalInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');

  if (!year || !month || !day || !hour || !minute) return '';
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

// ---------------------------------------------------------------------------
// User-facing display formatters
//
// Always pass a timezone (typically city.timezone) so the rendered time
// matches the event's intended wall-clock time, not the server/browser
// local timezone.  Never use date-fns format() or toLocaleString() directly
// on event dates — they apply the host machine's local timezone.
// ---------------------------------------------------------------------------

/**
 * Returns a time string like "11:00 AM". Use for event start/end times.
 */
export function formatEventTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Returns a long date string like "Monday, June 22, 2026".
 * Use for the event detail page date heading.
 */
export function formatEventDateLong(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Returns a short date string like "22 Jun 2026".
 * Use for compact date columns and metadata where time is omitted.
 */
export function formatEventDateShort(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Returns a medium date+time string like "Mon, 22 Jun 2026, 11:00 AM".
 * Use for organizer/admin detail views that show both date and time.
 */
export function formatEventDateTimeMedium(date: Date, timeZone: string): string {
  const datePart = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
  return `${datePart}, ${formatEventTime(date, timeZone)}`;
}

/**
 * Returns a smart event-card date label in the given timezone. Examples:
 *   "Today · 11:00 AM"  /  "Tomorrow · 11:00 AM"  /
 *   "Monday · 11:00 AM"  /  "Mon, Jun 22 · 11:00 AM"
 */
export function formatEventCardDate(date: Date, timeZone: string): string {
  const timeStr = formatEventTime(date, timeZone);
  const now = new Date();

  // YYYY-MM-DD string in the target timezone — used for today/tomorrow checks.
  const toDateStr = (d: Date): string =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);

  const eventDateStr = toDateStr(date);
  const todayStr = toDateStr(now);

  // Advance a YYYY-MM-DD string by `days` calendar days using JS overflow arithmetic.
  // This is DST-safe because we work with calendar components, not millisecond offsets.
  const advanceDateStr = (s: string, days: number): string => {
    const [y, mo, dy] = s.split('-').map(Number);
    const next = new Date(y, mo - 1, dy + days);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
  };

  const tomorrowStr = advanceDateStr(todayStr, 1);
  const sevenDaysStr = advanceDateStr(todayStr, 7);

  if (eventDateStr === todayStr) return `Today · ${timeStr}`;
  if (eventDateStr === tomorrowStr) return `Tomorrow · ${timeStr}`;

  // Check if within the next 7 calendar days using timezone-aware date strings.
  if (eventDateStr > todayStr && eventDateStr <= sevenDaysStr) {
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(date);
    return `${weekday} · ${timeStr}`;
  }

  const shortDate = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
  return `${shortDate} · ${timeStr}`;
}
