import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';

const runId = Date.now().toString(36);
const calendarId = `mmstuttgart-${runId}@example.com`;
const encodedCalendarId = encodeURIComponent(calendarId);
const testCitySlug = `stuttgart-calendar-${runId}`;
const testCityName = `Stuttgart Calendar ${runId}`;

vi.mock('../runtime-config', () => ({
  getRuntimeEnabledRegions: vi.fn(async () => [
    {
      id: 'bw',
      label: 'Baden-Wuerttemberg',
      searchCenter: 'Stuttgart, Germany',
      citySlugs: [testCitySlug],
      enabled: true,
    },
  ]),
}));

vi.mock('../source-plan', () => ({
  buildPipelineSourcePlan: vi.fn(async () => ({
    notes: [],
    keywordStrategies: [],
    pinnedStrategies: [
      {
        id: 'known-mm',
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: 'MMS Stuttgart',
        url: 'https://www.mmstuttgart.de/',
        hintCitySlug: testCitySlug,
        enabled: true,
      },
    ],
    staticPinnedCount: 0,
    dbPinnedCount: 1,
    totalDbPinnedCount: 1,
  })),
}));

vi.mock('../extraction', () => ({
  resetLlmStats: vi.fn(),
  getLlmStats: vi.fn(() => ({ calls: 0, tokensEstimate: 0 })),
  filterRelevance: vi.fn(async (items: Array<unknown>) =>
    items.map((_, index) => ({ index, isRelevant: true, reason: 'calendar-relevant' })),
  ),
  extractBatch: vi.fn(async (items: Array<{ sourceUrl: string }>) => {
    const extracted: Array<Record<string, unknown>> = [];

    items.forEach((item, index) => {
      if (!item.sourceUrl.includes('#uid=')) return;
      extracted.push({
        type: 'EVENT',
        title: 'FoFe 2026',
        description: 'Annual gathering',
        date: '2026-06-27',
        time: null,
        endDate: '2026-06-27',
        endTime: null,
        venueName: 'AWO Seniorenzentrum Fasanenhof',
        venueAddress: 'Solferinoweg 7, 70565 Stuttgart, Germany',
        cityName: testCityName,
        isOnline: false,
        isFree: true,
        cost: null,
        registrationUrl: null,
        imageUrl: null,
        hostCommunity: 'Maharashtra Mandal Stuttgart',
        categories: [],
        languages: ['Marathi'],
        confidence: 0.96,
        fieldConfidence: { title: 0.99, date: 0.99 },
        sourceIndex: index,
      });
    });

    return extracted;
  }),
}));

const homepageHtml = `
  <html>
    <body>
      <iframe src="https://calendar.google.com/calendar/embed?src=${encodedCalendarId}&src=de.german%23holiday%40group.v.calendar.google.com"></iframe>
    </body>
  </html>
`;

const icsBody = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:fofe-2026@google.com',
  'SUMMARY:FoFe 2026',
  'DTSTART;VALUE=DATE:20260627',
  'DTEND;VALUE=DATE:20260628',
  'LOCATION:AWO Seniorenzentrum Fasanenhof, Solferinoweg 7, 70565 Stuttgart, Germany',
  'DESCRIPTION:Annual gathering',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\n');

describe('@db pipeline calendar ingestion integration', () => {
  beforeEach(async () => {
    await db.pipelineItem.deleteMany({
      where: { sourceUrl: { contains: `/calendar/ical/${encodedCalendarId}/public/basic.ics` } },
    });
    await db.city.deleteMany({ where: { slug: testCitySlug } });

    await db.city.create({
      data: {
        name: testCityName,
        slug: testCitySlug,
        state: 'Baden-Wuerttemberg',
        country: 'Germany',
        isActive: true,
        isMetroPrimary: true,
      },
    });

    vi.spyOn(global, 'fetch').mockImplementation(async (input: string | URL | Request) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url === 'https://www.mmstuttgart.de/') {
        return new Response(homepageHtml, {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }

      if (url.includes(`/calendar/ical/${encodedCalendarId}/public/basic.ics`)) {
        return new Response(icsBody, {
          status: 200,
          headers: { 'content-type': 'text/calendar; charset=utf-8' },
        });
      }

      return new Response('not-found', { status: 404 });
    });
  });

  afterAll(async () => {
    await db.pipelineItem.deleteMany({
      where: { sourceUrl: { contains: `/calendar/ical/${encodedCalendarId}/public/basic.ics` } },
    });
    await db.city.deleteMany({ where: { slug: testCitySlug } });
    vi.restoreAllMocks();
    await db.$disconnect();
  });

  it('creates a pending pipeline event item from known community embedded calendar feed', async () => {
    const { runPipeline } = await import('../orchestrator');
    const result = await runPipeline('test-calendar-sync');

    expect(result.itemsQueued).toBe(1);

    const queued = await db.pipelineItem.findMany({
      where: {
        status: 'PENDING',
        entityType: 'EVENT',
        sourceUrl: { contains: `/calendar/ical/${encodedCalendarId}/public/basic.ics` },
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(queued).toHaveLength(1);
    expect(queued[0]?.sourceUrl).toContain(
      `/calendar/ical/${encodedCalendarId}/public/basic.ics#uid=`,
    );

    const extracted = queued[0]?.extractedData as Record<string, unknown>;
    expect(extracted.type).toBe('EVENT');
    expect(extracted.title).toBe('FoFe 2026');
    expect(extracted.cityName).toBe(testCityName);
  });
});
