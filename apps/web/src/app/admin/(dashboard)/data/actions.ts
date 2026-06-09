'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { communityOptions, resources } from '@indlokal/shared';
import { z } from 'zod';
import { db } from '@/lib/db';
import { assertCan } from '@/lib/auth/permissions';
import {
  type ImportResource,
  parseImportPayload,
  validateImportEnvelope,
} from '@/modules/admin-import/parsing';
import { runBootstrap } from '../../../../../prisma/bootstrap';

/* ───────────────────────────── Auth guard ───────────────────────────── */

const slugRe = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/* ───────────────────────────── Bootstrap ────────────────────────────── */

export async function runBootstrapAction() {
  await assertCan('admin.data.write');
  await runBootstrap();
  revalidatePath('/admin/data');
  revalidatePath('/admin/data/health');
  revalidatePath('/admin/data/cities');
  revalidatePath('/admin/data/categories');
}

/* ───────────────────────────── Cities ───────────────────────────────── */

const CityInput = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(60).regex(slugRe, 'lowercase letters, digits, hyphens'),
  state: z.string().min(2).max(80),
  country: z.string().min(2).max(80).default('Germany'),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  population: z.coerce.number().int().nonnegative().optional(),
  diasporaDensityEstimate: z.coerce.number().int().nonnegative().optional(),
  isActive: z.coerce.boolean().default(false),
  isMetroPrimary: z.coerce.boolean().default(false),
  metroRegionSlug: z.string().optional(),
  timezone: z.string().default('Europe/Berlin'),
});

function parseFlagBool(fd: FormData, name: string) {
  const v = fd.get(name);
  return v === 'on' || v === 'true' || v === '1';
}

function fdToCityInput(fd: FormData) {
  return CityInput.parse({
    name: fd.get('name'),
    slug: fd.get('slug'),
    state: fd.get('state'),
    country: fd.get('country') || 'Germany',
    latitude: fd.get('latitude') || undefined,
    longitude: fd.get('longitude') || undefined,
    population: fd.get('population') || undefined,
    diasporaDensityEstimate: fd.get('diasporaDensityEstimate') || undefined,
    isActive: parseFlagBool(fd, 'isActive'),
    isMetroPrimary: parseFlagBool(fd, 'isMetroPrimary'),
    metroRegionSlug: (fd.get('metroRegionSlug') as string) || undefined,
    timezone: (fd.get('timezone') as string) || 'Europe/Berlin',
  });
}

export async function createCityAction(formData: FormData) {
  await assertCan('admin.data.write');
  const input = fdToCityInput(formData);
  const metroId = input.metroRegionSlug
    ? (await db.city.findUnique({ where: { slug: input.metroRegionSlug }, select: { id: true } }))
        ?.id
    : null;
  await db.city.create({
    data: {
      name: input.name,
      slug: input.slug,
      state: input.state,
      country: input.country,
      latitude: input.latitude,
      longitude: input.longitude,
      population: input.population,
      diasporaDensityEstimate: input.diasporaDensityEstimate,
      isActive: input.isActive,
      isMetroPrimary: input.isMetroPrimary,
      metroRegionId: metroId ?? undefined,
      timezone: input.timezone,
    },
  });
  revalidatePath('/admin/data/cities');
  redirect('/admin/data/cities');
}

export async function updateCityAction(formData: FormData) {
  await assertCan('admin.data.write');
  const id = String(formData.get('id') || '');
  if (!id) throw new Error('Missing city id');
  const input = fdToCityInput(formData);
  const metroId = input.metroRegionSlug
    ? (await db.city.findUnique({ where: { slug: input.metroRegionSlug }, select: { id: true } }))
        ?.id
    : null;
  await db.city.update({
    where: { id },
    data: {
      name: input.name,
      slug: input.slug,
      state: input.state,
      country: input.country,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      population: input.population ?? null,
      diasporaDensityEstimate: input.diasporaDensityEstimate ?? null,
      isActive: input.isActive,
      isMetroPrimary: input.isMetroPrimary,
      metroRegionId: metroId,
      timezone: input.timezone,
    },
  });
  revalidatePath('/admin/data/cities');
  revalidatePath(`/admin/data/cities/${input.slug}`);
}

