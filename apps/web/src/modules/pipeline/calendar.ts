import { db } from '@/lib/db';
import { PIPELINE_USER_AGENT } from './http';
import { decodeHtmlEntities } from './text';
import type { ExtractedEvent, RawContent } from './types';

type IcsParsedDate = {
  date: string;
  time: string | null;
  isAllDay: boolean;
};

type IcsEvent = {
  uid: string;
  title: string;
  description: string | null;
  location: string | null;
  registrationUrl: string | null;
  startsAt: IcsParsedDate | null;
  endsAt: IcsParsedDate | null;
};

export function isHolidayCalendarId(calendarId: string): boolean {
  const normalized = calendarId.trim().toLowerCase();
  return normalized.includes('holiday@group.v.calendar.google.com');
}

export function buildGoogleCalendarIcsUrl(calendarId: string): string {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
}

function decodeEmbeddedGoogleCalendarId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('@')) return trimmed;
  if (!/^[A-Za-z0-9+/_=-]+$/.test(trimmed)) return trimmed;

  try {
    const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(normalized, 'base64').toString('utf8').trim();
    return decoded.includes('@') ? decoded : trimmed;
  } catch {
    return trimmed;
  }
}

export function extractGoogleCalendarIdsFromHtml(html: string): string[] {
  const iframePattern = /<iframe\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)')[^>]*>/gi;
  const calendarIds = new Set<string>();

  for (const match of html.matchAll(iframePattern)) {
    const rawSrc = decodeHtmlEntities((match[1] ?? match[2] ?? '').trim());
    if (!rawSrc) continue;

    let srcUrl: URL;
    try {
      srcUrl = rawSrc.startsWith('//') ? new URL(`https:${rawSrc}`) : new URL(rawSrc);
    } catch {
      continue;
    }

    const host = srcUrl.hostname.toLowerCase();
    if (host !== 'calendar.google.com') continue;
    if (!srcUrl.pathname.includes('/calendar/embed')) continue;

    for (const value of srcUrl.searchParams.getAll('src')) {
      const trimmed = decodeEmbeddedGoogleCalendarId(value);
      if (trimmed) calendarIds.add(trimmed);
    }
  }

  return [...calendarIds];
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function unfoldIcsLines(ics: string): string[] {
  const rawLines = ics.split(/\r?\n/);
  const lines: string[] = [];

  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
      continue;
    }
    lines.push(line);
  }

  return lines;
}

function parseIcsDate(value: string, valueType: string | null): IcsParsedDate | null {
  const raw = value.trim();
  const type = (valueType ?? '').toUpperCase();

  if (type === 'DATE' || /^\d{8}$/.test(raw)) {
    return {
      date: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
      time: null,
      isAllDay: true,
    };
  }

  const compact = raw.endsWith('Z') ? raw.slice(0, -1) : raw;
  if (!/^\d{8}T\d{6}$/.test(compact)) return null;

  return {
    date: `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`,
    time: `${compact.slice(9, 11)}:${compact.slice(11, 13)}`,
    isAllDay: false,
  };
}

export function parseGoogleCalendarIcsEvents(ics: string): IcsEvent[] {
  const lines = unfoldIcsLines(ics);
  const events: IcsEvent[] = [];

  let inEvent = false;
  let uid = '';
  let title = '';
  let description: string | null = null;
  let location: string | null = null;
  let registrationUrl: string | null = null;
  let startsAt: IcsParsedDate | null = null;
  let endsAt: IcsParsedDate | null = null;

  const reset = () => {
    uid = '';
    title = '';
    description = null;
    location = null;
    registrationUrl = null;
    startsAt = null;
    endsAt = null;
  };

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      reset();
      continue;
    }

    if (line === 'END:VEVENT') {
      if (inEvent && title && startsAt) {
        events.push({
          uid: uid || `${title}:${startsAt.date}:${startsAt.time ?? 'all-day'}`,
          title,
          description,
          location,
          registrationUrl,
          startsAt,
          endsAt,
        });
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) continue;

    const delimiter = line.indexOf(':');
    if (delimiter === -1) continue;

    const rawKey = line.slice(0, delimiter);
    const value = unescapeIcsText(line.slice(delimiter + 1));
    if (!value) continue;

    const [name, ...paramPairs] = rawKey.split(';');
    const key = name.toUpperCase();
    const params = new Map<string, string>();
    for (const pair of paramPairs) {
      const [paramName, ...rest] = pair.split('=');
      if (!paramName || rest.length === 0) continue;
      params.set(paramName.toUpperCase(), rest.join('='));
    }

    if (key === 'UID') {
      uid = value;
    } else if (key === 'SUMMARY') {
      title = value;
    } else if (key === 'DESCRIPTION') {
      description = value;
    } else if (key === 'LOCATION') {
      location = value;
    } else if (key === 'URL') {
      registrationUrl = value;
    } else if (key === 'DTSTART') {
      startsAt = parseIcsDate(value, params.get('VALUE') ?? null);
    } else if (key === 'DTEND') {
      endsAt = parseIcsDate(value, params.get('VALUE') ?? null);
    }
  }

  return events;
}

