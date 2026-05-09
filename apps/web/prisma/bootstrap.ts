/**
 * Bootstrap seed — REQUIRED reference data only.
 *
 * Idempotent. Safe to run on every deploy. Reads from the single source of
 * truth at src/lib/config/cities.ts so there is no duplicate city/category
 * data anywhere in the codebase.
 *
 * Seeds:
 *   - All metro + satellite cities defined in ACTIVE_CITY_DATA / SATELLITE_CITY_DATA
 *   - All categories + personas defined in CATEGORY_TAXONOMY / PERSONA_TAXONOMY
 *   - The platform admin user (email from ADMIN_EMAIL env, default admin@indlokal.de)
 *
 * Run manually:   pnpm --filter web db:bootstrap
 * Run on deploy:  set RUN_BOOTSTRAP_SEED=true in Vercel env (build script
 *                 invokes scripts/maybe-bootstrap.cjs which calls this).
 */

import { PrismaClient } from '@prisma/client';
import {
  ACTIVE_CITY_DATA,
  SATELLITE_CITY_DATA,
  CATEGORY_TAXONOMY,
  PERSONA_TAXONOMY,
  type CitySeed,
} from '../src/lib/config/cities';

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = 'admin@indlokal.de';

export type BootstrapResult = {
  cities: { created: number; updated: number; total: number };
  categories: { created: number; updated: number; total: number };
  personas: { created: number; updated: number; total: number };
  admin: { email: string; created: boolean };
};

async function upsertCity(c: CitySeed, metroIdBySlug: Map<string, string>) {
  const metroId = c.metroSlug ? (metroIdBySlug.get(c.metroSlug) ?? null) : null;
  const existing = await prisma.city.findUnique({
    where: { slug: c.slug },
    select: { id: true },
  });

  // Structural fields — safe to reconcile on every bootstrap run. These are
  // identity / wiring fields; the TS config is authoritative for them.
  const structural = {
    name: c.name,
    state: c.state,
    country: c.country ?? 'Germany',
    latitude: c.latitude,
    longitude: c.longitude,
    isActive: c.isActive,
    isMetroPrimary: c.isMetroPrimary,
    metroRegionId: metroId,
    timezone: c.timezone ?? 'Europe/Berlin',
  };

  // Editorial fields — admins may tweak these via /admin/data/cities. We only
  // set them on initial create, then leave them alone so bootstrap never
  // clobbers admin edits.
  const editorialOnCreate = {
    population: c.population ?? null,
    diasporaDensityEstimate: c.diasporaDensityEstimate ?? null,
  };

  const row = await prisma.city.upsert({
    where: { slug: c.slug },
    update: structural,
    create: {
      slug: c.slug,
      ...structural,
      ...editorialOnCreate,
      metroRegionId: metroId ?? undefined,
    },
  });
  return { row, existing: !!existing };
}

export async function runBootstrap(): Promise<BootstrapResult> {
  const result: BootstrapResult = {
    cities: { created: 0, updated: 0, total: 0 },
    categories: { created: 0, updated: 0, total: 0 },
    personas: { created: 0, updated: 0, total: 0 },
    admin: { email: '', created: false },
  };

  // 1) Metros first so satellites can reference them.
  const metroIdBySlug = new Map<string, string>();
  for (const m of ACTIVE_CITY_DATA) {
    const { row, existing } = await upsertCity(m, metroIdBySlug);
    metroIdBySlug.set(m.slug, row.id);
    if (existing) result.cities.updated++;
    else result.cities.created++;
  }

  // 2) Satellites.
  for (const s of SATELLITE_CITY_DATA) {
    const { existing } = await upsertCity(s, metroIdBySlug);
    if (existing) result.cities.updated++;
    else result.cities.created++;
  }
  result.cities.total = ACTIVE_CITY_DATA.length + SATELLITE_CITY_DATA.length;

  // 3) Categories.
  for (const c of CATEGORY_TAXONOMY) {
    const existing = await prisma.category.findUnique({
      where: { slug: c.slug },
      select: { id: true },
    });
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, type: 'CATEGORY', icon: c.icon, sortOrder: c.sortOrder },
      create: {
        name: c.name,
        slug: c.slug,
        type: 'CATEGORY',
        icon: c.icon,
        sortOrder: c.sortOrder,
      },
    });
    if (existing) result.categories.updated++;
    else result.categories.created++;
  }
  result.categories.total = CATEGORY_TAXONOMY.length;

  // 4) Personas.
  for (const p of PERSONA_TAXONOMY) {
    const existing = await prisma.category.findUnique({
      where: { slug: p.slug },
      select: { id: true },
    });
    await prisma.category.upsert({
      where: { slug: p.slug },
      update: { name: p.name, type: 'PERSONA', icon: p.icon, sortOrder: p.sortOrder },
      create: {
        name: p.name,
        slug: p.slug,
        type: 'PERSONA',
        icon: p.icon,
        sortOrder: p.sortOrder,
      },
    });
    if (existing) result.personas.updated++;
    else result.personas.created++;
  }
  result.personas.total = PERSONA_TAXONOMY.length;

  // 5) Platform admin user — login uses magic-link to this email address.
  const adminEmail = (process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'PLATFORM_ADMIN' },
    create: {
      email: adminEmail,
      displayName: 'IndLokal Admin',
      role: 'PLATFORM_ADMIN',
    },
  });
  result.admin = { email: adminEmail, created: !existingAdmin };

  return result;
}

async function main() {
  console.log('🚀 IndLokal bootstrap — required reference data only');
  const started = Date.now();
  const r = await runBootstrap();
  const ms = Date.now() - started;
  console.log(
    `\n✅ Bootstrap complete in ${ms}ms\n` +
      `   Cities:     ${r.cities.total} (created ${r.cities.created}, updated ${r.cities.updated})\n` +
      `   Categories: ${r.categories.total} (created ${r.categories.created}, updated ${r.categories.updated})\n` +
      `   Personas:   ${r.personas.total} (created ${r.personas.created}, updated ${r.personas.updated})\n` +
      `   Admin user: ${r.admin.email} ${r.admin.created ? '(created)' : '(already existed, role enforced)'}`,
  );
  console.log(
    `\n👉 To log in, go to /admin/login, enter ${r.admin.email}, and click the magic link sent to that inbox.`,
  );
  console.log('   Local dev: emails are captured by Mailpit at http://localhost:8026');
  console.log('   Production: requires RESEND_API_KEY + RESEND_FROM_EMAIL set in Vercel env.\n');
}

const isDirectRun =
  typeof require !== 'undefined' && require.main === module
    ? true
    : process.argv[1]?.endsWith('bootstrap.ts') || process.argv[1]?.endsWith('bootstrap.js');

if (isDirectRun) {
  main()
    .catch((e) => {
      console.error('❌ Bootstrap failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
