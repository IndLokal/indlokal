import { describe, expect, it } from 'vitest';
import {
  buildGoogleCalendarIcsUrl,
  extractGoogleCalendarIdsFromHtml,
  isHolidayCalendarId,
  parseGoogleCalendarIcsEvents,
} from '../calendar';

describe('embedded calendar helpers', () => {
  it('extracts Google Calendar IDs from iframe embeds', () => {
    const html = `
      <div>
        <iframe src="https://calendar.google.com/calendar/embed?src=ev.mmstuttgart%40gmail.com&src=de.german%23holiday%40group.v.calendar.google.com"></iframe>
      </div>
    `;

    expect(extractGoogleCalendarIdsFromHtml(html)).toEqual([
      'ev.mmstuttgart@gmail.com',
      'de.german#holiday@group.v.calendar.google.com',
    ]);
  });

  it('detects holiday calendar IDs', () => {
    expect(isHolidayCalendarId('de.german#holiday@group.v.calendar.google.com')).toBe(true);
    expect(isHolidayCalendarId('ev.mmstuttgart@gmail.com')).toBe(false);
  });

  it('builds the canonical Google Calendar ICS URL', () => {
    expect(buildGoogleCalendarIcsUrl('ev.mmstuttgart@gmail.com')).toBe(
      'https://calendar.google.com/calendar/ical/ev.mmstuttgart%40gmail.com/public/basic.ics',
    );
  });

  it('parses ICS VEVENT blocks into structured events', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:foo-1@google.com',
      'SUMMARY:FoFe 2026',
      'DTSTART;VALUE=DATE:20260627',
      'DTEND;VALUE=DATE:20260628',
      'LOCATION:Stuttgart',
      'DESCRIPTION:Annual gathering',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:foo-2@google.com',
      'SUMMARY:Zoom Info Session',
      'DTSTART:20260601T170000Z',
      'DTEND:20260601T183000Z',
      'URL:https://example.org/register',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');

    const parsed = parseGoogleCalendarIcsEvents(ics);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      uid: 'foo-1@google.com',
      title: 'FoFe 2026',
      location: 'Stuttgart',
      startsAt: { date: '2026-06-27', time: null, isAllDay: true },
    });
    expect(parsed[1]).toMatchObject({
      uid: 'foo-2@google.com',
      title: 'Zoom Info Session',
      registrationUrl: 'https://example.org/register',
      startsAt: { date: '2026-06-01', time: '17:00', isAllDay: false },
    });
  });
});
