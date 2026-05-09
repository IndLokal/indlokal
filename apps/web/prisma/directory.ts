/**
 * Directory seed — curated, public-source community listings.
 *
 * Tier 2 of 3 (between bootstrap and demo). See
 * docs/deployment/ADMIN_AND_BOOTSTRAP.md §7 for the editorial policy.
 *
 * Purpose
 * ───────
 * Every active metro should have *some* directory content from day one so
 * city pages don't look dead. We pre-populate well-known publicly-listed
 * organisations as `UNCLAIMED` rows. When a real organiser logs in and claims
 * the listing, they take ownership and edit freely.
 *
 * Hard rules — DO NOT BEND
 * ─────────────────────────
 * 1. Public source only. Org must have a public website / Meetup page /
 *    Vereinsregister entry / official institutional listing.
 * 2. Every entry MUST have a `sourceUrl` we can point at if challenged.
 * 3. No personal data. Name + public URL + city + category. Never an
 *    organiser's personal email or phone unless it is already published on
 *    the org's own public website.
 * 4. NEVER seed events here. Events go stale and make us look wrong/dead.
 * 5. Idempotent and create-only. Existing rows are NEVER updated by this
 *    script — admin/organiser edits must survive every redeploy.
 * 6. Never invent activity scores or `lastActivityAt`. The scoring engine
 *    derives those from real signals.
 *
 * Run manually:   pnpm --filter web db:directory
 * Run on deploy:  set RUN_DIRECTORY_SEED=true (idempotent + create-only).
 */

import {
  PrismaClient,
  type ChannelType,
  type CommunityStatus,
  type ClaimState,
} from '@prisma/client';

import { runResourcesSeed, type ResourcesResult } from './resources';

const prisma = new PrismaClient();

export type DirectoryChannel = {
  channelType: ChannelType;
  url: string;
  isPrimary?: boolean;
  label?: string;
};

export type DirectoryEntry = {
  /** Unique kebab-case slug. Used as the natural key for upserts. */
  slug: string;
  name: string;
  /** 1–3 factual sentences. No marketing copy. */
  description: string;
  /** Optional longer description. Same factual standard. */
  descriptionLong?: string;
  /** City slug (must exist via bootstrap). */
  citySlug: string;
  /** At least one category slug from CATEGORY_TAXONOMY. */
  categorySlugs: string[];
  /** Persona slugs the org primarily serves. */
  personaSegments?: string[];
  /** Languages the org operates in. */
  languages?: string[];
  foundedYear?: number;
  memberCountApprox?: number;
  /** Public URL we used as evidence this org exists. REQUIRED. */
  sourceUrl: string;
  /** Public-facing channels (website, social, etc.). All must be public. */
  channels: DirectoryChannel[];
  /** Set true if editor is unsure or only one source exists. Surfaced to admins. */
  needsReview?: boolean;
};

/* ────────────────────────────────────────────────────────────────────────
 *  Stuttgart metro
 *
 *  All entries below have at least one verifiable public URL. Orgs that
 *  previously existed only with placeholder WhatsApp links have been
 *  dropped — add them back when a real public source becomes available.
 * ──────────────────────────────────────────────────────────────────────── */