function getCalendarSyncCadence(): 'monthly' | 'always' {
  const raw = (process.env.PIPELINE_CALENDAR_SYNC_CADENCE ?? 'monthly').trim().toLowerCase();
  return raw === 'always' ? 'always' : 'monthly';
}

function shouldApplyMonthlyCalendarFeedGate(triggeredBy: string): boolean {
  return getCalendarSyncCadence() === 'monthly' && triggeredBy === 'cron';
}

async function hasCalendarFeedSyncedThisMonth(
  sourceType: RawContent['sourceType'],
  feedUrl: string,
  triggeredBy: string,
): Promise<boolean> {
  if (!shouldApplyMonthlyCalendarFeedGate(triggeredBy)) return false;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const prefix = `${feedUrl}#uid=`;

  const count = await db.pipelineItem.count({
    where: {
      sourceType,
      sourceUrl: { startsWith: prefix },
      createdAt: { gte: monthStart },
    },
  });

  return count > 0;
}

function toCalendarEventRawContent(
  sourceType: RawContent['sourceType'],
  feedUrl: string,
  calendarId: string,
  event: IcsEvent,
): RawContent {
  const lines = [
    `Calendar ID: ${calendarId}`,
    `Event UID: ${event.uid}`,
    `Title: ${event.title}`,
    `Date: ${event.startsAt?.date ?? ''}`,
    event.startsAt?.time ? `Time: ${event.startsAt.time}` : 'All-day: yes',
    event.endsAt?.date ? `End Date: ${event.endsAt.date}` : '',
    event.endsAt?.time ? `End Time: ${event.endsAt.time}` : '',
    event.location ? `Venue: ${event.location}` : '',
    event.description ? `Description: ${event.description}` : '',
    event.registrationUrl ? `Registration URL: ${event.registrationUrl}` : '',
    `Source feed: ${feedUrl}`,
  ].filter(Boolean);

  return {
    sourceType,
    sourceUrl: `${feedUrl}#uid=${encodeURIComponent(event.uid)}`,
    text: lines.join('\n'),
    fetchedAt: new Date().toISOString(),
  };
}

export function isEmbeddedCalendarEventRawContent(
  item: Pick<RawContent, 'sourceUrl' | 'text'>,
): boolean {
  return (
    item.sourceUrl.includes('/calendar/ical/') &&
    item.sourceUrl.includes('#uid=') &&
    item.text.includes('Event UID:')
  );
}

function getCalendarRawField(text: string, label: string): string | null {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`^${escapedLabel}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim() || null;
}

export function extractCalendarEventFromRawContent(item: RawContent): ExtractedEvent | null {
  if (!isEmbeddedCalendarEventRawContent(item)) return null;

  const title = getCalendarRawField(item.text, 'Title');
  const date = getCalendarRawField(item.text, 'Date');
  const time = getCalendarRawField(item.text, 'Time');
  const endDate = getCalendarRawField(item.text, 'End Date');
  const endTime = getCalendarRawField(item.text, 'End Time');
  const venue = getCalendarRawField(item.text, 'Venue');
  const description = getCalendarRawField(item.text, 'Description');
  const registrationUrl = getCalendarRawField(item.text, 'Registration URL');

  if (!title || !date) return null;

  return {
    type: 'EVENT',
    title,
    description,
    date,
    time,
    endDate,
    endTime,
    venueName: venue,
    venueAddress: venue,
    cityName: null,
    isOnline: false,
    isFree: null,
    cost: null,
    registrationUrl,
    imageUrl: null,
    hostCommunity: null,
    categories: [],
    languages: [],
    confidence: 0.99,
    fieldConfidence: {
      title: 0.99,
      date: 0.99,
      ...(time ? { time: 0.98 } : {}),
      ...(venue ? { venue: 0.95 } : {}),
    },
  };
}

export async function fetchEmbeddedGoogleCalendarEvents(
  sourceType: RawContent['sourceType'],
  rawHtml: string,
  triggeredBy = 'cron',
): Promise<{ items: RawContent[]; errors: string[] }> {
  const items: RawContent[] = [];
  const errors: string[] = [];

  const calendarIds = extractGoogleCalendarIdsFromHtml(rawHtml).filter(
    (calendarId) => !isHolidayCalendarId(calendarId),
  );

  if (calendarIds.length === 0) {
    return { items, errors };
  }

  for (const calendarId of calendarIds) {
    const feedUrl = buildGoogleCalendarIcsUrl(calendarId);

    try {
      const alreadySynced = await hasCalendarFeedSyncedThisMonth(sourceType, feedUrl, triggeredBy);
      if (alreadySynced) continue;

      const feedRes = await fetch(feedUrl, {
        headers: { 'User-Agent': PIPELINE_USER_AGENT },
        signal: AbortSignal.timeout(15_000),
      });

      if (!feedRes.ok) {
        errors.push(`Calendar feed ${feedUrl}: HTTP ${feedRes.status}`);
        continue;
      }

      const ics = await feedRes.text();
      const events = parseGoogleCalendarIcsEvents(ics);
      for (const event of events) {
        items.push(toCalendarEventRawContent(sourceType, feedUrl, calendarId, event));
      }
    } catch (error) {
      errors.push(`Calendar feed ${feedUrl}: ${String(error)}`);
    }
  }

  return { items, errors };
}
