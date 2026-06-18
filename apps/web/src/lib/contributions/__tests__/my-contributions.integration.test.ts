/**
 * Integration tests - contribution attribution & "My Contributions" (PRD/TDD-0060).
 *
 * @db - requires test database.
 * Prerequisites: `./dev.sh test:setup`
 *
 * Verifies the attribution invariants:
 *  - submitCommunity binds createdByUserId to the SESSION user (never the typed
 *    contact email) and creates NO ghost user from the contact email;
 *  - anonymous submit leaves createdByUserId null but still succeeds;
 *  - suggestCommunity attributes reporterUserId to the session user;
 *  - getMyContributions unions submissions + suggestions, scoped to the user.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { testDb, cleanDb } from '@/test/db-helpers';
import { createCity, createUser } from '@/test/fixtures';

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  return { ...mod, db: testDb };
});

let currentSession: { id: string; email?: string; displayName?: string } | null = null;
vi.mock('@/lib/session', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/session')>();
  return { ...mod, getSessionUser: async () => currentSession };
});

vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', '203.0.113.10']]),
}));
vi.mock('@/lib/analytics/server', () => ({ captureServerEvent: vi.fn() }));
vi.mock('@/lib/email', () => ({ sendSubmissionReceivedEmail: vi.fn() }));

import { submitCommunity } from '@/app/submit/actions';
import { suggestCommunity } from '@/app/actions/reports';
import { getMyContributions } from '@/lib/contributions/my-contributions';

async function createCategory(slug: string) {
  return testDb.category.create({
    data: { name: slug, slug, type: 'CATEGORY', sortOrder: 1 },
  });
}

function buildCommunityFormData(overrides: {
  name: string;
  citySlug: string;
  categorySlug: string;
  contactEmail: string;
  contactName: string;
}): FormData {
  const fd = new FormData();
  fd.set('name', overrides.name);
  fd.set('description', 'A real community for newcomers in the city.');
  fd.set('citySlug', overrides.citySlug);
  fd.append('categories', overrides.categorySlug);
  fd.set(
    'channelsJson',
    JSON.stringify([
      {
        channelType: 'WEBSITE',
        url: 'https://example.org/community',
        label: 'Site',
        isPrimary: true,
      },
    ]),
  );
  fd.set('relationship', 'JUST_ADDING');
  fd.set('contactEmail', overrides.contactEmail);
  fd.set('contactName', overrides.contactName);
  return fd;
}

beforeEach(async () => {
  await cleanDb();
  currentSession = null;
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe('submitCommunity attribution (PRD/TDD-0060)', () => {
  it('binds createdByUserId to the session user and creates no ghost user from contact email', async () => {
    await createCity(testDb, { slug: 'attr-city-1', name: 'Attr City 1' });
    await createCategory('professional');
    const actor = await createUser(testDb, {
      email: 'actor@account.test',
      displayName: 'Actor',
    });
    currentSession = {
      id: actor.id,
      email: actor.email,
      displayName: actor.displayName ?? undefined,
    };

    const fd = buildCommunityFormData({
      name: 'Newcomers Collective',
      citySlug: 'attr-city-1',
      categorySlug: 'professional',
      // Deliberately DIFFERENT from the signed-in account email.
      contactEmail: 'someone-else@contact.test',
      contactName: 'Contact Person',
    });

    const result = await submitCommunity(null, fd);
    expect(result).toEqual({ success: true, communityName: 'Newcomers Collective' });

    const community = await testDb.community.findFirstOrThrow({
      where: { name: 'Newcomers Collective' },
      select: { createdByUserId: true, source: true, metadata: true },
    });
    expect(community.createdByUserId).toBe(actor.id);
    expect(community.source).toBe('COMMUNITY_SUBMITTED');

    // Contact is session-first: stored contact email is the account email, never
    // the typed contact field (which is ignored for authenticated submitters).
    const metadata = community.metadata as { submitter?: { email?: string } } | null;
    expect(metadata?.submitter?.email).toBe('actor@account.test');
    expect(metadata?.submitter?.email).not.toBe('someone-else@contact.test');

    // No ghost user created from the typed contact email.
    const ghost = await testDb.user.findUnique({
      where: { email: 'someone-else@contact.test' },
    });
    expect(ghost).toBeNull();

    // Exactly one user exists (the actor).
    expect(await testDb.user.count()).toBe(1);
  });

  it('leaves createdByUserId null for anonymous submissions but still succeeds', async () => {
    await createCity(testDb, { slug: 'attr-city-2', name: 'Attr City 2' });
    await createCategory('professional');
    currentSession = null;

    const fd = buildCommunityFormData({
      name: 'Anon Collective',
      citySlug: 'attr-city-2',
      categorySlug: 'professional',
      contactEmail: 'anon@contact.test',
      contactName: 'Anon Person',
    });

    const result = await submitCommunity(null, fd);
    expect(result).toEqual({ success: true, communityName: 'Anon Collective' });

    const community = await testDb.community.findFirstOrThrow({
      where: { name: 'Anon Collective' },
      select: { createdByUserId: true },
    });
    expect(community.createdByUserId).toBeNull();
    expect(await testDb.user.count()).toBe(0);
  });

  it('rejects an anonymous submission with no contact email', async () => {
    await createCity(testDb, { slug: 'attr-city-2b', name: 'Attr City 2b' });
    await createCategory('professional');
    currentSession = null;

    const fd = buildCommunityFormData({
      name: 'No Email Collective',
      citySlug: 'attr-city-2b',
      categorySlug: 'professional',
      contactEmail: '',
      contactName: '',
    });

    const result = await submitCommunity(null, fd);
    expect(result).toMatchObject({ success: false });
    expect(await testDb.community.count()).toBe(0);
  });

  it('allows logged-in submissions when contact fields are omitted', async () => {
    await createCity(testDb, { slug: 'attr-city-2c', name: 'Attr City 2c' });
    await createCategory('professional');
    const actor = await createUser(testDb, {
      email: 'omit-contact@account.test',
      displayName: 'Omit Contact',
    });
    currentSession = {
      id: actor.id,
      email: actor.email,
      displayName: actor.displayName ?? undefined,
    };

    const fd = buildCommunityFormData({
      name: 'No Contact Inputs Collective',
      citySlug: 'attr-city-2c',
      categorySlug: 'professional',
      contactEmail: '',
      contactName: '',
    });
    fd.delete('contactEmail');
    fd.delete('contactName');

    const result = await submitCommunity(null, fd);
    expect(result).toEqual({ success: true, communityName: 'No Contact Inputs Collective' });

    const community = await testDb.community.findFirst({
      where: { name: 'No Contact Inputs Collective' },
      select: { createdByUserId: true, metadata: true },
    });
    expect(community).not.toBeNull();
    expect(community?.createdByUserId).toBe(actor.id);

    const metadata = community?.metadata as { submitter?: { email?: string } } | null;
    expect(metadata?.submitter?.email).toBe('omit-contact@account.test');
  });
});

describe('suggestCommunity attribution (PRD/TDD-0060)', () => {
  it('attributes reporterUserId and pipeline submittedBy to the session user', async () => {
    const city = await createCity(testDb, { slug: 'attr-city-3', name: 'Attr City 3' });
    const actor = await createUser(testDb, { email: 'suggester@account.test' });
    currentSession = { id: actor.id };

    const fd = new FormData();
    fd.set('suggestedName', 'Hidden WhatsApp Group');
    fd.set('citySlug', 'attr-city-3');
    fd.set('details', 'Active but not listed anywhere public.');

    const result = await suggestCommunity(null, fd);
    expect(result).toEqual({ success: true, name: 'Hidden WhatsApp Group' });

    const report = await testDb.contentReport.findFirstOrThrow({
      where: { suggestedName: 'Hidden WhatsApp Group' },
      select: { reporterUserId: true, reportType: true, cityId: true },
    });
    expect(report.reporterUserId).toBe(actor.id);
    expect(report.reportType).toBe('SUGGEST_COMMUNITY');

    const pipelineItem = await testDb.pipelineItem.findFirstOrThrow({
      where: { cityId: city.id, entityType: 'COMMUNITY' },
      select: { submittedBy: true },
    });
    expect(pipelineItem.submittedBy).toBe(actor.id);
  });
});

describe('getMyContributions read model (PRD/TDD-0060)', () => {
  it('unions submissions + suggestions for the user, scoped and ordered newest-first', async () => {
    const city = await createCity(testDb, { slug: 'attr-city-4', name: 'Attr City 4' });
    const actor = await createUser(testDb, { email: 'reader@account.test' });
    const other = await createUser(testDb, { email: 'other@account.test' });

    // A published submitted community by the actor.
    await testDb.community.create({
      data: {
        name: 'Published Submission',
        slug: 'published-submission',
        status: 'ACTIVE',
        claimState: 'UNCLAIMED',
        source: 'COMMUNITY_SUBMITTED',
        createdByUserId: actor.id,
        cityId: city.id,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    });

    // A pending event suggestion by the actor (report + placeholder event).
    const event = await testDb.event.create({
      data: {
        title: 'Suggested Meetup',
        slug: 'suggested-meetup',
        status: 'UPCOMING',
        startsAt: new Date('2026-07-01T18:00:00Z'),
        cityId: city.id,
        moderationState: 'PENDING_REVIEW',
        source: 'USER_SUGGESTED',
      },
    });
    await testDb.contentReport.create({
      data: {
        reportType: 'SUGGEST_EVENT',
        suggestedName: 'Suggested Meetup',
        cityId: city.id,
        eventId: event.id,
        reporterUserId: actor.id,
        createdAt: new Date('2026-02-01T00:00:00Z'),
      },
    });

    // Noise: a contribution by a different user must not leak.
    await testDb.community.create({
      data: {
        name: 'Other Submission',
        slug: 'other-submission',
        status: 'ACTIVE',
        claimState: 'UNCLAIMED',
        source: 'COMMUNITY_SUBMITTED',
        createdByUserId: other.id,
        cityId: city.id,
      },
    });

    const contributions = await getMyContributions(actor.id);

    expect(contributions).toHaveLength(2);
    // Newest first: the event suggestion (Feb) before the community (Jan).
    expect(contributions[0]).toMatchObject({
      kind: 'EVENT',
      title: 'Suggested Meetup',
      status: 'UNDER_REVIEW',
      href: null,
    });
    expect(contributions[1]).toMatchObject({
      kind: 'COMMUNITY',
      title: 'Published Submission',
      status: 'PUBLISHED',
      href: '/attr-city-4/communities/published-submission',
    });
    // No leakage of the other user's contribution.
    expect(contributions.some((c) => c.title === 'Other Submission')).toBe(false);
  });
});