const STUTTGART: DirectoryEntry[] = [
  {
    slug: 'hss-stuttgart',
    name: 'HSS Stuttgart',
    description:
      'Hindu Swayamsevak Sangh Stuttgart — weekly shakha, festivals and cultural programs for the Hindu community.',
    descriptionLong:
      'HSS Stuttgart is one of the most active Hindu cultural organisations in Baden-Württemberg. Weekly Sunday shakhas, Diwali and Holi celebrations, family camps.',
    citySlug: 'stuttgart',
    categorySlugs: ['cultural', 'religious'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Hindi', 'English', 'Gujarati'],
    foundedYear: 2005,
    memberCountApprox: 250,
    sourceUrl: 'https://hssgermany.org/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://hssgermany.org/', isPrimary: true, label: 'Website' },
      { channelType: 'INSTAGRAM', url: 'https://instagram.com/hssgermany/', label: 'Instagram' },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/hssdeutschland/',
        label: 'Facebook',
      },
    ],
  },
  {
    slug: 'telugu-association-bw',
    name: 'Samaikya Telugu Vedika e.V. (STV)',
    description:
      'Registered Verein for Telugu-speaking families in Baden-Württemberg — Ugadi, Sankranti, and regular meetups.',
    descriptionLong:
      'Samaikya Telugu Vedika (STV) e.V. brings together Telugu-speaking professionals and families across Stuttgart and the surrounding region. Major events include Ugadi and Sankranti.',
    citySlug: 'stuttgart',
    categorySlugs: ['language-regional', 'cultural'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Telugu', 'English'],
    foundedYear: 2010,
    memberCountApprox: 320,
    sourceUrl: 'https://stvgermany.de/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://stvgermany.de/', isPrimary: true, label: 'Website' },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/groups/stvgermany/',
        label: 'Facebook Group',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/@samaikyateluguvedika239',
        label: 'YouTube',
      },
    ],
  },
  {
    slug: 'tamil-sangam-stuttgart',
    name: 'Tamil Sangam Stuttgart',
    description:
      'Cultural association for the Tamil-speaking community in Stuttgart — Tamil New Year, Pongal, and language classes for children.',
    citySlug: 'stuttgart',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Tamil', 'English'],
    foundedYear: 2008,
    memberCountApprox: 180,
    sourceUrl: 'https://facebook.com/TamilSangamStuttgart',
    channels: [
      {
        channelType: 'FACEBOOK',
        url: 'https://facebook.com/TamilSangamStuttgart',
        isPrimary: true,
        label: 'Facebook Page',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'indians-in-stuttgart',
    name: 'Indians in Stuttgart',
    description:
      'Open social community for all Indians in Stuttgart — meetups, newcomer help, restaurant recommendations and city guides.',
    citySlug: 'stuttgart',
    categorySlugs: ['networking-social'],
    personaSegments: ['newcomer', 'working-professional', 'single'],
    languages: ['Hindi', 'English'],
    foundedYear: 2012,
    memberCountApprox: 1200,
    sourceUrl: 'https://facebook.com/groups/IndiansinStuttgart',
    channels: [
      {
        channelType: 'FACEBOOK',
        url: 'https://facebook.com/groups/IndiansinStuttgart',
        isPrimary: true,
        label: 'Facebook Group',
      },
      {
        channelType: 'MEETUP',
        url: 'https://meetup.com/indians-in-stuttgart',
        label: 'Meetup.com',
      },
    ],
  },
  {
    slug: 'ipn-stuttgart',
    name: 'Indian Professionals Network Stuttgart',
    description:
      'Professional networking for Indian engineers, managers, and entrepreneurs in Stuttgart and the automotive corridor.',
    citySlug: 'stuttgart',
    categorySlugs: ['professional', 'networking-social'],
    personaSegments: ['working-professional'],
    languages: ['English', 'Hindi'],
    foundedYear: 2016,
    memberCountApprox: 420,
    sourceUrl: 'https://linkedin.com/groups/ipn-stuttgart',
    channels: [
      {
        channelType: 'LINKEDIN',
        url: 'https://linkedin.com/groups/ipn-stuttgart',
        isPrimary: true,
        label: 'LinkedIn Group',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'kannada-koota-stuttgart',
    name: 'Kasturi Kannada Koota Stuttgart',
    description:
      "Kannada Rajyotsava, Yugadi and cultural events for the Kannada-speaking community in Stuttgart's tech and auto sectors.",
    citySlug: 'stuttgart',
    categorySlugs: ['language-regional', 'cultural'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Kannada', 'English'],
    foundedYear: 2014,
    memberCountApprox: 140,
    sourceUrl: 'https://www.facebook.com/groups/kasturikannadakootastuttgart/',
    channels: [
      {
        channelType: 'INSTAGRAM',
        url: 'https://instagram.com/kasturikannadakootastuttgart/',
        isPrimary: true,
        label: 'Instagram',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/groups/kasturikannadakootastuttgart/',
        label: 'Facebook Group',
      },
    ],
  },
  {
    slug: 'indian-students-stuttgart',
    name: 'Indian Students Stuttgart',
    description:
      'Community for Indian students at University of Stuttgart and HFT — orientation help, study groups, housing tips and social events.',
    citySlug: 'stuttgart',
    categorySlugs: ['student', 'networking-social'],
    personaSegments: ['persona-student', 'newcomer'],
    languages: ['Hindi', 'English', 'Telugu'],
    foundedYear: 2018,
    memberCountApprox: 380,
    sourceUrl: 'https://instagram.com/indianstudentsstuttgart',
    channels: [
      {
        channelType: 'INSTAGRAM',
        url: 'https://instagram.com/indianstudentsstuttgart',
        isPrimary: true,
        label: 'Instagram',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'indian-film-festival-stuttgart',
    name: 'Indian Film Festival Stuttgart Community',
    description:
      'Community around the annual Indian Film Festival Stuttgart (22+ years running). Year-round film screenings, discussions and filmmaker meetups.',
    citySlug: 'stuttgart',
    categorySlugs: ['arts-entertainment', 'cultural'],
    personaSegments: ['working-professional', 'single', 'persona-student'],
    languages: ['English', 'Hindi'],
    foundedYear: 2003,
    memberCountApprox: 200,
    sourceUrl: 'https://indisches-filmfestival.de',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://indisches-filmfestival.de',
        isPrimary: true,
        label: 'Official Website',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://instagram.com/indianfilmfestival',
        label: 'Instagram',
      },
    ],
  },
  {
    slug: 'bihar-fraternity-stuttgart',
    name: 'Bihar Fraternity Stuttgart',
    description:
      'Bihari community in Stuttgart celebrating festivals like Makar Sankranti and Chhath Puja. Part of the Bharatiya Parivar umbrella of 24 Vereine.',
    citySlug: 'stuttgart',
    categorySlugs: ['cultural', 'language-regional'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Hindi', 'Bhojpuri', 'Maithili'],
    sourceUrl: 'https://www.instagram.com/stuttgartbiharfraternity/',
    channels: [
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/stuttgartbiharfraternity/',
        isPrimary: true,
      },
      { channelType: 'FACEBOOK', url: 'https://www.facebook.com/groups/bihariingermany/' },
    ],
  },
  {
    slug: 'ezenz-ev',
    name: 'Ezenz e.V.',
    description:
      'EZENZ — Einheit in Zivilisatorischen wErten uNd Zusammenarbeit. Indo-German cultural dialogue organisation.',
    citySlug: 'stuttgart',
    categorySlugs: ['cultural', 'networking-social'],
    personaSegments: ['working-professional', 'family'],
    languages: ['Hindi', 'German'],
    sourceUrl: 'https://www.instagram.com/ezenz.ev/',
    channels: [
      { channelType: 'INSTAGRAM', url: 'https://www.instagram.com/ezenz.ev/', isPrimary: true },
      { channelType: 'FACEBOOK', url: 'https://www.facebook.com/Ezenz.de/' },
    ],
  },
  {
    slug: 'icf-ev-stuttgart',
    name: 'India Culture Forum e.V. (ICF)',
    description:
      'One of the oldest Indian Vereine in Germany, registered in Stuttgart since 2006. Promotes Indian culture through Diwali, Navaratri, and Summerfest.',
    citySlug: 'stuttgart',
    categorySlugs: ['cultural', 'arts-entertainment'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Hindi', 'German'],
    foundedYear: 2006,
    memberCountApprox: 200,
    sourceUrl: 'https://indiacultureforum.de/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://indiacultureforum.de/', isPrimary: true },
      { channelType: 'INSTAGRAM', url: 'https://www.instagram.com/icfev/' },
      { channelType: 'FACEBOOK', url: 'https://www.facebook.com/icfev/' },
      { channelType: 'YOUTUBE', url: 'https://www.youtube.com/@indiacultureforum' },
    ],
  },
  {
    slug: 'samvaad-germany',
    name: 'SAMVAAD Germany',
    description:
      'Focused on integration of Indian families in Germany. Organises open dialogues on German schooling, career pathways, and Indo-German relations.',
    citySlug: 'stuttgart',
    categorySlugs: ['networking-social', 'cultural'],
    personaSegments: ['family', 'working-professional', 'newcomer'],
    languages: ['Hindi', 'German', 'English'],
    sourceUrl: 'https://www.samvadgermany.org/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://www.samvadgermany.org/', isPrimary: true },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/people/Samvad-Germany/100068660136672/',
      },
    ],
  },
  {
    slug: 'bindi-ev-stuttgart',
    name: 'Bindi e.V.',
    description:
      'BINDI: Bengalische Indische und Deutsche Initiative — Bengali/Indian cultural organisation since 2015. Durga Puja, Bengali Borshoboron, and cultural events.',
    citySlug: 'stuttgart',
    categorySlugs: ['cultural', 'language-regional'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Bengali', 'German'],
    foundedYear: 2015,
    sourceUrl: 'https://bindi-ev.org/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://bindi-ev.org/', isPrimary: true },
      { channelType: 'INSTAGRAM', url: 'https://www.instagram.com/bindi.ev/' },
      { channelType: 'FACEBOOK', url: 'https://www.facebook.com/100070137490845/' },
    ],
  },
  {
    slug: 'maitree-ev-esslingen',
    name: 'Maitree e.V.',
    description:
      'Indian Bengali community in Esslingen/Stuttgart area. Organises Stuttgart Sarbojonin Durga Puja, Saraswati Puja, and cultural integration events.',
    citySlug: 'esslingen',
    categorySlugs: ['cultural', 'language-regional', 'religious'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Bengali', 'German'],
    sourceUrl: 'https://maitree-ev.org/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://maitree-ev.org/', isPrimary: true },
      { channelType: 'INSTAGRAM', url: 'https://www.instagram.com/maitree.ev/' },
      { channelType: 'FACEBOOK', url: 'https://www.facebook.com/MaitreeStuttgart/' },
      { channelType: 'YOUTUBE', url: 'https://www.youtube.com/@maitree_ev' },
    ],
  },
  {
    slug: 'debi-ev-stuttgart',
    name: 'DeBI e.V.',
    description:
      'A group of expatriate Bengalis fostering Bengali culture and heritage in Germany. Known for Durga Pujo in Stuttgart and music events.',
    citySlug: 'stuttgart',
    categorySlugs: ['cultural', 'language-regional', 'arts-entertainment'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Bengali', 'German'],
    sourceUrl: 'https://www.debiev.de/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://www.debiev.de/', isPrimary: true },
      { channelType: 'INSTAGRAM', url: 'https://www.instagram.com/debi_ev/' },
      { channelType: 'FACEBOOK', url: 'https://www.facebook.com/61555151894316/' },
    ],
  },
  {
    slug: 'sindelfingen-squirrels-cricket',
    name: 'Sindelfingen Squirrels e.V.',
    description:
      'Cricket club in Sindelfingen playing in BW Landesliga. Active in tape-ball and leather-ball cricket with youth programs.',
    citySlug: 'sindelfingen',
    categorySlugs: ['sports-fitness'],
    personaSegments: ['working-professional', 'single'],
    languages: ['English', 'Hindi'],
    sourceUrl: 'https://squirrels.de/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://squirrels.de/', isPrimary: true },
      { channelType: 'FACEBOOK', url: 'https://www.facebook.com/SindelfingenSquirrels/' },
    ],
  },
  {
    slug: 'indians-in-the-laend',
    name: 'Indians in The Länd',
    description:
      'BW-wide informal community for Indians living, studying, or working across Baden-Württemberg.',
    citySlug: 'stuttgart',
    categorySlugs: ['networking-social'],
    personaSegments: ['newcomer', 'working-professional'],
    languages: ['Hindi', 'English', 'German'],
    sourceUrl: 'https://www.facebook.com/groups/1393064338860177/',
    channels: [
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/groups/1393064338860177/',
        isPrimary: true,
      },
    ],
    needsReview: true,
  },
  {
    slug: 'german-tamil-sangam',
    name: 'German Tamil Sangam e.V.',
    description:
      'Fosters Tamil art, culture, language and heritage. Runs a Tamil Academy for children. Registered at Amtsgericht Stuttgart, based in Böblingen.',
    citySlug: 'boeblingen',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Tamil', 'German'],
    sourceUrl: 'https://tamilsangam.de/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://tamilsangam.de/', isPrimary: true },
      { channelType: 'FACEBOOK', url: 'https://www.facebook.com/103474994944223/' },
      { channelType: 'YOUTUBE', url: 'https://www.youtube.com/c/GermanTamilSangam' },
    ],
  },
  {
    slug: 'tsvm-cricket-stuttgart',
    name: 'TSVM Cricket Stuttgart (Cricket Vision Campus)',
    description:
      'Professional cricket club in Malmsheim (Landkreis Böblingen), est. 2019. Cricket Vision Campus initiative for skilled-worker integration through cricket.',
    citySlug: 'stuttgart',
    categorySlugs: ['sports-fitness'],
    personaSegments: ['working-professional', 'single'],
    languages: ['English', 'Hindi'],
    foundedYear: 2019,
    sourceUrl: 'https://cricket.tsv-malmsheim.de/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://cricket.tsv-malmsheim.de/', isPrimary: true },
      { channelType: 'FACEBOOK', url: 'https://www.facebook.com/Malmsheimcricket/' },
      { channelType: 'YOUTUBE', url: 'https://www.youtube.com/@TSVMalmsheimCricket' },
      { channelType: 'LINKEDIN', url: 'https://de.linkedin.com/company/tsv-malmsheim-cricket' },
    ],
  },
  {
    slug: 'heilbronn-kannada-balaga',
    name: 'Heilbronn Kannada Balaga e.V.',
    description:
      'Registered Kannada community organisation in the Heilbronn / Stuttgart region. Registered at Amtsgericht Stuttgart, VR 727543.',
    // Heilbronn is in the wider BW region; we attach to stuttgart metro until a
    // dedicated Heilbronn city row is added.
    citySlug: 'stuttgart',
    categorySlugs: ['language-regional', 'cultural'],
    personaSegments: ['family'],
    languages: ['Kannada', 'German'],
    // Vereinsregister entry is the only public source we have.
    sourceUrl: 'https://www.handelsregister.de/',
    channels: [],
    needsReview: true,
  },
];

