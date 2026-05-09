/**
 * Database seed script for IndLokal.
 *
 * Seeds Stuttgart as the launch city, all categories,
 * real known Stuttgart communities, access channels, and
 * a realistic spread of events (past / this-week / upcoming).
 *
 * Run: npm run db:seed
 * Reset + reseed: ./dev.sh db:reset
 */

import { PrismaClient } from '@prisma/client';
import { subDays, addDays, setHours, setMinutes } from 'date-fns';
import { refreshAllScores } from '../src/modules/scoring/scoring';
import { runBootstrap } from './bootstrap';
import { runDirectorySeed } from './directory';

const prisma = new PrismaClient();

// Helpers — produces clean event dates
const past = (daysAgo: number, hour = 18) =>
  setMinutes(setHours(subDays(new Date(), daysAgo), hour), 0);
const future = (daysAhead: number, hour = 18) =>
  setMinutes(setHours(addDays(new Date(), daysAhead), hour), 0);

async function main() {
  console.log('🌱 Seeding IndLokal database (demo content)...\n');

  // ─── 1) Required reference data via the single bootstrap path ──────────
  // (Cities, Categories, Personas, Admin user. All idempotent.)
  await runBootstrap();
  console.log('✅ Bootstrap reference data ensured.\n');

  // ─── 2) Curated public directory listings (create-only, never updates) ─
  await runDirectorySeed();
  console.log('✅ Directory seed applied.\n');

  // Look up IDs the demo content needs.
  const stuttgart = await prisma.city.findUniqueOrThrow({ where: { slug: 'stuttgart' } });
  const categoryRows = await prisma.category.findMany({ where: { type: 'CATEGORY' } });
  const cats: Record<string, string> = Object.fromEntries(categoryRows.map((c) => [c.slug, c.id]));

  // Communities are seeded by directory.ts (called via runDirectorySeed above).
  // The demo seed only references them by slug to attach events / signals.
  const allCommunities = await prisma.community.findMany({
    select: { id: true, slug: true },
  });
  const communityIds: Record<string, string> = Object.fromEntries(
    allCommunities.map((c) => [c.slug, c.id]),
  );
  console.log(`✅ Communities (from directory): ${allCommunities.length} available\n`);

  // ─── Events (demo-only — synthetic dates for activity scoring) ──────────

  const eventDefs = [
    // ── Past events (activity signals for scoring) ──
    {
      title: 'Holi Milan 2026',
      slug: 'holi-milan-stuttgart-2026',
      description:
        'Annual Holi colour festival at Killesbergpark — organic colours, music and food stalls. Families welcome.',
      communitySlug: 'hss-stuttgart',
      venueName: 'Killesbergpark Stuttgart',
      venueAddress: 'Stresemannstr. 4, 70191 Stuttgart',
      startsAt: past(30, 14),
      endsAt: past(30, 18),
      cost: 'free',
      status: 'PAST' as const,
      categories: ['cultural', 'family-kids'],
    },
    {
      title: 'Ugadi Celebrations 2026',
      slug: 'ugadi-telugu-bw-2026',
      description:
        'Telugu New Year celebration with traditional pachadi, cultural performances and community dinner.',
      communitySlug: 'telugu-association-bw',
      venueName: 'Gemeindezentrum Stuttgart-Nord',
      venueAddress: 'Nordbahnhofstr. 12, 70191 Stuttgart',
      startsAt: past(14, 17),
      endsAt: past(14, 21),
      cost: 'paid',
      status: 'PAST' as const,
      categories: ['cultural', 'language-regional'],
    },
    {
      title: 'ISS Orientation Day — Summer 2026',
      slug: 'iss-orientation-summer-2026',
      description:
        'Welcome session for new Indian students joining Stuttgart universities in the summer semester. Campus tour, housing Q&A, SIM cards help.',
      communitySlug: 'indian-students-stuttgart',
      venueName: 'University of Stuttgart — Pfaffenwaldring Campus',
      venueAddress: 'Pfaffenwaldring 57, 70569 Stuttgart',
      startsAt: past(20, 10),
      endsAt: past(20, 14),
      cost: 'free',
      status: 'PAST' as const,
      categories: ['student'],
    },
    {
      title: 'Indians in Stuttgart — March Social',
      slug: 'indians-stuttgart-march-social-2026',
      description:
        'Monthly social at Bidda Bar, Stuttgart Mitte. Open to all Indians — no registration needed, just show up!',
      communitySlug: 'indians-in-stuttgart',
      venueName: 'Bidda Bar Stuttgart',
      venueAddress: 'Lautenschlagerstr. 20, 70173 Stuttgart',
      startsAt: past(18, 19),
      endsAt: past(18, 23),
      cost: 'free',
      status: 'PAST' as const,
      categories: ['networking-social'],
    },
    {
      title: 'IPN Stuttgart — Automotive Career Panel',
      slug: 'ipn-automotive-career-panel-2026',
      description:
        'Indian professionals at Bosch, Mercedes, Porsche share career insights for the Stuttgart automotive corridor. Networking drinks after.',
      communitySlug: 'ipn-stuttgart',
      venueName: 'IHK Stuttgart',
      venueAddress: 'Jägerstr. 30, 70174 Stuttgart',
      startsAt: past(35, 18),
      endsAt: past(35, 21),
      cost: 'free',
      status: 'PAST' as const,
      categories: ['professional', 'networking-social'],
    },

    // ── This week ──
    {
      title: 'Tamil New Year (Puthandu) Celebration 2026',
      slug: 'tamil-new-year-puthandu-2026',
      description:
        'Tamil Sangam Stuttgart celebrates Puthandu with traditional kolam, classical music and a community feast. All welcome.',
      communitySlug: 'tamil-sangam-stuttgart',
      venueName: 'Gemeindesaal Zuffenhausen',
      venueAddress: 'Stadtbibliothekstr. 2, 70435 Stuttgart',
      startsAt: future(1, 17),
      endsAt: future(1, 21),
      cost: 'paid',
      status: 'UPCOMING' as const,
      categories: ['cultural', 'language-regional', 'family-kids'],
    },
    {
      title: 'HSS Stuttgart — Weekly Shakha',
      slug: 'hss-weekly-shakha-apr-2026',
      description:
        'Weekly Sunday shakha open to all Hindus — yoga, patriotic songs and community activities. Families and children welcome.',
      communitySlug: 'hss-stuttgart',
      venueName: 'Sportplatz Vaihingen',
      venueAddress: 'Rosenaustr. 4, 70569 Stuttgart',
      startsAt: future(3, 9),
      endsAt: future(3, 11),
      cost: 'free',
      status: 'UPCOMING' as const,
      isRecurring: true,
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=SU',
      categories: ['cultural', 'religious'],
    },

    // ── Coming up ──
    {
      title: 'Indians in Stuttgart — April Social',
      slug: 'indians-stuttgart-april-social-2026',
      description:
        'Monthly social at a new venue — details shared in the WhatsApp group. Open to all Indians, friends welcome.',
      communitySlug: 'indians-in-stuttgart',
      venueName: 'TBA — check WhatsApp group',
      venueAddress: 'Stuttgart Mitte',
      startsAt: future(15, 19),
      endsAt: future(15, 23),
      cost: 'free',
      status: 'UPCOMING' as const,
      categories: ['networking-social'],
    },
    {
      title: 'Baisakhi Celebration Stuttgart 2026',
      slug: 'baisakhi-stuttgart-2026',
      description:
        'Celebrate Baisakhi with Bhangra, Gidda, Punjabi food and a community mela. Hosted by HSS Stuttgart.',
      communitySlug: 'hss-stuttgart',
      venueName: 'Liederhalle Stuttgart',
      venueAddress: 'Berliner Platz 1, 70174 Stuttgart',
      startsAt: future(21, 17),
      endsAt: future(21, 22),
      cost: 'paid',
      status: 'UPCOMING' as const,
      categories: ['cultural'],
    },
    {
      title: 'ISS Study Group — Exam Prep Session',
      slug: 'iss-study-group-may-2026',
      description:
        'Open study session at the university library for Indian students preparing for summer exams. WhatsApp group for table reservation.',
      communitySlug: 'indian-students-stuttgart',
      venueName: 'UB Stuttgart — Gruppenlernraum',
      venueAddress: 'Holzgartenstr. 16, 70174 Stuttgart',
      startsAt: future(25, 14),
      endsAt: future(25, 19),
      cost: 'free',
      status: 'UPCOMING' as const,
      categories: ['student'],
    },
    {
      title: 'Navratri Dandiya Night Stuttgart 2026',
      slug: 'navratri-dandiya-stuttgart-2026',
      description:
        "The biggest Navratri dandiya event in BW — Gujarati Samaj's annual celebration drawing 400+ attendees. Traditional dress encouraged.",
      communitySlug: 'gujarati-samaj-stuttgart',
      venueName: 'Porsche Arena Stuttgart',
      venueAddress: 'Porscheplatz 1, 70435 Stuttgart',
      startsAt: future(180, 19),
      endsAt: future(180, 24),
      cost: 'paid',
      status: 'UPCOMING' as const,
      categories: ['cultural', 'arts-entertainment'],
    },
    {
      title: 'Diwali Mela Stuttgart 2026',
      slug: 'diwali-mela-stuttgart-2026',
      description:
        'Annual Diwali celebration with Indian food stalls, rangoli competition, cultural performances and fireworks.',
      communitySlug: 'indians-in-stuttgart',
      venueName: 'Schlossplatz Stuttgart',
      venueAddress: 'Schlossplatz, 70173 Stuttgart',
      startsAt: future(200, 17),
      endsAt: future(200, 22),
      cost: 'free',
      status: 'UPCOMING' as const,
      categories: ['cultural', 'arts-entertainment', 'family-kids'],
    },
    {
      title: 'Kannada Rajyotsava Stuttgart 2026',
      slug: 'kannada-rajyotsava-stuttgart-2026',
      description:
        'Karnataka Formation Day celebration — Kannada cultural programme, traditional cuisine and community camaraderie.',
      communitySlug: 'kannada-koota-stuttgart',
      venueName: 'Gemeindesaal Feuerbach',
      venueAddress: 'Stuttgarter Str. 65, 70469 Stuttgart',
      startsAt: future(202, 18),
      endsAt: future(202, 22),
      cost: 'paid',
      status: 'UPCOMING' as const,
      categories: ['cultural', 'language-regional'],
    },

    // ── Events for verified communities ──
    {
      title: 'Indian Film Festival Stuttgart 2026 — Opening Night',
      slug: 'iffs-opening-night-2026',
      description:
        'Opening night of the 23rd Indian Film Festival Stuttgart with premiere screening, director Q&A and reception.',
      communitySlug: 'indian-film-festival-stuttgart',
      venueName: 'Metropol Kino Stuttgart',
      venueAddress: 'Bolzstr. 10, 70173 Stuttgart',
      startsAt: future(90, 19),
      endsAt: future(90, 22),
      cost: 'paid',
      status: 'UPCOMING' as const,
      categories: ['arts-entertainment', 'cultural'],
    },
    {
      title: 'Sikh Gurudwara Stuttgart — Vaisakhi Celebration',
      slug: 'vaisakhi-gurudwara-stuttgart-2026',
      description:
        'Vaisakhi celebration at the Stuttgart Gurudwara — Akhand Path, Kirtan, Nagar Kirtan procession and langar for all.',
      communitySlug: 'sikh-gurudwara-stuttgart',
      venueName: 'Gurudwara Sahib Stuttgart',
      venueAddress: 'Industriestr. 44, 70565 Stuttgart',
      startsAt: future(2, 10),
      endsAt: future(2, 17),
      cost: 'free',
      status: 'UPCOMING' as const,
      categories: ['religious', 'cultural'],
    },
    {
      title: 'Bengali Association — Rabindra Jayanti 2026',
      slug: 'rabindra-jayanti-stuttgart-2026',
      description:
        "Celebrating Tagore's birth anniversary with Rabindra Sangeet performances, poetry recitation and a traditional Bengali dinner.",
      communitySlug: 'bengali-association-stuttgart',
      venueName: 'Kulturzentrum Stuttgart-Ost',
      venueAddress: 'Landhausstr. 190, 70188 Stuttgart',
      startsAt: future(22, 17),
      endsAt: future(22, 21),
      cost: 'paid',
      status: 'UPCOMING' as const,
      categories: ['cultural', 'language-regional', 'arts-entertainment'],
    },

    // ── Recurring events (inspired by Stuttgart Expats weekly cadence) ──
    {
      title: 'Green Sox Cricket — Weekly Nets Practice',
      slug: 'green-sox-weekly-nets-2026',
      description:
        'Weekly cricket nets session at Göppingen. Open to all skill levels — bats, balls and stumps provided. Come for a hit and fitness!',
      communitySlug: 'green-sox-goeppingen',
      venueName: 'Sportanlage Göppingen',
      venueAddress: 'Jahnstr. 12, 73033 Göppingen',
      startsAt: future(4, 16),
      endsAt: future(4, 18),
      cost: 'free',
      status: 'UPCOMING' as const,
      isRecurring: true,
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=SA',
      categories: ['sports-fitness'],
    },
    {
      title: 'Indians in Stuttgart — Monthly Social Hangout',
      slug: 'indians-stuttgart-monthly-social-2026',
      description:
        'Monthly social evening at a rotating venue in Stuttgart — food, drinks and networking. Venue announced in WhatsApp group each month.',
      communitySlug: 'indians-in-stuttgart',
      venueName: 'TBA — check WhatsApp group',
      venueAddress: 'Stuttgart Mitte',
      startsAt: future(28, 19),
      endsAt: future(28, 23),
      cost: 'free',
      status: 'UPCOMING' as const,
      isRecurring: true,
      recurrenceRule: 'FREQ=MONTHLY;BYDAY=2SA',
      categories: ['networking-social'],
    },
    {
      title: 'ISCON Stuttgart — Sunday Satsang & Prasadam',
      slug: 'iscon-sunday-satsang-2026',
      description:
        'Weekly Sunday satsang with kirtan, Bhagavad Gita discourse and free vegetarian prasadam. All are welcome.',
      communitySlug: 'hss-stuttgart',
      venueName: 'Gemeindezentrum Stuttgart-Nord',
      venueAddress: 'Nordbahnhofstr. 12, 70191 Stuttgart',
      startsAt: future(5, 11),
      endsAt: future(5, 13),
      cost: 'free',
      status: 'UPCOMING' as const,
      isRecurring: true,
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=SU',
      categories: ['religious'],
    },
    {
      title: 'Indian Professionals Stuttgart — Stammtisch',
      slug: 'ips-stammtisch-monthly-2026',
      description:
        'Monthly networking Stammtisch for Indian professionals in the Stuttgart metro area. Industry talks, career advice, and casual networking over beer.',
      communitySlug: 'indian-professionals-stuttgart',
      venueName: 'Brauhaus Schönbuch',
      venueAddress: 'Bolzstr. 10, 70173 Stuttgart',
      startsAt: future(20, 19),
      endsAt: future(20, 22),
      cost: 'free',
      status: 'UPCOMING' as const,
      isRecurring: true,
      recurrenceRule: 'FREQ=MONTHLY;BYDAY=3TH',
      categories: ['networking-social', 'professional'],
    },
  ];

  let eventCount = 0;
  let eventSkipped = 0;
  for (const e of eventDefs) {
    const { categories, communitySlug, isRecurring, recurrenceRule, ...data } = e;
    const communityId = communityIds[communitySlug];
    if (!communityId) {
      // Community wasn't seeded by directory.ts (e.g. dropped for lacking a
      // public source). Skip the demo event rather than create an orphan.
      eventSkipped++;
      continue;
    }
    await prisma.event.upsert({
      where: { slug: data.slug },
      update: { status: data.status },
      create: {
        ...data,
        isRecurring: isRecurring ?? false,
        recurrenceRule: recurrenceRule ?? null,
        cityId: stuttgart.id,
        communityId,
        source: 'ADMIN_SEED',
        categories: {
          create: categories.map((slug) => ({ categoryId: cats[slug] })),
        },
      },
    });
    eventCount++;
  }
  console.log(
    `✅ Events: ${eventCount} seeded${eventSkipped ? `, ${eventSkipped} skipped (community not in directory)` : ''}`,
  );

  // ─── Recompute all scores from real event data ──────────────────────────
  const { updated } = await refreshAllScores();
  console.log(`✅ Scores refreshed: ${updated} communities updated`);

  const resourceCount = await prisma.resource.count();

  console.log('\n✅ Seed complete!');
  console.log(`   Cities, categories, personas, admin: via runBootstrap()`);
  console.log(`   Communities: ${allCommunities.length} (via directory.ts)`);
  console.log(`   Resources:   ${resourceCount} (via resources.ts)`);
  console.log(`   Events:      ${eventCount} (demo synthetic, this seed only)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