export async function toggleCityActiveAction(formData: FormData) {
  await assertCan('admin.data.write');
  const id = String(formData.get('id') || '');
  if (!id) return;
  const city = await db.city.findUnique({ where: { id }, select: { isActive: true } });
  if (!city) return;
  await db.city.update({ where: { id }, data: { isActive: !city.isActive } });
  revalidatePath('/admin/data/cities');
}

/**
 * Delete a city. Refuses if anything still references it (communities, events,
 * resources, users, reports, child metro members). Admin must clear those first.
 */
export async function deleteCityAction(formData: FormData) {
  await assertCan('admin.data.delete');
  const id = String(formData.get('id') || '');
  if (!id) return;

  const [communities, events, resources, users, reports, children] = await Promise.all([
    db.community.count({ where: { cityId: id } }),
    db.event.count({ where: { cityId: id } }),
    db.resource.count({ where: { cityId: id } }),
    db.user.count({ where: { cityId: id } }),
    db.contentReport.count({ where: { cityId: id } }),
    db.city.count({ where: { metroRegionId: id } }),
  ]);

  const refs: string[] = [];
  if (communities) refs.push(`${communities} communities`);
  if (events) refs.push(`${events} events`);
  if (resources) refs.push(`${resources} resources`);
  if (users) refs.push(`${users} users`);
  if (reports) refs.push(`${reports} reports`);
  if (children) refs.push(`${children} child cities`);
  if (refs.length > 0) {
    throw new Error(`City still referenced by ${refs.join(', ')}. Reassign or delete those first.`);
  }

  await db.city.delete({ where: { id } });
  revalidatePath('/admin/data/cities');
}

/* ───────────────────────────── Categories ───────────────────────────── */

const CategoryInput = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(60).regex(slugRe),
  type: z.enum(['CATEGORY', 'PERSONA']).default('CATEGORY'),
  icon: z.string().max(8).optional(),
  description: z.string().max(500).optional(),
  sortOrder: z.coerce.number().int().default(0),
});

function fdToCategoryInput(fd: FormData) {
  return CategoryInput.parse({
    name: fd.get('name'),
    slug: fd.get('slug'),
    type: fd.get('type') || 'CATEGORY',
    icon: (fd.get('icon') as string) || undefined,
    description: (fd.get('description') as string) || undefined,
    sortOrder: fd.get('sortOrder') || 0,
  });
}

export async function createCategoryAction(formData: FormData) {
  await assertCan('admin.data.write');
  const input = fdToCategoryInput(formData);
  await db.category.create({ data: input });
  revalidatePath('/admin/data/categories');
  redirect('/admin/data/categories');
}

export async function updateCategoryAction(formData: FormData) {
  await assertCan('admin.data.write');
  const id = String(formData.get('id') || '');
  if (!id) throw new Error('Missing category id');
  const input = fdToCategoryInput(formData);
  await db.category.update({ where: { id }, data: input });
  revalidatePath('/admin/data/categories');
}

export async function deleteCategoryAction(formData: FormData) {
  await assertCan('admin.data.delete');
  const id = String(formData.get('id') || '');
  if (!id) return;
  // Refuse if referenced - admin-safe.
  const refs = await db.communityCategory.count({ where: { categoryId: id } });
  if (refs > 0) throw new Error(`Category has ${refs} community references; deactivate instead.`);
  await db.category.delete({ where: { id } });
  revalidatePath('/admin/data/categories');
}

/* ───────────────────────────── Communities ──────────────────────────── */

export async function setCommunityStatusAction(formData: FormData) {
  await assertCan('admin.data.write');
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '');
  if (!id || !['ACTIVE', 'INACTIVE', 'UNVERIFIED'].includes(status)) return;
  const updated = await db.community.update({
    where: { id },
    data: { status: status as 'ACTIVE' | 'INACTIVE' | 'UNVERIFIED' },
    select: { city: { select: { slug: true } } },
  });

  revalidateTag('city-feed', 'max');
  if (updated.city?.slug) {
    revalidatePath(`/${updated.city.slug}/communities`);
  }
  revalidatePath('/admin/data/communities');
}