const KARLSRUHE: DirectoryEntry[] = [
  // TODO: Add curated entries. Suggested anchors (verify URLs first):
  //   - Indian Students Association at KIT
  //   - Tamil Sangam Karlsruhe (if active)
  //   - Local Indo-German Society chapter
];

const MANNHEIM: DirectoryEntry[] = [
  // TODO: Add curated entries. Suggested anchors (verify URLs first):
  //   - Indian Students Association — University of Mannheim
  //   - Indian Students Association — Heidelberg University (counts under metro)
  //   - Hindu temple / cultural Vereine in the Rhein-Neckar region
];

const MUNICH: DirectoryEntry[] = [
  // TODO: Add curated entries. Suggested anchors (verify URLs first):
  //   - Indian Students Association — TUM
  //   - Indian Students Association — LMU
  //   - ISKCON München / Hindu temples (public)
  //   - Bavarian Indian Business / professional associations
  //   - Indo-German Society München chapter
];

const FRANKFURT: DirectoryEntry[] = [
  // TODO: Add curated entries. Suggested anchors (verify URLs first):
  //   - Indo-German Society Frankfurt chapter
  //   - Hindu Mandir Frankfurt
  //   - Indian Students Association — Goethe University
  //   - Indian Professionals Frankfurt (banking/finance niche)
];

