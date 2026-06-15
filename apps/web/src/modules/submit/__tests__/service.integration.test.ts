/**
 * Integration tests - community submission evidence classification (PRD/TDD-0055).
 *
 * @db - requires test database.
 * Prerequisites: `./dev.sh test:setup`
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { testDb, cleanDb } from '@/test/db-helpers';
import { createCity } from '@/test/fixtures';
import type { submit as s } from '@indlokal/shared';

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  return { ...mod, db: testDb };
});

import { createCommunitySubmission } from '../index';

beforeEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await testDb.$disconnect();
});

type EvidenceMeta = {
  sourceEvidence?: { quality?: string };
  needsReview?: boolean;
};

function submission(channelUrl: string, channelType: string): s.CommunitySubmission {
  return {
    name: 'Evidence Test Org',
    description: 'A community used to exercise intake evidence classification.',
    citySlug: 'stuttgart',
    categories: ['community'],
    languages: [],
    channels: [{ channelType, url: channelUrl, isPrimary: true }],
    contactEmail: 'tester@example.com',
    contactName: 'Tester',
  } as s.CommunitySubmission;
}

describe('createCommunitySubmission evidence classification (PRD/TDD-0055)', () => {
  it('persists verified_candidate evidence for a strong registry channel', async () => {
    await createCity(testDb);
    const item = await createCommunitySubmission(
      'user-1',
      submission('https://www.handelsregister.de/rp_web/welcome.do', 'WEBSITE'),
    );

    const row = await testDb.pipelineItem.findUnique({ where: { id: item.id } });
    const meta = row?.metadata as EvidenceMeta | null;
    expect(meta?.sourceEvidence?.quality).toBe('verified_candidate');
  });

  it('flags weak-only channels (social profile) for manual review', async () => {
    await createCity(testDb);
    const item = await createCommunitySubmission(
      'user-1',
      submission('https://www.instagram.com/insta_only_community', 'INSTAGRAM'),
    );

    const row = await testDb.pipelineItem.findUnique({ where: { id: item.id } });
    const meta = row?.metadata as EvidenceMeta | null;
    expect(meta?.sourceEvidence?.quality).toBe('source_supported');
    expect(meta?.needsReview).toBe(true);
  });
});
