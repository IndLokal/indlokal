'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { runBootstrap } from '../../../../../prisma/bootstrap';

/* ───────────────────────────── Auth guard ───────────────────────────── */

async function requireAdminAction() {
  const user = await getSessionUser();
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    throw new Error('Unauthorized');
  }
  return user;
}

const slugRe = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/* ───────────────────────────── Bootstrap ────────────────────────────── */

export async function runBootstrapAction() {
  await requireAdminAction();
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
  await requireAdminAction();
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
  await requireAdminAction();
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
  await requireAdminAction();
  const id = String(formData.get('id') || '');
  if (!id) return;
  const city = await db.city.findUnique({ where: { id }, select: { isActive: true } });
  if (!city) return;
  await db.city.update({ where: { id }, data: { isActive: !city.isActive } });
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
  await requireAdminAction();
  const input = fdToCategoryInput(formData);
  await db.category.create({ data: input });
  revalidatePath('/admin/data/categories');
  redirect('/admin/data/categories');
}

export async function updateCategoryAction(formData: FormData) {
  await requireAdminAction();
  const id = String(formData.get('id') || '');
  if (!id) throw new Error('Missing category id');
  const input = fdToCategoryInput(formData);
  await db.category.update({ where: { id }, data: input });
  revalidatePath('/admin/data/categories');
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdminAction();
  const id = String(formData.get('id') || '');
  if (!id) return;
  // Refuse if referenced — admin-safe.
  const refs = await db.communityCategory.count({ where: { categoryId: id } });
  if (refs > 0) throw new Error(`Category has ${refs} community references; deactivate instead.`);
  await db.category.delete({ where: { id } });
  revalidatePath('/admin/data/categories');
}

/* ───────────────────────────── Communities ──────────────────────────── */

export async function setCommunityStatusAction(formData: FormData) {
  await requireAdminAction();
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '');
  if (!id || !['ACTIVE', 'INACTIVE', 'UNVERIFIED', 'CLAIMED'].includes(status)) return;
  await db.community.update({
    where: { id },
    data: { status: status as 'ACTIVE' | 'INACTIVE' | 'UNVERIFIED' | 'CLAIMED' },
  });
  revalidatePath('/admin/data/communities');
}

/* ───────────────────────────── Events ───────────────────────────────── */

export async function setEventStatusAction(formData: FormData) {
  await requireAdminAction();
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '');
  if (!id || !['UPCOMING', 'ONGOING', 'PAST', 'CANCELLED'].includes(status)) return;
  await db.event.update({
    where: { id },
    data: { status: status as 'UPCOMING' | 'ONGOING' | 'PAST' | 'CANCELLED' },
  });
  revalidatePath('/admin/data/events');
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
  status: z.enum(['ACTIVE', 'INACTIVE', 'UNVERIFIED', 'CLAIMED']).default('UNVERIFIED'),
  channels: z
    .array(
      z.object({
        channelType: z.enum([
          'WHATSAPP',
          'TELEGRAM',
          'WEBSITE',
          'FACEBOOK',
          'INSTAGRAM',
          'EMAIL',
          'MEETUP',
          'YOUTUBE',
          'LINKEDIN',
          'OTHER',
        ]),
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

function parseRows(text: string): { resource: string; rows: unknown[] } {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Empty payload');
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return { resource: '', rows: parsed };
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { rows?: unknown }).rows)
    ) {
      const obj = parsed as { resource?: string; rows: unknown[] };
      return { resource: obj.resource ?? '', rows: obj.rows };
    }
    throw new Error('JSON must be an array or { resource, rows }');
  }
  // CSV (header row required)
  const lines = trimmed.split(/\r?\n/).filter((l) => l.length > 0);
  const header = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, unknown> = {};
    header.forEach((key, i) => {
      const raw = values[i] ?? '';
      row[key] = coerceCsvValue(raw);
    });
    return row;
  });
  return { resource: '', rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else if (ch === '"' && cur === '') {
      inQ = true;
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function coerceCsvValue(raw: string): unknown {
  if (raw === '') return undefined;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (raw.startsWith('[') || raw.startsWith('{')) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

export async function planImportAction(formData: FormData): Promise<ImportPlan> {
  await requireAdminAction();
  const resource = String(formData.get('resource') || '') as 'city' | 'category' | 'community';
  const text = String(formData.get('payload') || '');
  if (!['city', 'category', 'community'].includes(resource)) {
    throw new Error('Invalid resource');
  }
  const { rows } = parseRows(text);
  return planRows(resource, rows);
}

async function planRows(
  resource: 'city' | 'category' | 'community',
  rows: unknown[],
): Promise<ImportPlan> {
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
  await requireAdminAction();
  const resource = String(formData.get('resource') || '') as 'city' | 'category' | 'community';
  const text = String(formData.get('payload') || '');
  if (!['city', 'category', 'community'].includes(resource)) {
    throw new Error('Invalid resource');
  }
  const { rows } = parseRows(text);

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
        const metroId = v.metroRegionSlug
          ? (await db.city.findUnique({ where: { slug: v.metroRegionSlug }, select: { id: true } }))
              ?.id
          : null;
        const existing = await db.city.findUnique({
          where: { slug: v.slug },
          select: { id: true },
        });
        await db.city.upsert({
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
            metroRegionId: metroId,
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
            metroRegionId: metroId ?? undefined,
            timezone: v.timezone,
          },
        });
        result.rows.push({ index: i, action: existing ? 'update' : 'create', slug: v.slug });
        if (existing) result.toUpdate++;
        else result.toCreate++;
      } else if (resource === 'category') {
        const v = ImportCategory.parse(raw);
        const existing = await db.category.findUnique({
          where: { slug: v.slug },
          select: { id: true },
        });
        await db.category.upsert({
          where: { slug: v.slug },
          update: v,
          create: v,
        });
        result.rows.push({ index: i, action: existing ? 'update' : 'create', slug: v.slug });
        if (existing) result.toUpdate++;
        else result.toCreate++;
      } else {
        const v = ImportCommunity.parse(raw);
        const city = await db.city.findUnique({
          where: { slug: v.citySlug },
          select: { id: true },
        });
        if (!city) throw new Error(`Unknown city slug: ${v.citySlug}`);

        const categories = v.categorySlugs.length
          ? await db.category.findMany({
              where: { slug: { in: v.categorySlugs } },
              select: { id: true },
            })
          : [];

        const existing = await db.community.findUnique({
          where: { slug: v.slug },
          select: { id: true },
        });

        const community = await db.community.upsert({
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

        if (categories.length) {
          await db.communityCategory.deleteMany({ where: { communityId: community.id } });
          await db.communityCategory.createMany({
            data: categories.map((c) => ({ communityId: community.id, categoryId: c.id })),
            skipDuplicates: true,
          });
        }

        if (v.channels.length) {
          await db.accessChannel.deleteMany({ where: { communityId: community.id } });
          await db.accessChannel.createMany({
            data: v.channels.map((ch) => ({
              communityId: community.id,
              channelType: ch.channelType,
              url: ch.url,
              label: ch.label,
              isPrimary: ch.isPrimary,
            })),
          });
        }

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
