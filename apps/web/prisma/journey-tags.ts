/**
 * Journey tagging seed — PRD/TDD-0052 (depends on PRD/TDD-0053 tagging ops).
 *
 * The Journey Layer composes over EXISTING resources filtered by
 * `Resource.audiences[]` × `Resource.lifecycleStage[]`. Most curated resources
 * ship without these tags, so the first journey (Stuttgart × Young Family)
 * would render empty. This script back-fills audience + lifecycle tags on a
 * curated set of family-relevant resources so the journey clears its density
 * gate (≥2 blocks in each non-empty stage, ≥6 total, PRE_ARRIVAL +
 * FIRST_30_DAYS present).
 *
 * Idempotent: it SETS (replaces) audiences/lifecycleStage by slug via
 * updateMany, so re-running converges to the same state. Unlike resources.ts
 * (create-only), this script intentionally updates existing rows — it only
 * touches the two journey-tag columns, never editorial content.
 *
 * Run manually:  pnpm --filter web db:journey-tags
 */
import { PrismaClient, type ResourceAudience, type ResourceStage } from '@prisma/client';

const prisma = new PrismaClient();

interface TagPlan {
  slug: string;
  audiences: ResourceAudience[];
  lifecycleStage: ResourceStage[];
}

/**
 * Stuttgart × Young Family. Resources are placed in the EARLIEST stage they
 * carry (see modules/journeys/compose.ts), so each row gets a single stage to
 * keep the journey clean and the distribution predictable.
 */
const FAMILY_TAGS: TagPlan[] = [
  // PRE_ARRIVAL — decisions and paperwork from India
  {
    slug: 'guide-family-reunion-visa',
    audiences: ['FAMILY', 'NEWCOMER'],
    lifecycleStage: ['PRE_ARRIVAL'],
  },
  {
    slug: 'guide-apartment-search-stuttgart',
    audiences: ['FAMILY', 'NEWCOMER', 'EMPLOYEE'],
    lifecycleStage: ['PRE_ARRIVAL'],
  },
  // FIRST_30_DAYS — the unlocking essentials
  {
    slug: 'guide-anmeldung-stuttgart',
    audiences: ['FAMILY', 'NEWCOMER'],
    lifecycleStage: ['FIRST_30_DAYS'],
  },
  {
    slug: 'guide-health-insurance-gkv-pkv',
    audiences: ['FAMILY', 'NEWCOMER'],
    lifecycleStage: ['FIRST_30_DAYS'],
  },
  {
    slug: 'guide-kindergeld-non-eu',
    audiences: ['FAMILY'],
    lifecycleStage: ['FIRST_30_DAYS'],
  },
  // FIRST_90_DAYS — settling in (joins communities + events in this stage)
  {
    slug: 'guide-kita-kindergarten-stuttgart',
    audiences: ['FAMILY'],
    lifecycleStage: ['FIRST_90_DAYS'],
  },
  {
    slug: 'guide-finding-hausarzt-stuttgart',
    audiences: ['FAMILY', 'NEWCOMER'],
    lifecycleStage: ['FIRST_90_DAYS'],
  },
  // SETTLED — building a longer-term life
  {
    slug: 'guide-school-enrollment-stuttgart',
    audiences: ['FAMILY'],
    lifecycleStage: ['SETTLED'],
  },
  {
    slug: 'guide-elterngeld-parental-allowance',
    audiences: ['FAMILY'],
    lifecycleStage: ['SETTLED'],
  },
  {
    slug: 'guide-indian-groceries-stuttgart',
    audiences: ['FAMILY'],
    lifecycleStage: ['SETTLED'],
  },
];

export async function runJourneyTagsSeed(): Promise<{ updated: number; missing: string[] }> {
  let updated = 0;
  const missing: string[] = [];

  for (const plan of FAMILY_TAGS) {
    const res = await prisma.resource.updateMany({
      where: { slug: plan.slug },
      data: { audiences: plan.audiences, lifecycleStage: plan.lifecycleStage },
    });
    if (res.count === 0) {
      missing.push(plan.slug);
    } else {
      updated += res.count;
    }
  }

  return { updated, missing };
}

async function main() {
  console.log('🧭 IndLokal journey tags seed — Stuttgart × Young Family\n');
  const { updated, missing } = await runJourneyTagsSeed();
  console.log(`✅ Journey tags applied: ${updated} resource row(s) updated.`);
  if (missing.length > 0) {
    console.warn(
      `⚠ ${missing.length} slug(s) not found (seed resources first): ${missing.join(', ')}`,
    );
  }
}

// Only run when invoked directly (not when imported by other seeds/tests).
if (process.argv[1] && process.argv[1].endsWith('journey-tags.ts')) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