/**
 * Hard-delete a community and all rows that depend on it.
 *
 * Use for true duplicates / spam only. Most cleanup should use status=INACTIVE.
 * Cascading FKs handle: AccessChannel, ActivitySignal, TrustSignal, SavedCommunity,
 * CommunityCategory, RelationshipEdge. We must manually clear the non-cascading
 * relations: Event.communityId (nullable, no cascade), Community.mergedIntoId
 * (self-relation), and ContentReport.communityId (nullable, no cascade).
 */
export async function deleteCommunityAction(formData: FormData) {
  await assertCan('admin.data.delete');
  const id = String(formData.get('id') || '');
  if (!id) return;

  await db.$transaction([
    // Detach events that pointed at this community (don't delete the events themselves).
    db.event.updateMany({ where: { communityId: id }, data: { communityId: null } }),
    // Clear merge pointers from any communities merged into this one.
    db.community.updateMany({ where: { mergedIntoId: id }, data: { mergedIntoId: null } }),
    // Drop reports tied to this community (no cascade in schema).
    db.contentReport.deleteMany({ where: { communityId: id } }),
    db.community.delete({ where: { id } }),
  ]);

  revalidatePath('/admin/data/communities');
  revalidateTag('city-feed', 'max');
}

/* ───────────────────────────── Events ───────────────────────────────── */

export async function setEventStatusAction(formData: FormData) {
  await assertCan('admin.data.write');
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '');
  if (!id || !['UPCOMING', 'ONGOING', 'PAST', 'CANCELLED'].includes(status)) return;
  const updated = await db.event.update({
    where: { id },
    data: { status: status as 'UPCOMING' | 'ONGOING' | 'PAST' | 'CANCELLED' },
    select: { cityId: true, city: { select: { slug: true } } },
  });

  revalidateTag('city-feed', 'max');
  revalidateTag(`city-events-${updated.cityId}`, 'max');
  if (updated.city?.slug) {
    revalidatePath(`/${updated.city.slug}/events`);
  }
  revalidatePath('/admin/data/events');
}

/** Hard-delete an event. EventCategory, TrustSignal, SavedEvent cascade. */
export async function deleteEventAction(formData: FormData) {
  await assertCan('admin.data.delete');
  const id = String(formData.get('id') || '');
  if (!id) return;
  const deleted = await db.event.delete({
    where: { id },
    select: { cityId: true, city: { select: { slug: true } } },
  });

  revalidateTag('city-feed', 'max');
  revalidateTag(`city-events-${deleted.cityId}`, 'max');
  if (deleted.city?.slug) {
    revalidatePath(`/${deleted.city.slug}/events`);
  }
  revalidatePath('/admin/data/events');
}

/* ───────────────────────────── Resources ────────────────────────────── */

/** Hard-delete a resource (consular / official / guide entry). */
export async function deleteResourceAction(formData: FormData) {
  await assertCan('admin.data.delete');
  const id = String(formData.get('id') || '');
  if (!id) return;
  await db.resource.delete({ where: { id } });
  revalidatePath('/admin/data/resources');
}

/* ───────────────────────────── Journey tags (PRD/TDD-0053) ──────────── */

/**
 * Backfill journey tags on a resource (audiences × lifecycle stage). This is
 * the human-curated tagging path the coverage report grades against. Clearing
 * the resolver cache is required so newly-tagged resources surface in journeys
 * immediately (the resolver caches by city × audience × stage).
 */
export async function updateResourceJourneyTagsAction(formData: FormData) {
  await assertCan('admin.data.write');
  const id = String(formData.get('id') || '');
  if (!id) return;

  const { audiences, lifecycleStage } = fdToResourceTags(formData);

  await db.resource.update({
    where: { id },
    data: { audiences, lifecycleStage },
  });

  const { invalidateResolver } = await import('@/modules/resources/resolver');
  invalidateResolver();
  revalidateTag('city-feed', 'max');
  revalidatePath('/admin/data/resources');
}

/* ─────────────────────── Resource create / edit (PRD/TDD-0030) ────────────
 *
 * The DB is the source of truth for resources; the seed file is a one-time
 * baseline. These actions let admins author the full resource record in-app,
 * mirroring the `ResourceEntry` shape used by the seed (scope, scopeRegion,
 * journey tags, validity window, review cadence) so no code edit is ever
 * needed to add or correct a resource.
 */

