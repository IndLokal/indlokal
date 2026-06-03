const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

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
