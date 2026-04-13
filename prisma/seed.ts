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
import { refreshAllScores } from '../src/modules/scoring/scoring';

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

  // ─── Additional communities (to reach density target) ─────────────────────

  const moreCommunityDefs = [
    {
      name: 'Cricket Club Stuttgart Indians',
      slug: 'cricket-club-stuttgart-indians',
      description:
        'Indian cricket club in Stuttgart — weekend matches, tournaments, and practice sessions. Open to all skill levels.',
      languages: ['Hindi', 'English'],
      personaSegments: ['working-professional', 'single'],
      foundedYear: 2011,
      memberCountApprox: 90,
      activityScore: 55,
      completenessScore: 60,
      trustScore: 55,
      status: 'ACTIVE' as const,
      lastActivityAt: past(28),
      categories: ['sports-fitness', 'networking-social'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/cricket-stgt',
          label: 'Cricket Club WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indian Muslim Association Stuttgart',
      slug: 'indian-muslim-association-stuttgart',
      description:
        'Community for Indian Muslims in Stuttgart — Eid celebrations, Friday prayers coordination, and social gatherings.',
      languages: ['Urdu', 'Hindi', 'English'],
      personaSegments: ['family', 'working-professional'],
      foundedYear: 2009,
      memberCountApprox: 160,
      activityScore: 60,
      completenessScore: 65,
      trustScore: 65,
      status: 'ACTIVE' as const,
      lastActivityAt: past(15),
      categories: ['religious', 'cultural'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/ima-stgt',
          label: 'IMA Stuttgart WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Rajasthani Samaj Stuttgart',
      slug: 'rajasthani-samaj-stuttgart',
      description:
        'Association for Rajasthani families in Stuttgart — Teej, Gangaur, and cultural programmes celebrating Rajasthani heritage.',
      languages: ['Rajasthani', 'Hindi', 'English'],
      personaSegments: ['family'],
      foundedYear: 2015,
      memberCountApprox: 85,
      activityScore: 40,
      completenessScore: 55,
      trustScore: 50,
      status: 'ACTIVE' as const,
      lastActivityAt: past(60),
      categories: ['cultural', 'language-regional'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/raj-stgt',
          label: 'WhatsApp Group',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Malayalam Association Stuttgart',
      slug: 'malayalam-association-stuttgart',
      description:
        'Kerala community in Stuttgart — Onam, Vishu, and charityevents. Strong presence of Malayali nurses and IT professionals.',
      languages: ['Malayalam', 'English'],
      personaSegments: ['family', 'working-professional'],
      foundedYear: 2007,
      memberCountApprox: 200,
      activityScore: 65,
      completenessScore: 70,
      trustScore: 70,
      status: 'ACTIVE' as const,
      lastActivityAt: past(22),
      categories: ['language-regional', 'cultural'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/malayali-stgt',
          label: 'Malayali Stuttgart WhatsApp',
          isPrimary: true,
        },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://facebook.com/groups/malayaleesstuttgart',
          label: 'Facebook Group',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Marathi Mandal Stuttgart',
      slug: 'marathi-mandal-stuttgart',
      description:
        'Cultural and social association for Marathi-speaking community — Gudi Padwa, Ganesh Utsav, and monthly sabhas.',
      languages: ['Marathi', 'Hindi', 'English'],
      personaSegments: ['family', 'working-professional'],
      foundedYear: 2013,
      memberCountApprox: 130,
      activityScore: 58,
      completenessScore: 65,
      trustScore: 62,
      status: 'ACTIVE' as const,
      lastActivityAt: past(35),
      categories: ['cultural', 'language-regional'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/marathi-stgt',
          label: 'Marathi Mandal WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Punjabi Community Stuttgart',
      slug: 'punjabi-community-stuttgart',
      description:
        'Punjabi community in Stuttgart — Vaisakhi, Lohri, Gurpurab celebrations and social meetups.',
      languages: ['Punjabi', 'Hindi', 'English'],
      personaSegments: ['family', 'working-professional'],
      foundedYear: 2008,
      memberCountApprox: 175,
      activityScore: 62,
      completenessScore: 68,
      trustScore: 65,
      status: 'ACTIVE' as const,
      lastActivityAt: past(18),
      categories: ['cultural', 'religious'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/punjabi-stgt',
          label: 'Punjabi Stuttgart WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indian Women Network Stuttgart',
      slug: 'indian-women-network-stuttgart',
      description:
        'Support and networking group for Indian women in Stuttgart — career advice, integration help, social events, and playgroups.',
      languages: ['Hindi', 'English'],
      personaSegments: ['working-professional', 'family', 'newcomer'],
      foundedYear: 2017,
      memberCountApprox: 240,
      activityScore: 72,
      completenessScore: 75,
      trustScore: 70,
      status: 'ACTIVE' as const,
      lastActivityAt: past(8),
      categories: ['networking-social', 'family-kids'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/iwn-stgt',
          label: 'IWN Stuttgart WhatsApp',
          isPrimary: true,
        },
        {
          channelType: 'INSTAGRAM' as const,
          url: 'https://instagram.com/iwn_stuttgart',
          label: 'Instagram',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Indian Families Böblingen',
      slug: 'indian-families-boeblingen',
      description:
        'Family community in Böblingen-Sindelfingen corridor — playdates, school help, housing tips for Indian families near Mercedes and Bosch.',
      languages: ['Hindi', 'English', 'Telugu'],
      personaSegments: ['family'],
      foundedYear: 2019,
      memberCountApprox: 110,
      activityScore: 50,
      completenessScore: 55,
      trustScore: 55,
      status: 'ACTIVE' as const,
      lastActivityAt: past(40),
      categories: ['family-kids', 'networking-social'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/indian-families-bbl',
          label: 'WhatsApp Group',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indian Startups & Founders Stuttgart',
      slug: 'indian-startups-founders-stuttgart',
      description:
        'Community for Indian entrepreneurs, startup founders, and investors in Stuttgart — pitches, office hours, and ecosystem building.',
      languages: ['English', 'Hindi'],
      personaSegments: ['working-professional'],
      foundedYear: 2020,
      memberCountApprox: 95,
      activityScore: 45,
      completenessScore: 60,
      trustScore: 50,
      status: 'ACTIVE' as const,
      lastActivityAt: past(55),
      categories: ['professional', 'networking-social'],
      channels: [
        {
          channelType: 'LINKEDIN' as const,
          url: 'https://linkedin.com/groups/indian-startups-stgt',
          label: 'LinkedIn Group',
          isPrimary: true,
        },
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/startups-stgt',
          label: 'WhatsApp Group',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Bhajan Mandali Stuttgart',
      slug: 'bhajan-mandali-stuttgart',
      description:
        "Weekly devotional bhajan sessions open to all — Thursdays at a community member's home. Bhajans, kirtan, and prasad.",
      languages: ['Hindi', 'Gujarati', 'Marathi'],
      personaSegments: ['family'],
      foundedYear: 2006,
      memberCountApprox: 60,
      activityScore: 68,
      completenessScore: 50,
      trustScore: 72,
      status: 'ACTIVE' as const,
      lastActivityAt: past(5),
      categories: ['religious'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/bhajan-stgt',
          label: 'Bhajan Mandali WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indian Food Lovers Stuttgart',
      slug: 'indian-food-lovers-stuttgart',
      description:
        'Community for sharing Indian food tips — best Indian restaurants, grocery sources, recipes, and potluck dinners.',
      languages: ['Hindi', 'English'],
      personaSegments: ['working-professional', 'single', 'newcomer'],
      foundedYear: 2018,
      memberCountApprox: 320,
      activityScore: 55,
      completenessScore: 58,
      trustScore: 52,
      status: 'ACTIVE' as const,
      lastActivityAt: past(12),
      categories: ['food-cooking', 'networking-social'],
      channels: [
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://facebook.com/groups/indianfoodstuttgart',
          label: 'Facebook Group',
          isPrimary: true,
        },
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/indianfood-stgt',
          label: 'WhatsApp Group',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Desi Parents Stuttgart',
      slug: 'desi-parents-stuttgart',
      description:
        'WhatsApp+Facebook community for Indian parents raising children in Stuttgart — German school tips, activity recommendations, and playdates.',
      languages: ['Hindi', 'English'],
      personaSegments: ['family'],
      foundedYear: 2016,
      memberCountApprox: 280,
      activityScore: 70,
      completenessScore: 60,
      trustScore: 65,
      status: 'ACTIVE' as const,
      lastActivityAt: past(6),
      categories: ['family-kids'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/desi-parents-stgt',
          label: 'WhatsApp Group',
          isPrimary: true,
        },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://facebook.com/groups/desiparentsstuttgart',
          label: 'Facebook Group',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Hindi Film & Culture Circle Stuttgart',
      slug: 'hindi-film-culture-circle-stuttgart',
      description:
        'Bollywood movie screenings, music nights, and Indian culture events — monthly gatherings in Stuttgart.',
      languages: ['Hindi', 'English'],
      personaSegments: ['single', 'working-professional'],
      foundedYear: 2014,
      memberCountApprox: 150,
      activityScore: 48,
      completenessScore: 55,
      trustScore: 50,
      status: 'ACTIVE' as const,
      lastActivityAt: past(50),
      categories: ['arts-entertainment', 'cultural'],
      channels: [
        {
          channelType: 'MEETUP' as const,
          url: 'https://meetup.com/hindi-film-stuttgart',
          label: 'Meetup.com',
          isPrimary: true,
        },
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/hfcc-stgt',
          label: 'WhatsApp Group',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Yoga & Meditation — Indian Stuttgart',
      slug: 'yoga-meditation-indian-stuttgart',
      description:
        'Weekly yoga and meditation sessions led by Indian instructors — traditional Hatha yoga, pranayam and guided meditation.',
      languages: ['Hindi', 'English'],
      personaSegments: ['working-professional', 'family', 'single'],
      foundedYear: 2019,
      memberCountApprox: 70,
      activityScore: 60,
      completenessScore: 62,
      trustScore: 60,
      status: 'ACTIVE' as const,
      lastActivityAt: past(7),
      categories: ['sports-fitness', 'religious'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/yoga-stgt',
          label: 'Yoga Group WhatsApp',
          isPrimary: true,
        },
        {
          channelType: 'INSTAGRAM' as const,
          url: 'https://instagram.com/yogastuttgart_indian',
          label: 'Instagram',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'NRI Legal Help Stuttgart',
      slug: 'nri-legal-help-stuttgart',
      description:
        'Peer support group for navigating German legal, tax, and immigration matters — visa renewals, anmeldung, tax returns for NRIs.',
      languages: ['Hindi', 'English'],
      personaSegments: ['newcomer', 'working-professional'],
      foundedYear: 2020,
      memberCountApprox: 410,
      activityScore: 78,
      completenessScore: 65,
      trustScore: 68,
      status: 'ACTIVE' as const,
      lastActivityAt: past(4),
      categories: ['networking-social', 'consular-official'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/nri-legal-stgt',
          label: 'NRI Legal Help WhatsApp',
          isPrimary: true,
        },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://facebook.com/groups/nrilegalstuttgart',
          label: 'Facebook Group',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Indian Badminton Stuttgart',
      slug: 'indian-badminton-stuttgart',
      description:
        'Badminton group for Indian players in Stuttgart — weekly sessions at Sportzentrum, open to all levels.',
      languages: ['Hindi', 'English', 'Telugu'],
      personaSegments: ['working-professional', 'single'],
      foundedYear: 2015,
      memberCountApprox: 65,
      activityScore: 72,
      completenessScore: 55,
      trustScore: 60,
      status: 'ACTIVE' as const,
      lastActivityAt: past(3),
      categories: ['sports-fitness'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/badminton-stgt',
          label: 'Badminton Group WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Sindhi Association Stuttgart',
      slug: 'sindhi-association-stuttgart',
      description:
        'Sindhi community association — Cheti Chand, Jhulelal celebrations, and cultural events preserving Sindhi heritage in Stuttgart.',
      languages: ['Sindhi', 'Hindi', 'English'],
      personaSegments: ['family'],
      foundedYear: 2012,
      memberCountApprox: 55,
      activityScore: 35,
      completenessScore: 50,
      trustScore: 48,
      status: 'ACTIVE' as const,
      lastActivityAt: past(75),
      categories: ['cultural', 'language-regional'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/sindhi-stgt',
          label: 'WhatsApp Group',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indian Expats Esslingen',
      slug: 'indian-expats-esslingen',
      description:
        'Community for Indians living and working in Esslingen and Göppingen — social meetups, newcomer help, and local tips.',
      languages: ['Hindi', 'English'],
      personaSegments: ['newcomer', 'working-professional'],
      foundedYear: 2018,
      memberCountApprox: 120,
      activityScore: 45,
      completenessScore: 52,
      trustScore: 50,
      status: 'ACTIVE' as const,
      lastActivityAt: past(42),
      categories: ['networking-social'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/indians-esslingen',
          label: 'WhatsApp Group',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Durga Puja Stuttgart',
      slug: 'durga-puja-stuttgart',
      description:
        'Annual Durga Puja celebration for the Bengali and pan-Indian community — 4-day festival with Ashtami, Navami, and Dashami.',
      languages: ['Bengali', 'Hindi', 'English'],
      personaSegments: ['family', 'working-professional'],
      foundedYear: 2010,
      memberCountApprox: 190,
      activityScore: 42,
      completenessScore: 58,
      trustScore: 60,
      status: 'ACTIVE' as const,
      lastActivityAt: past(80),
      categories: ['cultural', 'religious'],
      channels: [
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://facebook.com/DurgaPujaStuttgart',
          label: 'Facebook Page',
          isPrimary: true,
        },
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/durga-puja-stgt',
          label: 'WhatsApp Group',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Indian Doctors Stuttgart',
      slug: 'indian-doctors-stuttgart',
      description:
        'Network for Indian medical professionals in Stuttgart — peer support, German medical licensing help, hospital job tips.',
      languages: ['Hindi', 'English', 'Malayalam'],
      personaSegments: ['working-professional'],
      foundedYear: 2016,
      memberCountApprox: 85,
      activityScore: 50,
      completenessScore: 60,
      trustScore: 65,
      status: 'ACTIVE' as const,
      lastActivityAt: past(38),
      categories: ['professional'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/indian-doctors-stgt',
          label: 'WhatsApp Group',
          isPrimary: true,
        },
        {
          channelType: 'LINKEDIN' as const,
          url: 'https://linkedin.com/groups/indian-doctors-stgt',
          label: 'LinkedIn',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Indian Students Böblingen / HdWM',
      slug: 'indian-students-boeblingen',
      description:
        'Indian students at HdWM Mannheim Böblingen campus and Corporate State University (DHBW) — study groups, housing help, careers.',
      languages: ['Hindi', 'English'],
      personaSegments: ['persona-student', 'newcomer'],
      foundedYear: 2019,
      memberCountApprox: 130,
      activityScore: 62,
      completenessScore: 55,
      trustScore: 55,
      status: 'ACTIVE' as const,
      lastActivityAt: past(16),
      categories: ['student', 'networking-social'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/iss-boeblingen',
          label: 'WhatsApp Group',
          isPrimary: true,
        },
        {
          channelType: 'INSTAGRAM' as const,
          url: 'https://instagram.com/indianstudentsbbl',
          label: 'Instagram',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Bharatanatyam Stuttgart',
      slug: 'bharatanatyam-stuttgart',
      description:
        'Classical Indian dance academy and community — Bharatanatyam classes for children and adults, annual Arangetram events.',
      languages: ['Tamil', 'Hindi', 'English'],
      personaSegments: ['family'],
      foundedYear: 2011,
      memberCountApprox: 75,
      activityScore: 55,
      completenessScore: 68,
      trustScore: 62,
      status: 'ACTIVE' as const,
      lastActivityAt: past(25),
      categories: ['arts-entertainment', 'cultural'],
      channels: [
        {
          channelType: 'INSTAGRAM' as const,
          url: 'https://instagram.com/bharatanatyam_stgt',
          label: 'Instagram',
          isPrimary: true,
        },
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/bharatanatyam-stgt',
          label: 'WhatsApp Group',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Indians in Ludwigsburg',
      slug: 'indians-in-ludwigsburg',
      description:
        'Community for Indians in Ludwigsburg — social meetups, newcomer help, recommendations for restaurants, doctors, and schools.',
      languages: ['Hindi', 'English'],
      personaSegments: ['newcomer', 'family'],
      foundedYear: 2017,
      memberCountApprox: 95,
      activityScore: 42,
      completenessScore: 50,
      trustScore: 48,
      status: 'ACTIVE' as const,
      lastActivityAt: past(48),
      categories: ['networking-social'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/indians-ldwg',
          label: 'WhatsApp Group',
          isPrimary: true,
        },
      ],
    },
  ];

  for (const c of moreCommunityDefs) {
    const { categories, channels, ...data } = c;
    const community = await prisma.community.upsert({
      where: { slug: data.slug },
      update: { activityScore: data.activityScore, lastActivityAt: data.lastActivityAt },
      create: {
        ...data,
        cityId: stuttgart.id,
        source: 'ADMIN_SEED',
        claimState: 'UNCLAIMED',
        categories: { create: categories.map((slug) => ({ categoryId: cats[slug] })) },
        accessChannels: { create: channels },
      },
    });
    communityIds[data.slug] = community.id;
    process.stdout.write(`  🏘 ${community.name}\n`);
  }
  console.log(`\n✅ Additional communities: ${moreCommunityDefs.length} seeded`);

  // ─── Consular & official resources ───────────────────────────────────────

  const resourceDefs = [
    {
      title: 'CGI Munich — Consular Camp Stuttgart',
      slug: 'cgi-munich-consular-camp-stuttgart-2026',
      resourceType: 'CONSULAR_SERVICE' as const,
      url: 'https://www.cgimunich.gov.in',
      description:
        'The Consulate General of India, Munich conducts periodic consular camps in Stuttgart for passport renewal, OCI card services, Police Clearance Certificates (PCC), and document attestation. Check the CGI Munich website for upcoming camp dates.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Passport Seva Portal — Renewal & New Applications',
      slug: 'passport-seva-renewal-india',
      resourceType: 'GOVERNMENT_INFO' as const,
      url: 'https://passportindia.gov.in',
      description:
        'Official Government of India portal for passport applications and renewals. For Germans-based Indians, appointments are typically handled through CGI Munich or via the e-Passport portal.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'VFS Global — Indian Visa & Passport Services Germany',
      slug: 'vfs-global-india-germany',
      resourceType: 'VISA_SERVICE' as const,
      url: 'https://www.vfsglobal.com/India/Germany',
      description:
        'VFS Global is the authorised service provider for Indian passports and OCI card applications in Germany. Nearest VFS centre to Stuttgart is in Munich or Frankfurt. You can track your application status online.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'OCI Card — Application & Renewal',
      slug: 'oci-card-application-germany',
      resourceType: 'GOVERNMENT_INFO' as const,
      url: 'https://ociservices.gov.in',
      description:
        'Overseas Citizenship of India (OCI) application portal. Required documents include German residence permit, current passport, Indian birth certificate, and photos. Apply online and submit at the nearest VFS centre.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Police Clearance Certificate (PCC) — Germany',
      slug: 'pcc-india-germany',
      resourceType: 'CONSULAR_SERVICE' as const,
      url: 'https://www.cgimunich.gov.in/pages/pcc',
      description:
        'Police Clearance Certificates (PCC) for Indians in Germany are issued by CGI Munich. Required for long-term visa applications, employment checks, and immigration. Applications can be submitted by post or at consular camps.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'India House Stuttgart — Honorary Consulate',
      slug: 'india-house-stuttgart-honorary-consulate',
      resourceType: 'CONSULAR_SERVICE' as const,
      url: 'https://www.cgimunich.gov.in',
      description:
        'Baden-Württemberg falls under the jurisdiction of the Consulate General of India, Munich. There is no full consulate in Stuttgart. For urgent assistance, contact CGI Munich directly. The HSS Stuttgart and other community organisations often coordinate to inform communities about upcoming camp dates.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Indian Community Cultural Night — CGI Munich Official Event',
      slug: 'cgi-munich-cultural-night-2026',
      resourceType: 'OFFICIAL_EVENT' as const,
      url: 'https://www.cgimunich.gov.in',
      description:
        'CGI Munich organises periodic national day receptions and cultural nights open to the Indian diaspora. Republic Day (26 Jan) and Independence Day (15 Aug) flag-hoisting ceremonies are held at the Consulate in Munich, with special charter buses often arranged from Stuttgart by community groups.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'MOIA — Ministry of Overseas Indian Affairs Resources',
      slug: 'moia-overseas-indian-resources',
      resourceType: 'GOVERNMENT_INFO' as const,
      url: 'https://www.mea.gov.in/overseas-indian-affairs.htm',
      description:
        'Indian government portal for overseas Indians — scholarships, Pravasi Bharatiya Divas information, e-Migrate schemes, and diaspora support programs.',
      validFrom: null,
      validUntil: null,
    },
  ];

  let resourceCount = 0;
  for (const r of resourceDefs) {
    await prisma.resource.upsert({
      where: { slug: r.slug },
      update: {},
      create: {
        ...r,
        cityId: stuttgart.id,
        source: 'ADMIN_SEED',
      },
    });
    resourceCount++;
  }
  console.log(`✅ Resources: ${resourceCount} consular/official resources seeded`);

  // ─── Update lastActivityAt on communities based on their events ───────────

  for (const c of communityDefs) {
    await prisma.community.update({
      where: { slug: c.slug },
      data: { lastActivityAt: c.lastActivityAt },
    });
  }

  // ─── Recompute all scores from real event data ──────────────────────────
  const { updated } = await refreshAllScores();
  console.log(`✅ Scores refreshed: ${updated} communities updated`);

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
