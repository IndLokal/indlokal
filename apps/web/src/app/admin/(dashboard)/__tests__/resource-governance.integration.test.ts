/**
 * Integration tests - resource owned-content governance gate (Wave 1 A2).
 *
 * @db - requires test database.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanDb, testDb } from '@/test/db-helpers';
import { createCity, createUser } from '@/test/fixtures';

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  async function resolveCityIds(citySlug: string): Promise<string[]> {
    const city = await testDb.city.findUnique({ where: { slug: citySlug }, select: { id: true } });
    return city ? [city.id] : [];
  }
  return { ...mod, db: testDb, resolveCityIds };
});

type SessionUser = { id: string; role: string };
let currentSession: SessionUser | null = null;

vi.mock('@/lib/session', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/session')>();
  return {
    ...mod,
    getSessionUser: async () => currentSession,
  };
});

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`);
    (err as Error & { digest?: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw err;
  },
}));

import { createResourceAction, updateResourceAction } from '../data/actions';

function baseResourceForm(citySlug: string, slug: string) {
  const form = new FormData();
  form.set('title', 'Resource Governance Test');
  form.set('slug', slug);
  form.set('resourceType', 'CITY_REGISTRATION');
  form.set('scope', 'CITY');
  form.set('citySlug', citySlug);
  form.set('description', 'Test description');
  form.set('reviewCadenceDays', '180');
  form.set('contentMode', 'CURATED');
  return form;
}

beforeEach(async () => {
  await cleanDb();
  const admin = await createUser(testDb, {
    email: 'resource-admin@example.com',
    role: 'PLATFORM_ADMIN',
  });
  currentSession = { id: admin.id, role: admin.role };
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe('@db resource governance gate', () => {
  it('rejects OWNED create when rationale is missing', async () => {
    const city = await createCity(testDb, { slug: 'stuttgart' });
    const form = baseResourceForm(city.slug, 'owned-missing-rationale');
    form.set('contentMode', 'OWNED');
    form.set('riskClass', 'HIGH');
    form.set('confusionClass', 'HIGH');
    form.set('frequencyClass', 'HIGH');
    form.set('alternativesConsidered', 'No official equivalent found');

    await expect(createResourceAction(form)).rejects.toThrow(
      'Owned content requires a governance rationale.',
    );
  });

  it('allows CURATED create without owned-only fields and writes audit log', async () => {
    const city = await createCity(testDb, { slug: 'stuttgart' });
    const form = baseResourceForm(city.slug, 'curated-resource-test');

    await expect(createResourceAction(form)).rejects.toThrow(
      /NEXT_REDIRECT:\/admin\/data\/resources/,
    );

    const resource = await testDb.resource.findUnique({
      where: { slug: 'curated-resource-test' },
      select: { id: true, metadata: true },
    });
    expect(resource).not.toBeNull();

    const metadata = (resource?.metadata ?? {}) as Record<string, unknown>;
    expect(metadata.contentMode).toBe('CURATED');
    expect(metadata.governance).toBeUndefined();

    const log = await testDb.contentLog.findFirst({
      where: { entityType: 'resource', entityId: resource!.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(log?.action).toBe('CREATED');
  });

  it('persists OWNED governance metadata and writes ContentLog on create', async () => {
    const city = await createCity(testDb, { slug: 'stuttgart' });
    const form = baseResourceForm(city.slug, 'owned-resource-test');
    form.set('contentMode', 'OWNED');
    form.set('governanceRationale', 'High confusion risk and no authoritative source coverage');
    form.set('riskClass', 'HIGH');
    form.set('confusionClass', 'HIGH');
    form.set('frequencyClass', 'HIGH');
    form.set('alternativesConsidered', 'Checked city pages and consulate updates');

    await expect(createResourceAction(form)).rejects.toThrow(
      /NEXT_REDIRECT:\/admin\/data\/resources/,
    );

    const resource = await testDb.resource.findUnique({
      where: { slug: 'owned-resource-test' },
      select: { id: true, metadata: true },
    });
    expect(resource).not.toBeNull();

    const metadata = (resource?.metadata ?? {}) as Record<string, unknown>;
    const governance = (metadata.governance ?? {}) as Record<string, unknown>;
    expect(metadata.contentMode).toBe('OWNED');
    expect(governance.rationale).toBeTruthy();
    expect(governance.riskClass).toBe('HIGH');

    const log = await testDb.contentLog.findFirst({
      where: { entityType: 'resource', entityId: resource!.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(log?.action).toBe('CREATED');
    const logMetadata = (log?.metadata ?? {}) as Record<string, unknown>;
    expect(logMetadata.contentMode).toBe('OWNED');
  });

  it('updates resource to OWNED mode and writes UPDATED audit entry', async () => {
    const city = await createCity(testDb, { slug: 'stuttgart' });
    const resource = await testDb.resource.create({
      data: {
        title: 'Existing Curated Resource',
        slug: 'existing-curated-resource',
        resourceType: 'CITY_REGISTRATION',
        scope: 'CITY',
        scopeRegion: city.slug,
        cityId: city.id,
        source: 'ADMIN_SEED',
        metadata: { editorialSource: 'admin-ui', contentMode: 'CURATED' },
      },
      select: { id: true },
    });

    const form = baseResourceForm(city.slug, 'existing-curated-resource');
    form.set('id', resource.id);
    form.set('contentMode', 'OWNED');
    form.set('governanceRationale', 'Needed for high-risk migration scenario');
    form.set('riskClass', 'HIGH');
    form.set('confusionClass', 'MEDIUM');
    form.set('frequencyClass', 'HIGH');
    form.set('alternativesConsidered', 'Reviewed official docs and FAQs');

    await expect(updateResourceAction(form)).rejects.toThrow(
      /NEXT_REDIRECT:\/admin\/data\/resources/,
    );

    const updated = await testDb.resource.findUnique({
      where: { id: resource.id },
      select: { metadata: true },
    });
    const metadata = (updated?.metadata ?? {}) as Record<string, unknown>;
    expect(metadata.contentMode).toBe('OWNED');

    const lastLog = await testDb.contentLog.findFirst({
      where: { entityType: 'resource', entityId: resource.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(lastLog?.action).toBe('UPDATED');
  });
});
