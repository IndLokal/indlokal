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
import { ACTIVE_BUSINESS_CONNECT_PROGRAM } from '../src/app/jito-stuttgart/business-connect/pilot';

const prisma = new PrismaClient();
const shouldSeedDemoEvents = process.env.SEED_DEMO_EVENTS === '1';

// Helpers - produces clean event dates
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

  // ─── Events (demo-only - synthetic dates for activity scoring) ──────────
  // Keep local resets clean by default so pipeline tests reflect only
  // discovered website events. Opt in with SEED_DEMO_EVENTS=1 when needed.

  const eventDefs = shouldSeedDemoEvents
    ? [
        // ── Past events (activity signals for scoring) ──
        {
          title: 'Holi Milan 2026',
          slug: 'holi-milan-stuttgart-2026',
          description:
            'Annual Holi colour festival at Killesbergpark - organic colours, music and food stalls. Families welcome.',
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
          title: 'ISS Orientation Day - Summer 2026',
          slug: 'iss-orientation-summer-2026',
          description:
            'Welcome session for new Indian students joining Stuttgart universities in the summer semester. Campus tour, housing Q&A, SIM cards help.',
          communitySlug: 'indian-students-stuttgart',
          venueName: 'University of Stuttgart - Pfaffenwaldring Campus',
          venueAddress: 'Pfaffenwaldring 57, 70569 Stuttgart',
          startsAt: past(20, 10),
          endsAt: past(20, 14),
          cost: 'free',
          status: 'PAST' as const,
          categories: ['student'],
        },
        {
          title: 'Indians in Stuttgart - March Social',
          slug: 'indians-stuttgart-march-social-2026',
          description:
            'Monthly social at Bidda Bar, Stuttgart Mitte. Open to all Indians - no registration needed, just show up!',
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
          title: 'IPN Stuttgart - Automotive Career Panel',
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
          title: 'HSS Stuttgart - Weekly Shakha',
          slug: 'hss-weekly-shakha-apr-2026',
          description:
            'Weekly Sunday shakha open to all Hindus - yoga, patriotic songs and community activities. Families and children welcome.',
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
          title: 'Indians in Stuttgart - April Social',
          slug: 'indians-stuttgart-april-social-2026',
          description:
            'Monthly social at a new venue - details shared in the WhatsApp group. Open to all Indians, friends welcome.',
          communitySlug: 'indians-in-stuttgart',
          venueName: 'TBA - check WhatsApp group',
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
          title: 'JITO Stuttgart - Founder Funding Roundtable',
          slug: 'jito-founder-funding-roundtable-2026',
          description:
            'Roundtable for founders and early-stage operators: fundraising readiness, angel expectations, and go-to-market mistakes in Germany.',
          communitySlug: 'jito-stuttgart',
          venueName: 'Impact Hub Stuttgart',
          venueAddress: 'Quellenstr. 7a, 70376 Stuttgart',
          startsAt: future(9, 18),
          endsAt: future(9, 21),
          cost: 'free',
          status: 'UPCOMING' as const,
          categories: ['professional', 'networking-social'],
        },
        {
          title: 'JITO Stuttgart - Monthly Founder Breakfast',
          slug: 'jito-monthly-founder-breakfast-2026',
          description:
            'Recurring peer breakfast for entrepreneurs and professionals: accountability updates, hiring challenges, and referral exchange.',
          communitySlug: 'jito-stuttgart',
          venueName: 'Cafe am Schlossgarten',
          venueAddress: 'Arnulf-Klett-Platz 2, 70173 Stuttgart',
          startsAt: future(12, 8),
          endsAt: future(12, 10),
          cost: 'free',
          status: 'UPCOMING' as const,
          isRecurring: true,
          recurrenceRule: 'FREQ=MONTHLY;BYDAY=2FR',
          categories: ['professional', 'networking-social'],
        },
        {
          title: 'ISS Study Group - Exam Prep Session',
          slug: 'iss-study-group-may-2026',
          description:
            'Open study session at the university library for Indian students preparing for summer exams. WhatsApp group for table reservation.',
          communitySlug: 'indian-students-stuttgart',
          venueName: 'UB Stuttgart - Gruppenlernraum',
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
            "The biggest Navratri dandiya event in BW - Gujarati Samaj's annual celebration drawing 400+ attendees. Traditional dress encouraged.",
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
            'Karnataka Formation Day celebration - Kannada cultural programme, traditional cuisine and community camaraderie.',
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
          title: 'Indian Film Festival Stuttgart 2026 - Opening Night',
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
          title: 'Sikh Gurudwara Stuttgart - Vaisakhi Celebration',
          slug: 'vaisakhi-gurudwara-stuttgart-2026',
          description:
            'Vaisakhi celebration at the Stuttgart Gurudwara - Akhand Path, Kirtan, Nagar Kirtan procession and langar for all.',
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
          title: 'Bengali Association - Rabindra Jayanti 2026',
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
          title: 'Green Sox Cricket - Weekly Nets Practice',
          slug: 'green-sox-weekly-nets-2026',
          description:
            'Weekly cricket nets session at Göppingen. Open to all skill levels - bats, balls and stumps provided. Come for a hit and fitness!',
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
          title: 'Indians in Stuttgart - Monthly Social Hangout',
          slug: 'indians-stuttgart-monthly-social-2026',
          description:
            'Monthly social evening at a rotating venue in Stuttgart - food, drinks and networking. Venue announced in WhatsApp group each month.',
          communitySlug: 'indians-in-stuttgart',
          venueName: 'TBA - check WhatsApp group',
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
          title: 'ISCON Stuttgart - Sunday Satsang & Prasadam',
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
          title: 'Indian Professionals Stuttgart - Stammtisch',
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
      ]
    : [];

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
    shouldSeedDemoEvents
      ? `✅ Events: ${eventCount} seeded${eventSkipped ? `, ${eventSkipped} skipped (community not in directory)` : ''}`
      : '✅ Events: 0 seeded (SEED_DEMO_EVENTS not enabled)',
  );

  // ─── Recompute all scores from real event data ──────────────────────────
  const { updated } = await refreshAllScores();
  console.log(`✅ Scores refreshed: ${updated} communities updated`);

  // ─── Ambassador role assignment + outreach CRM demo data ────────────────
  // Idempotent: uses upsert/findOrCreate patterns.

  const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@indlokal.com').trim().toLowerCase();
  const adminUser = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });

  // Demo ambassador user (separate from admin so the ambassador console is testable)
  const ambassadorEmail = 'ambassador@indlokal.com';
  const existingAmbassador = await prisma.user.findUnique({ where: { email: ambassadorEmail } });
  const ambassador =
    existingAmbassador ??
    (await prisma.user.create({
      data: {
        email: ambassadorEmail,
        displayName: 'Demo Ambassador',
        role: 'CITY_AMBASSADOR',
        cityId: stuttgart.id,
      },
    }));

  // Role assignment: CITY_AMBASSADOR for Stuttgart (idempotent)
  const existingRoleAssignment = await prisma.roleAssignment.findFirst({
    where: {
      userId: ambassador.id,
      role: 'CITY_AMBASSADOR',
      cityId: stuttgart.id,
      revokedAt: null,
    },
  });
  if (!existingRoleAssignment && adminUser) {
    await prisma.roleAssignment.create({
      data: {
        userId: ambassador.id,
        role: 'CITY_AMBASSADOR',
        cityId: stuttgart.id,
        grantedBy: adminUser.id,
      },
    });
  }

  // Sample outreach leads for the Stuttgart pipeline
  const sampleLeads = [
    {
      suggestedName: 'Tamil Cultural Association BW',
      channelHint: 'https://www.instagram.com/tamilbw/',
      source: 'ambassador',
      stage: 'RESEARCHING' as const,
    },
    {
      suggestedName: 'Pakistani Community Stuttgart',
      channelHint: 'https://chat.whatsapp.com/sample1',
      source: 'ambassador',
      stage: 'CONTACTED' as const,
    },
    {
      suggestedName: 'Bengali Association Stuttgart',
      channelHint: 'https://www.facebook.com/groups/bengalistuttgart',
      source: 'manual',
      stage: 'NEW' as const,
    },
  ];

  let leadsSeeded = 0;
  for (const lead of sampleLeads) {
    const existing = await prisma.outreachLead.findFirst({
      where: { cityId: stuttgart.id, suggestedName: lead.suggestedName },
    });
    if (!existing) {
      await prisma.outreachLead.create({
        data: {
          cityId: stuttgart.id,
          ownerUserId: ambassador.id,
          ...lead,
          updatedAt: new Date(),
        },
      });
      leadsSeeded++;
    }
  }
  console.log(`✅ Ambassador seed: 1 role assignment, ${leadsSeeded} new outreach leads`);
  // ────────────────────────────────────────────────────────────────────────

  // ─── Demo organizer with an OWNER community membership (ADR-0008) ───────
  // Organizer access is a community relationship, not a profile role: the
  // organizer's authority comes from the CLAIMED community + the OWNER
  // CommunityCollaborator row, never from User.role.
  const organizerEmail = 'organizer@indlokal.com';
  const firstCommunity = allCommunities[0];
  if (firstCommunity) {
    const organizer =
      (await prisma.user.findUnique({ where: { email: organizerEmail } })) ??
      (await prisma.user.create({
        data: {
          email: organizerEmail,
          displayName: 'Demo Organizer',
          role: 'USER',
          cityId: stuttgart.id,
        },
      }));

    await prisma.community.update({
      where: { id: firstCommunity.id },
      data: { claimState: 'CLAIMED', claimedByUserId: organizer.id },
    });

    await prisma.communityCollaborator.upsert({
      where: {
        communityId_userId: { communityId: firstCommunity.id, userId: organizer.id },
      },
      update: { role: 'COMMUNITY_ADMIN', status: 'ACTIVE' },
      create: {
        communityId: firstCommunity.id,
        userId: organizer.id,
        role: 'COMMUNITY_ADMIN',
        status: 'ACTIVE',
        source: 'ADMIN_ADD',
      },
    });
    console.log(`✅ Organizer seed: ${organizerEmail} owns "${firstCommunity.slug}"`);

    // ─── Event governance demo (ADR-0009) ────────────────────────────────
    // One published community event + one pending host submission, so the
    // moderation axis and admin review queue are exercisable out of the box.
    const hostEmail = 'host@indlokal.com';
    const hostProfile = {
      displayName: 'Demo Host',
      cityId: stuttgart.id,
      links: ['https://instagram.com/demohost', 'https://demohost.example'],
    };
    const host =
      (await prisma.user.findUnique({ where: { email: hostEmail } })) ??
      (await prisma.user.create({
        data: {
          email: hostEmail,
          displayName: 'Demo Host',
          role: 'EVENT_HOST',
          cityId: stuttgart.id,
          metadata: { hostProfile },
        },
      }));
    // Ensure the demo host always has a filled-out profile for the workspace demo.
    await prisma.user.update({
      where: { id: host.id },
      data: {
        metadata: {
          ...(typeof host.metadata === 'object' && host.metadata !== null
            ? (host.metadata as object)
            : {}),
          hostProfile,
        },
      },
    });

    await prisma.event.upsert({
      where: { slug: 'demo-community-diwali-mixer' },
      update: { moderationState: 'PUBLISHED' },
      create: {
        slug: 'demo-community-diwali-mixer',
        title: 'Community Diwali Mixer',
        description: 'A published community event seeded for governance demos.',
        venueName: 'Community Hall',
        venueAddress: 'Königstr. 1, 70173 Stuttgart',
        startsAt: future(15, 18),
        endsAt: future(15, 21),
        cost: 'free',
        status: 'UPCOMING',
        cityId: stuttgart.id,
        communityId: firstCommunity.id,
        source: 'COMMUNITY_SUBMITTED',
        moderationState: 'PUBLISHED',
        createdByUserId: organizer.id,
      },
    });

    await prisma.event.upsert({
      where: { slug: 'demo-host-pending-meetup' },
      update: { moderationState: 'PENDING_REVIEW' },
      create: {
        slug: 'demo-host-pending-meetup',
        title: 'Host Submitted Meetup (Pending Review)',
        description: 'A host-submitted event awaiting admin review.',
        venueName: 'Co-working Space',
        venueAddress: 'Calwer Str. 11, 70173 Stuttgart',
        startsAt: future(25, 19),
        endsAt: future(25, 21),
        cost: 'free',
        status: 'UPCOMING',
        cityId: stuttgart.id,
        source: 'USER_SUGGESTED',
        moderationState: 'PENDING_REVIEW',
        createdByUserId: host.id,
        metadata: { hostUserId: host.id },
      },
    });

    // A live (published, upcoming) host event so the host overview shows real
    // "Live" / "Next up" signals, plus a past and a declined event.
    await prisma.event.upsert({
      where: { slug: 'demo-host-live-concert' },
      update: { moderationState: 'PUBLISHED' },
      create: {
        slug: 'demo-host-live-concert',
        title: 'Sitar Evening (Live)',
        description: 'A published host event seeded for the host workspace demo.',
        venueName: 'Liederhalle',
        venueAddress: 'Berliner Pl. 1-3, 70174 Stuttgart',
        startsAt: future(8, 19),
        endsAt: future(8, 22),
        cost: 'free',
        status: 'UPCOMING',
        cityId: stuttgart.id,
        source: 'USER_SUGGESTED',
        moderationState: 'PUBLISHED',
        createdByUserId: host.id,
        metadata: { hostUserId: host.id },
      },
    });

    await prisma.event.upsert({
      where: { slug: 'demo-host-past-workshop' },
      update: { moderationState: 'PUBLISHED' },
      create: {
        slug: 'demo-host-past-workshop',
        title: 'Cooking Workshop (Past)',
        description: 'A past host event seeded for the host workspace demo.',
        venueName: 'Markthalle',
        venueAddress: 'Dorotheenstr. 4, 70173 Stuttgart',
        startsAt: future(-10, 18),
        endsAt: future(-10, 20),
        cost: 'free',
        status: 'PAST',
        cityId: stuttgart.id,
        source: 'USER_SUGGESTED',
        moderationState: 'PUBLISHED',
        createdByUserId: host.id,
        metadata: { hostUserId: host.id },
      },
    });

    await prisma.event.upsert({
      where: { slug: 'demo-host-declined-party' },
      update: { moderationState: 'REJECTED' },
      create: {
        slug: 'demo-host-declined-party',
        title: 'Rooftop Party (Declined)',
        description: 'A declined host event seeded to demo the "needs attention" panel.',
        venueName: 'Rooftop',
        venueAddress: 'Stuttgart',
        startsAt: future(20, 21),
        endsAt: future(20, 23),
        cost: 'paid',
        status: 'UPCOMING',
        cityId: stuttgart.id,
        source: 'USER_SUGGESTED',
        moderationState: 'REJECTED',
        reviewReason: 'Insufficient venue details — please add a full address and resubmit.',
        createdByUserId: host.id,
        metadata: { hostUserId: host.id },
      },
    });
    console.log('✅ Event governance seed: 1 published community + 1 pending host event');
  }
  // ────────────────────────────────────────────────────────────────────────

  // ─── Demo Business Connect enquiries (review queue, gated) ──────────────
  // Pilot-agnostic engine: rows are scoped to the active pilot via pilotSlug and
  // carry its consent-notice version. Demo-only (SEED_DEMO_EVENTS=1), create-only
  // idempotent, obviously-fake data — never seed real enquiry PII.
  if (shouldSeedDemoEvents) {
    const pilot = ACTIVE_BUSINESS_CONNECT_PROGRAM;

    // Business Connect is invite-only and organizer-curated. Make the pilot's
    // community organizer-owned and seed demo invites so the organizer invite
    // surface and the admin review queue are both exercisable out of the box.
    const bcCommunity = await prisma.community.findUnique({
      where: { slug: pilot.communitySlug },
      select: { id: true },
    });
    const bcOrganizer = await prisma.user.findUnique({
      where: { email: 'organizer@indlokal.com' },
      select: { id: true },
    });
    if (bcCommunity && bcOrganizer) {
      await prisma.community.update({
        where: { id: bcCommunity.id },
        data: { claimState: 'CLAIMED', claimedByUserId: bcOrganizer.id },
      });
      await prisma.communityCollaborator.upsert({
        where: {
          communityId_userId: { communityId: bcCommunity.id, userId: bcOrganizer.id },
        },
        update: { role: 'COMMUNITY_ADMIN', status: 'ACTIVE' },
        create: {
          communityId: bcCommunity.id,
          userId: bcOrganizer.id,
          role: 'COMMUNITY_ADMIN',
          status: 'ACTIVE',
          source: 'ADMIN_ADD',
        },
      });

      if (adminUser) {
        await prisma.communityCollaborator.upsert({
          where: {
            communityId_userId: { communityId: bcCommunity.id, userId: adminUser.id },
          },
          update: { role: 'COMMUNITY_ADMIN', status: 'ACTIVE' },
          create: {
            communityId: bcCommunity.id,
            userId: adminUser.id,
            role: 'COMMUNITY_ADMIN',
            status: 'ACTIVE',
            source: 'ADMIN_ADD',
          },
        });
      }

      // One outstanding (unused) demo invite, so the organizer list shows a
      // guest who hasn't submitted yet. Token hash is fake (no real link).
      const pendingInviteEmail = 'demo-invited@example.com';
      const existingPending = await prisma.businessConnectInvite.findFirst({
        where: { pilotSlug: pilot.slug, email: pendingInviteEmail },
        select: { id: true },
      });
      if (!existingPending) {
        await prisma.businessConnectInvite.create({
          data: {
            pilotSlug: pilot.slug,
            email: pendingInviteEmail,
            tokenHash: `seed-pending-${pilot.slug}`,
            communityId: bcCommunity.id,
            invitedByUserId: bcOrganizer.id,
            note: 'Demo: invited but not yet submitted',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }
    }

    const demoEnquiries = [
      {
        contactEmail: 'demo-new@example.com',
        status: 'NEW' as const,
        participantType: 'INDIAN_BUSINESS',
        lookingFor: ['DISTRIBUTOR', 'LOCAL_PARTNER'],
        offering: ['PRODUCT'],
        companyName: 'Demo Spices Pvt Ltd',
        country: 'India',
        city: 'Mumbai',
        industry: 'Food & Beverage',
        businessDescription:
          'Demo enquiry: exporter of packaged spices seeking German distribution.',
        specificAsk: 'A distribution partner for the DACH region.',
        contactName: 'Demo Applicant One',
        attendingEvent: 'YES',
        isPartnerMember: 'NO',
      },
      {
        contactEmail: 'demo-shortlisted@example.com',
        status: 'SHORTLISTED' as const,
        participantType: 'GERMAN_BUSINESS',
        lookingFor: ['SUPPLIER'],
        offering: ['DISTRIBUTION', 'LOCAL_REPRESENTATION'],
        companyName: 'Demo Handels GmbH',
        country: 'Germany',
        city: 'Stuttgart',
        industry: 'Retail',
        businessDescription: 'Demo enquiry: German importer looking for verified Indian suppliers.',
        specificAsk: 'Reliable suppliers of organic foods with EU certification.',
        contactName: 'Demo Applicant Two',
        attendingEvent: 'NOT_SURE',
        isPartnerMember: 'YES',
      },
    ];

    let bcSeeded = 0;
    for (const enquiry of demoEnquiries) {
      const existing = await prisma.businessConnectSubmission.findFirst({
        where: { pilotSlug: pilot.slug, contactEmail: enquiry.contactEmail },
        select: { id: true },
      });
      if (!existing) {
        // Every enquiry comes from an invite. Seed a matching used invite so the
        // demo rows reflect the real invite-only flow and show in the organizer list.
        let inviteId: string | undefined;
        if (bcCommunity && bcOrganizer) {
          const seededInvite = await prisma.businessConnectInvite.create({
            data: {
              pilotSlug: pilot.slug,
              email: enquiry.contactEmail,
              tokenHash: `seed-used-${enquiry.contactEmail}`,
              communityId: bcCommunity.id,
              invitedByUserId: bcOrganizer.id,
              note: 'Demo: invited and submitted',
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              usedAt: new Date(),
            },
          });
          inviteId = seededInvite.id;
        }

        await prisma.businessConnectSubmission.create({
          data: {
            pilotSlug: pilot.slug,
            ...enquiry,
            consentToReview: true,
            consentManualIntroUnderstanding: true,
            consentToShareSelectedInfo: false,
            consentPolicyVersion: pilot.consentPolicyVersion,
            // Demo rows are pre-confirmed so they appear in the admin review queue.
            status: enquiry.status,
            emailConfirmedAt: new Date(),
            inviteId,
          },
        });
        bcSeeded++;
      }
    }
    console.log(`✅ Business Connect seed: ${bcSeeded} demo enquiries (pilot ${pilot.slug})`);
  }
  // ────────────────────────────────────────────────────────────────────────

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
