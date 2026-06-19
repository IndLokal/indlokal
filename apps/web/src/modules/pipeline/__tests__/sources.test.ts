import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchTextWithFallbackMock = vi.fn();
const fetchEmbeddedGoogleCalendarEventsMock = vi.fn(async () => ({ items: [], errors: [] }));

vi.mock('../fetch/http', () => ({
  PIPELINE_USER_AGENT: 'IndLokal-ContentBot/1.0 (+https://indlokal.de)',
  fetchTextWithFallback: fetchTextWithFallbackMock,
}));

vi.mock('../fetch/calendar', () => ({
  fetchEmbeddedGoogleCalendarEvents: fetchEmbeddedGoogleCalendarEventsMock,
}));

describe('fetchPinnedUrl', () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.PIPELINE_PINNED_LINK_EXPANSION;
    delete process.env.PIPELINE_PINNED_EXPANSION_SOURCE_TYPES;
    delete process.env.PIPELINE_PINNED_SECOND_HOP;
    delete process.env.PIPELINE_PINNED_SECOND_HOP_LIMIT;
  });

  it('expands internal event links for DB community pages', async () => {
    const { fetchPinnedUrl } = await import('../fetch/sources');

    fetchTextWithFallbackMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/events/') || url.endsWith('/events')) {
        return {
          ok: true,
          status: 200,
          text: '<html><body><a href="/fiesta-international-2026/">Read More</a></body></html>',
        };
      }

      return {
        ok: true,
        status: 200,
        text: '<html><body><a href="/events/">Events</a></body></html>',
      };
    });

    const result = await fetchPinnedUrl(
      {
        id: 'db-icf',
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: 'ICF',
        url: 'https://indiacultureforum.de/',
        enabled: true,
      },
      'cli',
    );

    expect(result.errors).toEqual([]);
    expect(result.items.map((item) => item.sourceUrl)).toEqual([
      'https://indiacultureforum.de/',
      'https://indiacultureforum.de/events/',
    ]);
  });
});