const ResourceInput = z.object({
  title: z.string().min(2).max(160),
  slug: z.string().min(2).max(120).regex(slugRe, 'lowercase letters, digits, hyphens'),
  resourceType: resources.ResourceType,
  scope: resources.ResourceScope.default('CITY'),
  citySlug: z.string().optional(),
  scopeRegion: z.string().optional(),
  url: z.string().trim().url().optional(),
  description: z.string().max(6000).optional(),
  priority: z.coerce.number().int().min(0).max(100).optional(),
  isEssential: z.coerce.boolean().default(false),
  reviewCadenceDays: z.coerce.number().int().min(1).max(3650).default(180),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
});

/** Mirror the seeder's scopeRegion derivation when the admin leaves it blank. */
function deriveScopeRegion(
  scope: resources.ResourceScope,
  citySlug: string | undefined,
  scopeRegion: string | undefined,
): string | null {
  if (scopeRegion) return scopeRegion;
  switch (scope) {
    case 'COUNTRY':
      return 'DE';
    case 'METRO':
    case 'CITY':
      return citySlug ?? null;
    default:
      // GLOBAL → null; STATE/DISTRICT require an explicit region.
      return null;
  }
}

function fdToResourceInput(fd: FormData) {
  return ResourceInput.parse({
    title: fd.get('title'),
    slug: fd.get('slug'),
    resourceType: fd.get('resourceType'),
    scope: fd.get('scope') || 'CITY',
    citySlug: (fd.get('citySlug') as string) || undefined,
    scopeRegion: (fd.get('scopeRegion') as string) || undefined,
    url: (fd.get('url') as string)?.trim() || undefined,
    description: (fd.get('description') as string) || undefined,
    priority: fd.get('priority') || undefined,
    isEssential: parseFlagBool(fd, 'isEssential'),
    reviewCadenceDays: fd.get('reviewCadenceDays') || 180,
    validFrom: fd.get('validFrom') || undefined,
    validUntil: fd.get('validUntil') || undefined,
  });
}

function fdToResourceTags(fd: FormData) {
  const audiences = fd
    .getAll('audiences')
    .map(String)
    .filter((v): v is resources.ResourceAudience =>
      (resources.ResourceAudience.options as readonly string[]).includes(v),
    );
  const lifecycleStage = fd
    .getAll('lifecycleStage')
    .map(String)
    .filter((v): v is resources.ResourceStage =>
      (resources.ResourceStage.options as readonly string[]).includes(v),
    );
  return { audiences, lifecycleStage };
}

/** Resolve cityId (CITY scope only) + scopeRegion for a resource write. */
async function resolveResourceLocation(input: z.infer<typeof ResourceInput>) {
  let cityId: string | null = null;
  if (input.scope === 'CITY') {
    if (!input.citySlug) throw new Error('CITY-scoped resources require a city.');
    const city = await db.city.findUnique({
      where: { slug: input.citySlug },
      select: { id: true },
    });
    if (!city) throw new Error(`City "${input.citySlug}" not found.`);
    cityId = city.id;
  }
  const scopeRegion = deriveScopeRegion(input.scope, input.citySlug, input.scopeRegion);
  return { cityId, scopeRegion };
}

async function invalidateResourceCaches() {
  const { invalidateResolver } = await import('@/modules/resources/resolver');
  invalidateResolver();
  revalidateTag('city-feed', 'max');
  revalidatePath('/admin/data/resources');
}

export async function createResourceAction(formData: FormData) {
  await assertCan('admin.data.write');
  const input = fdToResourceInput(formData);
  const { audiences, lifecycleStage } = fdToResourceTags(formData);

  const existing = await db.resource.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (existing) throw new Error(`A resource with slug "${input.slug}" already exists.`);

  const { cityId, scopeRegion } = await resolveResourceLocation(input);

  await db.resource.create({
    data: {
      title: input.title,
      slug: input.slug,
      resourceType: input.resourceType,
      scope: input.scope,
      scopeRegion,
      cityId,
      url: input.url ?? null,
      description: input.description ?? null,
      audiences,
      lifecycleStage,
      priority: input.priority ?? (input.isEssential ? 80 : 50),
      isEssential: input.isEssential,
      reviewCadenceDays: input.reviewCadenceDays,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
      lastReviewedAt: new Date(),
      source: 'ADMIN_SEED',
      metadata: { editorialSource: 'admin-ui' },
    },
  });

  await invalidateResourceCaches();
  redirect('/admin/data/resources');
}

