import { describe, expect, it } from 'vitest';
import {
  MAX_IMPORT_PAYLOAD_BYTES,
  MAX_IMPORT_ROWS,
  parseImportPayload,
  validateImportEnvelope,
} from '../parsing';

describe('admin import payload parsing', () => {
  it('parses json envelope with resource and rows', () => {
    const payload = JSON.stringify({
      resource: 'community',
      rows: [{ slug: 'berlin-tamil-sangam', citySlug: 'berlin' }],
    });

    const parsed = parseImportPayload(payload);

    expect(parsed.payloadResource).toBe('community');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({ slug: 'berlin-tamil-sangam' });
  });

  it('parses csv with quoted commas and coerces scalar values', () => {
    const csv = [
      'name,slug,isActive,population,meta',
      '"Berlin, Mitte",berlin-mitte,true,1000,"{""priority"":1}"',
    ].join('\n');

    const parsed = parseImportPayload(csv);
    const first = parsed.rows[0] as Record<string, unknown>;

    expect(parsed.payloadResource).toBe('');
    expect(first.name).toBe('Berlin, Mitte');
    expect(first.slug).toBe('berlin-mitte');
    expect(first.isActive).toBe(true);
    expect(first.population).toBe(1000);
    expect(first.meta).toEqual({ priority: 1 });
  });

  it('parses csv with multiline quoted fields', () => {
    const csv = [
      'name,slug,description',
      '"Berlin Tamil Sangam",berlin-tamil-sangam,"Line 1',
      'Line 2"',
    ].join('\n');

    const parsed = parseImportPayload(csv);
    const first = parsed.rows[0] as Record<string, unknown>;

    expect(first.description).toBe('Line 1\nLine 2');
  });
});

describe('admin import envelope validation', () => {
  it('throws when selected resource mismatches payload resource', () => {
    expect(() =>
      validateImportEnvelope({
        selectedResource: 'city',
        payloadResource: 'community',
        payloadText: '{"resource":"community","rows":[]}',
        rowCount: 0,
      }),
    ).toThrow('does not match selected resource');
  });

  it('throws when row count exceeds limit', () => {
    expect(() =>
      validateImportEnvelope({
        selectedResource: 'city',
        payloadResource: '',
        payloadText: 'name,slug\nBerlin,berlin',
        rowCount: MAX_IMPORT_ROWS + 1,
      }),
    ).toThrow('Too many rows');
  });

  it('throws when payload bytes exceed limit', () => {
    const oversized = 'x'.repeat(MAX_IMPORT_PAYLOAD_BYTES + 1);

    expect(() =>
      validateImportEnvelope({
        selectedResource: 'city',
        payloadResource: '',
        payloadText: oversized,
        rowCount: 1,
      }),
    ).toThrow('Payload too large');
  });
});
