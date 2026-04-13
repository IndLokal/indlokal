/**
 * Database seed script for LocalPulse.
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

const prisma = new PrismaClient();

// Helpers — produces clean event dates
const past = (daysAgo: number, hour = 18) =>
  setMinutes(setHours(subDays(new Date(), daysAgo), hour), 0);
const future = (daysAhead: number, hour = 18) =>
  setMinutes(setHours(addDays(new Date(), daysAhead), hour), 0);

async function main() {
  console.log('🌱 Seeding LocalPulse database...\n');

  // ─── Cities ──────────────────────────────────────────────────────────────

  const stuttgart = await prisma.city.upsert({
    where: { slug: 'stuttgart' },
    update: {},
    create: {
      name: 'Stuttgart',
      slug: 'stuttgart',
      state: 'Baden-Württemberg',
      country: 'Germany',
      latitude: 48.7758,
      longitude: 9.1829,
      population: 634830,
      diasporaDensityEstimate: 12000,
      isActive: true,
      isMetroPrimary: true,
      timezone: 'Europe/Berlin',
    },
  });
  console.log(`✅ City: ${stuttgart.name}`);

  const satellites = [
    { name: 'Böblingen', slug: 'boeblingen', lat: 48.6833, lng: 9.0167, pop: 49312 },
    { name: 'Sindelfingen', slug: 'sindelfingen', lat: 48.7133, lng: 9.0028, pop: 64858 },
    { name: 'Ludwigsburg', slug: 'ludwigsburg', lat: 48.8975, lng: 9.1922, pop: 93593 },
    { name: 'Esslingen', slug: 'esslingen', lat: 48.7397, lng: 9.3108, pop: 94046 },
    { name: 'Leonberg', slug: 'leonberg', lat: 48.8, lng: 9.0167, pop: 48670 },
    { name: 'Göppingen', slug: 'goeppingen', lat: 48.7033, lng: 9.6519, pop: 57868 },
  ];
  for (const sat of satellites) {
    await prisma.city.upsert({
      where: { slug: sat.slug },
      update: {},
      create: {
        name: sat.name,
        slug: sat.slug,
        state: 'Baden-Württemberg',
        country: 'Germany',
        latitude: sat.lat,
        longitude: sat.lng,
        population: sat.pop,
        isActive: false,
        isMetroPrimary: false,
        metroRegionId: stuttgart.id,
        timezone: 'Europe/Berlin',
      },
    });
  }
  console.log(`  📍 ${satellites.length} satellite cities`);

  // ─── Categories ───────────────────────────────────────────────────────────

  const catDefs = [
    { name: 'Cultural', slug: 'cultural', icon: '🎭', sort: 1 },
    { name: 'Student', slug: 'student', icon: '🎓', sort: 2 },
    { name: 'Professional', slug: 'professional', icon: '💼', sort: 3 },
    { name: 'Religious', slug: 'religious', icon: '🙏', sort: 4 },
    { name: 'Language & Regional', slug: 'language-regional', icon: '🗣️', sort: 5 },
    { name: 'Sports & Fitness', slug: 'sports-fitness', icon: '⚽', sort: 6 },
    { name: 'Family & Kids', slug: 'family-kids', icon: '👨‍👩‍👧', sort: 7 },
    { name: 'Networking & Social', slug: 'networking-social', icon: '🤝', sort: 8 },
    { name: 'Food & Cooking', slug: 'food-cooking', icon: '🍛', sort: 9 },
    { name: 'Arts & Entertainment', slug: 'arts-entertainment', icon: '🎵', sort: 10 },
    { name: 'Consular & Official', slug: 'consular-official', icon: '🏛️', sort: 11 },
  ];
  const cats: Record<string, string> = {};
  for (const c of catDefs) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { name: c.name, slug: c.slug, type: 'CATEGORY', icon: c.icon, sortOrder: c.sort },
    });
    cats[c.slug] = row.id;
  }

  const personaDefs = [
    { name: 'Newcomer', slug: 'newcomer', icon: '🆕', sort: 1 },
    { name: 'Student', slug: 'persona-student', icon: '📚', sort: 2 },
    { name: 'Working Professional', slug: 'working-professional', icon: '💻', sort: 3 },
    { name: 'Family', slug: 'family', icon: '👨‍👩‍👧‍👦', sort: 4 },
    { name: 'Single', slug: 'single', icon: '🙋', sort: 5 },
  ];
  for (const p of personaDefs) {
    await prisma.category.upsert({
      where: { slug: p.slug },
      update: {},
      create: { name: p.name, slug: p.slug, type: 'PERSONA', icon: p.icon, sortOrder: p.sort },
    });
  }
  console.log(`✅ Categories: ${catDefs.length} + ${personaDefs.length} personas`);

  // ─── Communities ─────────────────────────────────────────────────────────

  const communityDefs = [
    {
      name: 'HSS Stuttgart',
      slug: 'hss-stuttgart',
      description:
        'Hindu Swayamsevak Sangh Stuttgart — weekly shakha, festivals and cultural programs for the Hindu community.',
      descriptionLong:
        'HSS Stuttgart is one of the most active Hindu cultural organisations in Baden-Württemberg. They run weekly Sunday shakhas, organise Diwali and Holi celebrations, and host family camps. Active since 2005.',
      languages: ['Hindi', 'English', 'Gujarati'],
      personaSegments: ['family', 'working-professional'],
      foundedYear: 2005,
      memberCountApprox: 250,
      activityScore: 82,
      completenessScore: 85,
      trustScore: 90,
      status: 'ACTIVE' as const,
      lastActivityAt: past(3),
      categories: ['cultural', 'religious'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/hss-stuttgart',
          label: 'HSS Stuttgart WhatsApp',
          isPrimary: true,
        },
        {
          channelType: 'WEBSITE' as const,
          url: 'https://hss-stuttgart.de',
          label: 'Website',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Telugu Association BW',
      slug: 'telugu-association-bw',
      description:
        'TANA-affiliated association for Telugu-speaking families in Baden-Württemberg — Ugadi, Sankranti, and regular meetups.',
      descriptionLong:
        'Telugu Association BW brings together Telugu-speaking professionals and families across Stuttgart and the surrounding region. Major events include Ugadi, Sankranti, and summer picnics. Founded by Hyderabad and Andhra expats working at Bosch and Mercedes.',
      languages: ['Telugu', 'English'],
      personaSegments: ['family', 'working-professional'],
      foundedYear: 2010,
      memberCountApprox: 320,
      activityScore: 76,
      completenessScore: 80,
      trustScore: 75,
      status: 'ACTIVE' as const,
      lastActivityAt: past(7),
      categories: ['language-regional', 'cultural'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/telugu-bw',
          label: 'Telugu BW WhatsApp',
          isPrimary: true,
        },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://facebook.com/groups/telugubw',
          label: 'Facebook Group',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Tamil Sangam Stuttgart',
      slug: 'tamil-sangam-stuttgart',
      description:
        'Cultural association for Tamil-speaking community in Stuttgart — Tamil New Year, Pongal, and language classes for children.',
      descriptionLong:
        'Tamil Sangam Stuttgart has been serving the Tamil diaspora since 2008. Their flagship events are Tamil New Year (Puthandu) and Pongal. They also run weekend Tamil language classes for children aged 5–14.',
      languages: ['Tamil', 'English'],
      personaSegments: ['family', 'working-professional'],
      foundedYear: 2008,
      memberCountApprox: 180,
      activityScore: 68,
      completenessScore: 75,
      trustScore: 70,
      status: 'ACTIVE' as const,
      lastActivityAt: past(14),
      categories: ['language-regional', 'cultural', 'family-kids'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/tamilsangam-stgt',
          label: 'Tamil Sangam WhatsApp',
          isPrimary: true,
        },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://facebook.com/TamilSangamStuttgart',
          label: 'Facebook Page',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Gujarati Samaj Stuttgart',
      slug: 'gujarati-samaj-stuttgart',
      description:
        'Gujarati community association — Navratri, Uttarayan, and monthly social gatherings for Gujarati families.',
      descriptionLong:
        'Gujarati Samaj Stuttgart organises the largest Navratri dandiya event in Baden-Württemberg, drawing 400+ attendees. Monthly potluck dinners and Uttarayan kite festivals are regular fixtures.',
      languages: ['Gujarati', 'Hindi', 'English'],
      personaSegments: ['family', 'working-professional'],
      foundedYear: 2003,
      memberCountApprox: 290,
      activityScore: 71,
      completenessScore: 70,
      trustScore: 80,
      status: 'ACTIVE' as const,
      lastActivityAt: past(20),
      categories: ['cultural', 'language-regional'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/gujarati-samaj-stgt',
          label: 'Gujarati Samaj WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indians in Stuttgart',
      slug: 'indians-in-stuttgart',
      description:
        'The largest open social community for all Indians in Stuttgart — meetups, newcomer help, restaurant recommendations and city guides.',
      descriptionLong:
        'Indians in Stuttgart is a non-religious, non-regional community welcoming all Indians regardless of background. Their monthly socials at Stuttgart bars and restaurants are a popular entry point for newcomers. Active Facebook and WhatsApp groups with 1200+ members.',
      languages: ['Hindi', 'English'],
      personaSegments: ['newcomer', 'working-professional', 'single'],
      foundedYear: 2012,
      memberCountApprox: 1200,
      activityScore: 90,
      completenessScore: 88,
      trustScore: 85,
      status: 'ACTIVE' as const,
      lastActivityAt: past(2),
      categories: ['networking-social'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/indians-in-stgt',
          label: 'Main WhatsApp Group',
          isPrimary: true,
        },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://facebook.com/groups/IndiansinStuttgart',
          label: 'Facebook Group',
          isPrimary: false,
        },
        {
          channelType: 'MEETUP' as const,
          url: 'https://meetup.com/indians-in-stuttgart',
          label: 'Meetup.com',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Indian Professionals Network Stuttgart',
      slug: 'ipn-stuttgart',
      description:
        'Professional networking for Indian engineers, managers, and entrepreneurs in Stuttgart and the automotive corridor.',
      descriptionLong:
        'IPN Stuttgart connects Indian professionals at Bosch, Mercedes-Benz, Porsche, Daimler Truck and suppliers. Monthly events range from career panels and startup pitches to casual happy hours. Strong presence in Böblingen/Sindelfingen corridor.',
      languages: ['English', 'Hindi'],
      personaSegments: ['working-professional'],
      foundedYear: 2016,
      memberCountApprox: 420,
      activityScore: 65,
      completenessScore: 72,
      trustScore: 68,
      status: 'ACTIVE' as const,
      lastActivityAt: past(30),
      categories: ['professional', 'networking-social'],
      channels: [
        {
          channelType: 'LINKEDIN' as const,
          url: 'https://linkedin.com/groups/ipn-stuttgart',
          label: 'LinkedIn Group',
          isPrimary: true,
        },
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/ipn-stgt',
          label: 'WhatsApp Group',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Kannada Koota Stuttgart',
      slug: 'kannada-koota-stuttgart',
      description:
        "Kannada Rajyotsava, Yugadi and cultural events for the Kannada-speaking community — mostly from Bengaluru working in Stuttgart's tech and auto sectors.",
      languages: ['Kannada', 'English'],
      personaSegments: ['family', 'working-professional'],
      foundedYear: 2014,
      memberCountApprox: 140,
      activityScore: 52,
      completenessScore: 60,
      trustScore: 60,
      status: 'ACTIVE' as const,
      lastActivityAt: past(45),
      categories: ['language-regional', 'cultural'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/kannada-stgt',
          label: 'WhatsApp Group',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indian Students Stuttgart',
      slug: 'indian-students-stuttgart',
      description:
        'Community for Indian students at University of Stuttgart and HFT — orientation help, study groups, housing tips and social events.',
      languages: ['Hindi', 'English', 'Telugu'],
      personaSegments: ['persona-student', 'newcomer'],
      foundedYear: 2018,
      memberCountApprox: 380,
      activityScore: 73,
      completenessScore: 65,
      trustScore: 65,
      status: 'ACTIVE' as const,
      lastActivityAt: past(10),
      categories: ['student', 'networking-social'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/iss-main',
          label: 'Main Group',
          isPrimary: true,
        },
        {
          channelType: 'INSTAGRAM' as const,
          url: 'https://instagram.com/indianstudentsstuttgart',
          label: 'Instagram',
          isPrimary: false,
        },
      ],
    },
  ];

  const communityIds: Record<string, string> = {};
  for (const c of communityDefs) {
    const { categories, channels, ...data } = c;
    const community = await prisma.community.upsert({
      where: { slug: data.slug },
      update: { activityScore: data.activityScore, lastActivityAt: data.lastActivityAt },
      create: {
        ...data,
        cityId: stuttgart.id,
        source: 'ADMIN_SEED',
        claimState: 'UNCLAIMED',
        categories: {
          create: categories.map((slug) => ({ categoryId: cats[slug] })),
        },
        accessChannels: { create: channels },
      },
    });
    communityIds[data.slug] = community.id;
    process.stdout.write(`  🏘 ${community.name}\n`);
  }
  console.log(`\n✅ Communities: ${communityDefs.length} seeded`);

  // ─── Events ───────────────────────────────────────────────────────────────

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
  ];

  let eventCount = 0;
  for (const e of eventDefs) {
    const { categories, communitySlug, isRecurring, recurrenceRule, ...data } = e;
    await prisma.event.upsert({
      where: { slug: data.slug },
      update: { status: data.status },
      create: {
        ...data,
        isRecurring: isRecurring ?? false,
        recurrenceRule: recurrenceRule ?? null,
        cityId: stuttgart.id,
        communityId: communityIds[communitySlug],
        source: 'ADMIN_SEED',
        categories: {
          create: categories.map((slug) => ({ categoryId: cats[slug] })),
        },
      },
    });
    eventCount++;
  }
  console.log(`✅ Events: ${eventCount} seeded`);

  // ─── Update lastActivityAt on communities based on their events ───────────

  for (const c of communityDefs) {
    await prisma.community.update({
      where: { slug: c.slug },
      data: { lastActivityAt: c.lastActivityAt },
    });
  }

  console.log('\n✅ Seed complete!');
  console.log(`   Stuttgart metro: 1 primary + ${satellites.length} satellites`);
  console.log(`   Communities: ${communityDefs.length}`);
  console.log(`   Events: ${eventCount} (past + this week + upcoming)`);
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