export async function updateResourceAction(formData: FormData) {
  await assertCan('admin.data.write');
  const id = String(formData.get('id') || '');
  if (!id) throw new Error('Missing resource id');
  const input = fdToResourceInput(formData);
  const { audiences, lifecycleStage } = fdToResourceTags(formData);

  const dupe = await db.resource.findFirst({
    where: { slug: input.slug, NOT: { id } },
    select: { id: true },
  });
  if (dupe) throw new Error(`A resource with slug "${input.slug}" already exists.`);

  const { cityId, scopeRegion } = await resolveResourceLocation(input);

  await db.resource.update({
    where: { id },
    data: {
      title: input.title,
      slug: input.slug,
      resourceType: input.resourceType,
      scope: input.scope,
      scopeRegion,
      cityId,
      url: input.url ?? null,
      description: input.description ?? null,
      audiences,
      lifecycleStage,
      priority: input.priority ?? (input.isEssential ? 80 : 50),
      isEssential: input.isEssential,
      reviewCadenceDays: input.reviewCadenceDays,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
      lastReviewedAt: new Date(),
    },
  });

  await invalidateResourceCaches();
  redirect('/admin/data/resources');
}

/**
 * Backfill persona/language tags on a community. These drive the journey
 * "find your people" blocks (Community.personaSegments). Suggest-only pipeline
 * tags also land here once a human approves them.
 */
export async function updateCommunityPersonaTagsAction(formData: FormData) {
  await assertCan('admin.data.write');
  const id = String(formData.get('id') || '');
  if (!id) return;

  const personaSegments = formData
    .getAll('personaSegments')
    .map(String)
    .filter((v) => (communityOptions.PERSONA_SEGMENT_VALUES as readonly string[]).includes(v));
  const languages = formData
    .getAll('languages')
    .map(String)
    .filter((v) => (communityOptions.COMMUNITY_LANGUAGE_VALUES as readonly string[]).includes(v));

  const updated = await db.community.update({
    where: { id },
    data: { personaSegments, languages },
    select: { city: { select: { slug: true } } },
  });

  revalidateTag('city-feed', 'max');
  if (updated.city?.slug) {
    revalidatePath(`/${updated.city.slug}/communities`);
  }
  revalidatePath('/admin/data/communities');
}

/* ───────────────────────────── Bulk import ──────────────────────────── */