export const METRO_DIRECTORIES: Record<string, DirectoryEntry[]> = {
  stuttgart: STUTTGART,
  karlsruhe: KARLSRUHE,
  mannheim: MANNHEIM,
  munich: MUNICH,
  frankfurt: FRANKFURT,
};

/* ────────────────────────────────────────────────────────────────────────
 *  Reconciler
 * ──────────────────────────────────────────────────────────────────────── */

export type DirectoryResult = {
  perMetro: Record<string, { skippedExisting: number; created: number }>;
  totalCreated: number;
  totalSkipped: number;
  resources: ResourcesResult;
};

async function insertEntry(
  entry: DirectoryEntry,
  cityIdBySlug: Map<string, string>,
  categoryIdBySlug: Map<string, string>,
) {
  const cityId = cityIdBySlug.get(entry.citySlug);
  if (!cityId) {
    console.warn(
      `  ⚠ ${entry.slug}: city "${entry.citySlug}" not found (run bootstrap?) — skipped`,
    );
    return { created: false };
  }

  // Create-only. If a row with this slug already exists we leave it alone.
  const existing = await prisma.community.findUnique({
    where: { slug: entry.slug },
    select: { id: true },
  });
  if (existing) return { created: false };

  const community = await prisma.community.create({
    data: {
      slug: entry.slug,
      name: entry.name,
      description: entry.description,
      descriptionLong: entry.descriptionLong,
      cityId,
      personaSegments: entry.personaSegments ?? [],
      languages: entry.languages ?? [],
      foundedYear: entry.foundedYear,
      memberCountApprox: entry.memberCountApprox,
      status: 'UNVERIFIED' satisfies CommunityStatus,
      claimState: 'UNCLAIMED' satisfies ClaimState,
      source: 'ADMIN_SEED',
      metadata: {
        editorialSource: 'directory-seed',
        sourceUrl: entry.sourceUrl,
        seededAt: new Date().toISOString(),
        needsReview: entry.needsReview ?? false,
      },
    },
  });

  for (const channel of entry.channels) {
    await prisma.accessChannel.create({
      data: {
        communityId: community.id,
        channelType: channel.channelType,
        url: channel.url,
        label: channel.label,
        isPrimary: channel.isPrimary ?? false,
        isVerified: false,
      },
    });
  }

  for (const slug of entry.categorySlugs) {
    const categoryId = categoryIdBySlug.get(slug);
    if (!categoryId) {
      console.warn(`  ⚠ Unknown category "${slug}" on ${entry.slug} — skipped`);
      continue;
    }
    await prisma.communityCategory.create({
      data: { communityId: community.id, categoryId },
    });
  }

  return { created: true };
}

