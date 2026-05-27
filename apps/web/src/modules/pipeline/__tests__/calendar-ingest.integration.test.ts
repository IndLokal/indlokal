import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';

const runId = Date.now().toString(36);
const calendarId = `mmstuttgart-${runId}@example.com`;
const embeddedCalendarId = Buffer.from(calendarId).toString('base64');
const encodedCalendarId = encodeURIComponent(calendarId);
const embeddedHolidayCalendarId = Buffer.from(
  'de.german#holiday@group.v.calendar.google.com',
).toString('base64');
const testCitySlug = `stuttgart-calendar-${runId}`;
const testCityName = `Stuttgart Calendar ${runId}`;
let extractionMode: 'calendar-event' | 'duplicate-community' = 'calendar-event';
let hasPipelineItemsTable = true;

async function detectPipelineItemsTable() {
  const result = (await db.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'pipeline_items'
    ) AS "exists"
  `) as Array<{ exists: boolean }>;

  return Boolean(result[0]?.exists);
}

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
  extractBatch: vi.fn(async (items: Array<{ sourceUrl: string; text: string }>) => {
    if (extractionMode === 'duplicate-community') {
      return [0, 1].map((index) => ({
        type: 'COMMUNITY',
        name: index === 0 ? 'Maharashtra Mandal Stuttgart e.V.' : 'Maharashtra Mandal Stuttgart',
        description: 'Marathi cultural association in Stuttgart',
        cityName: testCityName,
        categories: ['cultural-association'],
        languages: ['Marathi'],
        websiteUrl: 'https://www.mmstuttgart.de/',
        facebookUrl: null,
        instagramUrl: null,
        whatsappUrl: null,
        telegramUrl: null,
        contactEmail: null,
        confidence: 0.94,
        fieldConfidence: { name: 0.99, description: 0.9 },
        sourceIndex: index,
      }));
    }

    const extracted: Array<Record<string, unknown>> = [];

    items.forEach((item, index) => {
      if (!item.sourceUrl.includes('#uid=')) return;
      const title = item.text.match(/^Title:\s*(.+)$/m)?.[1] ?? 'Calendar event';
      const date = item.text.match(/^Date:\s*(.+)$/m)?.[1] ?? '2026-06-27';
      const venue = item.text.match(/^Venue:\s*(.+)$/m)?.[1] ?? 'Stuttgart';

      extracted.push({
        type: 'EVENT',
        title,
        description: 'Calendar event',
        date,
        time: null,
        endDate: date,
        endTime: null,
        venueName: venue,
        venueAddress: venue,
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
      <iframe src="https://calendar.google.com/calendar/embed?src=${embeddedCalendarId}&src=${embeddedHolidayCalendarId}"></iframe>
    </body>
  </html>
`;

function buildIcsEvent(params: {
  uid: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
}) {
  return [
    'BEGIN:VEVENT',
    `UID:${params.uid}`,
    `SUMMARY:${params.summary}`,
    `DTSTART;VALUE=DATE:${params.start}`,
    `DTEND;VALUE=DATE:${params.end}`,
    params.location ? `LOCATION:${params.location}` : '',
    params.description ? `DESCRIPTION:${params.description}` : '',
    'END:VEVENT',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildIcsCalendar(events: string[]) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\n');
}

async function listQueuedCalendarEventTitles() {
  const queued = await db.pipelineItem.findMany({
    where: {
      status: 'PENDING',
      entityType: 'EVENT',
      sourceUrl: { contains: `/calendar/ical/${encodedCalendarId}/public/basic.ics` },
    },
    orderBy: { createdAt: 'asc' },
  });

  return queued.map((item) => {
    const extracted = item.extractedData as Record<string, unknown>;
    return String(extracted.title);
  });
}

const juneEventIcs = buildIcsCalendar([
  buildIcsEvent({
    uid: 'fofe-2026@google.com',
    summary: 'FoFe 2026',
    start: '20260627',
    end: '20260628',
    location: 'AWO Seniorenzentrum Fasanenhof, Solferinoweg 7, 70565 Stuttgart, Germany',
    description: 'Annual gathering',
  }),
]);

const julyEventIcs = buildIcsEvent({
  uid: 'sofe-2026@google.com',
  summary: 'Sommerfest (SoFe)',
  start: '20260718',
  end: '20260720',
  location: 'Stuttgart',
  description: 'Summer gathering',
});

const autumnEventsIcs = [
  buildIcsEvent({
    uid: 'ganeshotsav-2026@google.com',
    summary: 'MMS-Ganeshotsav',
    start: '20260926',
    end: '20260927',
    location: 'Stuttgart',
    description: 'Ganesh festival celebration',
  }),
  buildIcsEvent({
    uid: 'bhondla-2026@google.com',
    summary: 'Bhondla',
    start: '20261017',
    end: '20261018',
    location: 'Stuttgart',
    description: 'Bhondla event',
  }),
  buildIcsEvent({
    uid: 'diwali-2026@google.com',
    summary: 'MMS-Diwali (Tentative)',
    start: '20261107',
    end: '20261108',
    location: 'Stuttgart',
    description: 'Diwali celebration',
  }),
].join('\n');

let icsBody = juneEventIcs;

describe('@db pipeline calendar ingestion integration', () => {
  beforeEach(async (ctx) => {
    hasPipelineItemsTable = await detectPipelineItemsTable();
    if (!hasPipelineItemsTable) {
      ctx.skip();
    }
  });

  beforeEach(async () => {
    extractionMode = 'calendar-event';
    icsBody = juneEventIcs;
    vi.restoreAllMocks();
    await db.pipelineItem.deleteMany({
      where: {
        OR: [
          { sourceUrl: { contains: `/calendar/ical/${encodedCalendarId}/public/basic.ics` } },
          { sourceUrl: 'https://www.mmstuttgart.de/' },
        ],
      },
    });
    await db.city.upsert({
      where: { slug: testCitySlug },
      update: {
        name: testCityName,
        state: 'Baden-Wuerttemberg',
        country: 'Germany',
        isActive: true,
        isMetroPrimary: true,
      },
      create: {
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
    if (!hasPipelineItemsTable) {
      vi.restoreAllMocks();
      await db.$disconnect();
      return;
    }

    await db.pipelineItem.deleteMany({
      where: { sourceUrl: { contains: `/calendar/ical/${encodedCalendarId}/public/basic.ics` } },
    });
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

  it('allows admin reruns to pick newly added future events from the same calendar feed in the same month', async () => {
    const { runPipeline } = await import('../orchestrator');

    const firstResult = await runPipeline('cron');
    expect(firstResult.itemsQueued).toBe(1);

    icsBody = [juneEventIcs.replace('\nEND:VCALENDAR', ''), julyEventIcs, 'END:VCALENDAR'].join(
      '\n',
    );

    const secondResult = await runPipeline('admin');
    expect(secondResult.itemsQueued).toBe(1);

    expect(await listQueuedCalendarEventTitles()).toEqual(['FoFe 2026', 'Sommerfest (SoFe)']);
  });

  it('queues all future calendar events from one feed deterministically without relying on LLM extraction', async () => {
    const { runPipeline } = await import('../orchestrator');

    icsBody = buildIcsCalendar([
      buildIcsEvent({
        // Prior-year event: pipeline drops events from before the running
        // calendar year (events earlier in the current year are still queued).
        uid: 'students-meet-2025@google.com',
        summary: "Students' Meet",
        start: '20250510',
        end: '20250511',
        location: 'Stuttgart',
        description: 'Students gathering',
      }),
      buildIcsEvent({
        uid: 'fofe-2026@google.com',
        summary: 'FoFe 2026',
        start: '20260627',
        end: '20260628',
        location: 'Stuttgart',
        description: 'Annual gathering',
      }),
      julyEventIcs,
      autumnEventsIcs,
    ]);

    const result = await runPipeline('admin');
    expect(result.itemsQueued).toBe(5);
    expect(result.itemsSkippedPast).toBe(1);

    expect(await listQueuedCalendarEventTitles()).toEqual([
      'FoFe 2026',
      'Sommerfest (SoFe)',
      'MMS-Ganeshotsav',
      'Bhondla',
      'MMS-Diwali (Tentative)',
    ]);
  });

  it('does not queue duplicate community entries within the same run', async () => {
    extractionMode = 'duplicate-community';
    icsBody = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'END:VCALENDAR'].join('\n');
    const { runPipeline } = await import('../orchestrator');
    const result = await runPipeline('test-community-dedup');

    expect(result.itemsQueued).toBe(1);

    const city = await db.city.findUniqueOrThrow({
      where: { slug: testCitySlug },
      select: { id: true },
    });

    const queuedCommunities = await db.pipelineItem.findMany({
      where: {
        cityId: city.id,
        entityType: 'COMMUNITY',
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    expect(queuedCommunities).toHaveLength(1);
  });
});