const ImportCity = z.object({
  name: z.string(),
  slug: z.string().regex(slugRe),
  state: z.string(),
  country: z.string().default('Germany'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  population: z.number().int().optional(),
  diasporaDensityEstimate: z.number().int().optional(),
  isActive: z.boolean().default(false),
  isMetroPrimary: z.boolean().default(false),
  metroRegionSlug: z.string().optional(),
  timezone: z.string().default('Europe/Berlin'),
});

const ImportCategory = z.object({
  name: z.string(),
  slug: z.string().regex(slugRe),
  type: z.enum(['CATEGORY', 'PERSONA']).default('CATEGORY'),
  icon: z.string().optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

const ImportCommunity = z.object({
  name: z.string(),
  slug: z.string().regex(slugRe),
  description: z.string().optional(),
  citySlug: z.string(),
  languages: z.array(z.string()).default([]),
  personaSegments: z.array(z.string()).default([]),
  categorySlugs: z.array(z.string()).default([]),
  status: z.enum(['ACTIVE', 'INACTIVE', 'UNVERIFIED']).default('UNVERIFIED'),
  channels: z
    .array(
      z.object({
        channelType: z.enum(communityOptions.CHANNEL_TYPE_VALUES),
        url: z.string().url(),
        label: z.string().optional(),
        isPrimary: z.boolean().default(false),
      }),
    )
    .default([]),
});

export type ImportPlanRow = {
  index: number;
  action: 'create' | 'update' | 'error';
  slug: string;
  message?: string;
};

export type ImportPlan = {
  resource: 'city' | 'category' | 'community';
  total: number;
  toCreate: number;
  toUpdate: number;
  errors: number;
  rows: ImportPlanRow[];
};

export async function planImportAction(formData: FormData): Promise<ImportPlan> {
  await assertCan('admin.data.write');
  const selectedResource = String(formData.get('resource') || '');
  const text = String(formData.get('payload') || '');
  const { payloadResource, rows } = parseImportPayload(text);
  const resource = validateImportEnvelope({
    selectedResource,
    payloadResource,
    payloadText: text,
    rowCount: rows.length,
  });
  return planRows(resource, rows);
}

async function planRows(resource: ImportResource, rows: unknown[]): Promise<ImportPlan> {
  const out: ImportPlan = {
    resource,
    total: rows.length,
    toCreate: 0,
    toUpdate: 0,
    errors: 0,
    rows: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    try {
      if (resource === 'city') {
        const v = ImportCity.parse(raw);
        if (v.metroRegionSlug) {
          const metro = await db.city.findUnique({
            where: { slug: v.metroRegionSlug },
            select: { id: true },
          });
          if (!metro) throw new Error(`Unknown metroRegionSlug: ${v.metroRegionSlug}`);
        }
        const exists = await db.city.findUnique({ where: { slug: v.slug }, select: { id: true } });
        out.rows.push({ index: i, action: exists ? 'update' : 'create', slug: v.slug });
        if (exists) out.toUpdate++;
        else out.toCreate++;
      } else if (resource === 'category') {
        const v = ImportCategory.parse(raw);
        const exists = await db.category.findUnique({
          where: { slug: v.slug },
          select: { id: true },
        });
        out.rows.push({ index: i, action: exists ? 'update' : 'create', slug: v.slug });
        if (exists) out.toUpdate++;
        else out.toCreate++;
      } else {
        const v = ImportCommunity.parse(raw);
        const city = await db.city.findUnique({
          where: { slug: v.citySlug },
          select: { id: true },
        });
        if (!city) throw new Error(`Unknown city slug: ${v.citySlug}`);
        if (v.categorySlugs.length) {
          const foundCategories = await db.category.findMany({
            where: { slug: { in: v.categorySlugs } },
            select: { slug: true },
          });
          const found = new Set(foundCategories.map((c) => c.slug));
          const missing = v.categorySlugs.filter((slug) => !found.has(slug));
          if (missing.length) {
            throw new Error(`Unknown category slugs: ${missing.join(', ')}`);
          }
        }
        const exists = await db.community.findUnique({
          where: { slug: v.slug },
          select: { id: true },
        });
        out.rows.push({ index: i, action: exists ? 'update' : 'create', slug: v.slug });
        if (exists) out.toUpdate++;
        else out.toCreate++;
      }
    } catch (err) {
      out.errors++;
      out.rows.push({
        index: i,
        action: 'error',
        slug:
          (raw && typeof raw === 'object' && 'slug' in (raw as Record<string, unknown>)
            ? String((raw as Record<string, unknown>).slug)
            : `row ${i}`) || `row ${i}`,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return out;
}

export async function applyImportAction(formData: FormData): Promise<ImportPlan> {
  await assertCan('admin.data.write');
  const selectedResource = String(formData.get('resource') || '');
  const text = String(formData.get('payload') || '');
  const { payloadResource, rows } = parseImportPayload(text);
  const resource = validateImportEnvelope({
    selectedResource,
    payloadResource,
    payloadText: text,
    rowCount: rows.length,
  });

  // Re-run validation, then apply via upsert. Errors abort that single row only.
  const result: ImportPlan = {
    resource,
    total: rows.length,
    toCreate: 0,
    toUpdate: 0,
    errors: 0,
    rows: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    try {
      if (resource === 'city') {
        const v = ImportCity.parse(raw);
        const { existing } = await db.$transaction(async (tx) => {
          const metro = v.metroRegionSlug
            ? await tx.city.findUnique({ where: { slug: v.metroRegionSlug }, select: { id: true } })
            : null;
          if (v.metroRegionSlug && !metro) {
            throw new Error(`Unknown metroRegionSlug: ${v.metroRegionSlug}`);
          }
          const existing = await tx.city.findUnique({
            where: { slug: v.slug },
            select: { id: true },
          });
          await tx.city.upsert({
            where: { slug: v.slug },
            update: {
              name: v.name,
              state: v.state,
              country: v.country,
              latitude: v.latitude ?? null,
              longitude: v.longitude ?? null,
              population: v.population ?? null,
              diasporaDensityEstimate: v.diasporaDensityEstimate ?? null,
              isActive: v.isActive,
              isMetroPrimary: v.isMetroPrimary,
              metroRegionId: metro?.id ?? null,
              timezone: v.timezone,
            },
            create: {
              name: v.name,
              slug: v.slug,
              state: v.state,
              country: v.country,
              latitude: v.latitude,
              longitude: v.longitude,
              population: v.population,
              diasporaDensityEstimate: v.diasporaDensityEstimate,
              isActive: v.isActive,
              isMetroPrimary: v.isMetroPrimary,
              metroRegionId: metro?.id ?? undefined,
              timezone: v.timezone,
            },
          });
          return { existing };
        });
        result.rows.push({ index: i, action: existing ? 'update' : 'create', slug: v.slug });
        if (existing) result.toUpdate++;
        else result.toCreate++;
      } else if (resource === 'category') {
        const v = ImportCategory.parse(raw);
        const { existing } = await db.$transaction(async (tx) => {
          const existing = await tx.category.findUnique({
            where: { slug: v.slug },
            select: { id: true },
          });
          await tx.category.upsert({
            where: { slug: v.slug },
            update: v,
            create: v,
          });
          return { existing };
        });
        result.rows.push({ index: i, action: existing ? 'update' : 'create', slug: v.slug });
        if (existing) result.toUpdate++;
        else result.toCreate++;
      } else {
        const v = ImportCommunity.parse(raw);
        const { existing } = await db.$transaction(async (tx) => {
          const city = await tx.city.findUnique({
            where: { slug: v.citySlug },
            select: { id: true },
          });
          if (!city) throw new Error(`Unknown city slug: ${v.citySlug}`);

          const categories = v.categorySlugs.length
            ? await tx.category.findMany({
                where: { slug: { in: v.categorySlugs } },
                select: { id: true, slug: true },
              })
            : [];
          const foundCategorySlugs = new Set(categories.map((c) => c.slug));
          const missingCategorySlugs = v.categorySlugs.filter(
            (slug) => !foundCategorySlugs.has(slug),
          );
          if (missingCategorySlugs.length) {
            throw new Error(`Unknown category slugs: ${missingCategorySlugs.join(', ')}`);
          }

          const existing = await tx.community.findUnique({
            where: { slug: v.slug },
            select: { id: true },
          });

          const community = await tx.community.upsert({
            where: { slug: v.slug },
            update: {
              name: v.name,
              description: v.description ?? null,
              cityId: city.id,
              languages: v.languages,
              personaSegments: v.personaSegments,
              status: v.status,
              source: 'IMPORTED',
            },
            create: {
              name: v.name,
              slug: v.slug,
              description: v.description,
              cityId: city.id,
              languages: v.languages,
              personaSegments: v.personaSegments,
              status: v.status,
              source: 'IMPORTED',
            },
          });

          // Reconcile many-to-many relations exactly as provided, including empty arrays.
          await tx.communityCategory.deleteMany({ where: { communityId: community.id } });
          if (categories.length) {
            await tx.communityCategory.createMany({
              data: categories.map((c) => ({ communityId: community.id, categoryId: c.id })),
              skipDuplicates: true,
            });
          }

          // Reconcile channels exactly as provided, including empty arrays.
          await tx.accessChannel.deleteMany({ where: { communityId: community.id } });
          if (v.channels.length) {
            await tx.accessChannel.createMany({
              data: v.channels.map((ch) => ({
                communityId: community.id,
                channelType: ch.channelType,
                url: ch.url,
                label: ch.label,
                isPrimary: ch.isPrimary,
              })),
            });
          }

          return { existing };
        });

        result.rows.push({ index: i, action: existing ? 'update' : 'create', slug: v.slug });
        if (existing) result.toUpdate++;
        else result.toCreate++;
      }
    } catch (err) {
      result.errors++;
      result.rows.push({
        index: i,
        action: 'error',
        slug:
          (raw && typeof raw === 'object' && 'slug' in (raw as Record<string, unknown>)
            ? String((raw as Record<string, unknown>).slug)
            : `row ${i}`) || `row ${i}`,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  revalidatePath('/admin/data');
  revalidatePath(
    `/admin/data/${resource === 'city' ? 'cities' : resource === 'category' ? 'categories' : 'communities'}`,
  );
  return result;
}