export async function runDirectorySeed(): Promise<DirectoryResult> {
  const result: DirectoryResult = {
    perMetro: {},
    totalCreated: 0,
    totalSkipped: 0,
    resources: { created: 0, skippedExisting: 0, skippedMissingCity: 0 },
  };

  const cities = await prisma.city.findMany({ select: { id: true, slug: true } });
  const cityIdBySlug = new Map(cities.map((c) => [c.slug, c.id]));

  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  for (const [metroSlug, entries] of Object.entries(METRO_DIRECTORIES)) {
    const tally = { skippedExisting: 0, created: 0 };
    for (const entry of entries) {
      try {
        const { created } = await insertEntry(entry, cityIdBySlug, categoryIdBySlug);
        if (created) tally.created++;
        else tally.skippedExisting++;
      } catch (err) {
        console.error(`  ❌ Failed to seed ${entry.slug}:`, err);
      }
    }
    result.perMetro[metroSlug] = tally;
    result.totalCreated += tally.created;
    result.totalSkipped += tally.skippedExisting;
  }

  // Resources are part of the same editorial tier — same hard rules,
  // same create-only / idempotent contract. One env flag, one build step.
  result.resources = await runResourcesSeed();

  return result;
}

async function main() {
  console.log('📒 IndLokal directory seed — curated public listings\n');
  const started = Date.now();
  const r = await runDirectorySeed();
  const ms = Date.now() - started;
  console.log(`\n✅ Directory seed complete in ${ms}ms`);
  for (const [metro, tally] of Object.entries(r.perMetro)) {
    console.log(
      `   ${metro.padEnd(12)} created ${tally.created}, skipped ${tally.skippedExisting} (already present)`,
    );
  }
  console.log(`   ─── totals: ${r.totalCreated} new community rows, ${r.totalSkipped} preserved`);
  console.log(
    `   resources    created ${r.resources.created}, skipped ${r.resources.skippedExisting} (already present)${r.resources.skippedMissingCity ? `, ${r.resources.skippedMissingCity} missing city` : ''}\n`,
  );
}

const isDirectRun =
  typeof require !== 'undefined' && require.main === module
    ? true
    : process.argv[1]?.endsWith('directory.ts') || process.argv[1]?.endsWith('directory.js');

if (isDirectRun) {
  main()
    .catch((e) => {
      console.error('❌ Directory seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
