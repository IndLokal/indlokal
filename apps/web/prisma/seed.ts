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

const prisma = new PrismaClient();

// Helpers — produces clean event dates
const past = (daysAgo: number, hour = 18) =>
  setMinutes(setHours(subDays(new Date(), daysAgo), hour), 0);
const future = (daysAhead: number, hour = 18) =>
  setMinutes(setHours(addDays(new Date(), daysAhead), hour), 0);

async function main() {
  console.log('🌱 Seeding IndLokal database...\n');

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
          url: 'https://hssgermany.org/',
          label: 'Website',
          isPrimary: false,
        },
        {
          channelType: 'INSTAGRAM' as const,
          url: 'https://instagram.com/hssgermany/',
          label: 'Instagram',
          isPrimary: false,
        },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://www.facebook.com/hssdeutschland/',
          label: 'Facebook',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Samaikya Telugu Vedika e.V. (STV)',
      slug: 'telugu-association-bw',
      description:
        'Registered Verein for Telugu-speaking families in Baden-Württemberg — Ugadi, Sankranti, and regular meetups.',
      descriptionLong:
        'Samaikya Telugu Vedika (STV) e.V. brings together Telugu-speaking professionals and families across Stuttgart and the surrounding region. Major events include Ugadi, Sankranti, and summer picnics. Founded by Hyderabad and Andhra expats working at Bosch and Mercedes.',
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
          channelType: 'WEBSITE' as const,
          url: 'https://stvgermany.de/',
          label: 'Website',
          isPrimary: false,
        },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://www.facebook.com/groups/stvgermany/',
          label: 'Facebook Group',
          isPrimary: false,
        },
        {
          channelType: 'YOUTUBE' as const,
          url: 'https://www.youtube.com/@samaikyateluguvedika239',
          label: 'YouTube',
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
      name: 'Kasturi Kannada Koota Stuttgart',
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
        {
          channelType: 'INSTAGRAM' as const,
          url: 'https://instagram.com/kasturikannadakootastuttgart/',
          label: 'Instagram',
          isPrimary: false,
        },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://www.facebook.com/groups/kasturikannadakootastuttgart/',
          label: 'Facebook Group',
          isPrimary: false,
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
    {
      name: 'Sikh Gurudwara Stuttgart e.V.',
      slug: 'sikh-gurudwara-stuttgart',
      description:
        'Gurudwara serving the Sikh community in the Stuttgart metro — weekly kirtan, langar, and Gurpurab celebrations.',
      languages: ['Punjabi', 'Hindi', 'English'],
      personaSegments: ['family', 'newcomer'],
      foundedYear: 2007,
      memberCountApprox: 120,
      activityScore: 65,
      completenessScore: 70,
      trustScore: 72,
      status: 'ACTIVE' as const,
      lastActivityAt: past(4),
      categories: ['religious', 'cultural'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/sikh-stgt',
          label: 'WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Bengali Association Stuttgart',
      slug: 'bengali-association-stuttgart',
      description:
        'Durga Puja, Rabindra Jayanti and Bengali cultural evenings in Stuttgart. Active since 2011 as a registered Verein.',
      languages: ['Bengali', 'Hindi', 'English'],
      personaSegments: ['family', 'working-professional'],
      foundedYear: 2011,
      memberCountApprox: 90,
      activityScore: 50,
      completenessScore: 60,
      trustScore: 58,
      status: 'ACTIVE' as const,
      lastActivityAt: past(18),
      categories: ['language-regional', 'cultural'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/bengali-stgt',
          label: 'WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indian Film Festival Stuttgart Community',
      slug: 'indian-film-festival-stuttgart',
      description:
        'Community around the annual Indian Film Festival Stuttgart (22+ years running). Year-round film screenings, discussions and filmmaker meetups.',
      languages: ['English', 'Hindi'],
      personaSegments: ['working-professional', 'single', 'persona-student'],
      foundedYear: 2003,
      memberCountApprox: 200,
      activityScore: 62,
      completenessScore: 72,
      trustScore: 78,
      status: 'ACTIVE' as const,
      lastActivityAt: past(8),
      categories: ['arts-entertainment', 'cultural'],
      channels: [
        {
          channelType: 'WEBSITE' as const,
          url: 'https://indisches-filmfestival.de',
          label: 'Official Website',
          isPrimary: true,
        },
        {
          channelType: 'INSTAGRAM' as const,
          url: 'https://instagram.com/indianfilmfestival',
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

  // ─── Verified communities (from WhatsApp community list, Apr 2026) ──────

  const satelliteIds = {
    boeblingen: (await prisma.city.findUnique({ where: { slug: 'boeblingen' } }))!.id,
    sindelfingen: (await prisma.city.findUnique({ where: { slug: 'sindelfingen' } }))!.id,
    esslingen: (await prisma.city.findUnique({ where: { slug: 'esslingen' } }))!.id,
  };

  const verifiedCommunityDefs = [
    {
      name: 'Bihar Fraternity Stuttgart',
      slug: 'bihar-fraternity-stuttgart',
      description:
        'Bihari community in Stuttgart celebrating festivals like Makar Sankranti, Chhath Puja. Part of the Bharatiya Parivar umbrella of 24 Vereine.',
      languages: ['Hindi', 'Bhojpuri', 'Maithili'],
      personaSegments: ['family', 'working-professional'],
      activityScore: 45,
      completenessScore: 55,
      trustScore: 55,
      status: 'ACTIVE' as const,
      lastActivityAt: past(20),
      categories: ['cultural', 'language-regional'],
      cityId: stuttgart.id,
      channels: [
        {
          channelType: 'INSTAGRAM' as const,
          url: 'https://www.instagram.com/stuttgartbiharfraternity/',
          isPrimary: true,
        },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://www.facebook.com/groups/bihariingermany/',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Ezenz e.V.',
      slug: 'ezenz-ev',
      description:
        'EZENZ — Einheit in Zivilisatorischen wErten uNd Zusammenarbeit. Indo-German cultural dialogue organisation.',
      languages: ['Hindi', 'German'],
      personaSegments: ['working-professional', 'family'],
      activityScore: 42,
      completenessScore: 52,
      trustScore: 50,
      status: 'ACTIVE' as const,
      lastActivityAt: past(25),
      categories: ['cultural', 'networking-social'],
      cityId: stuttgart.id,
      channels: [
        {
          channelType: 'INSTAGRAM' as const,
          url: 'https://www.instagram.com/ezenz.ev/',
          isPrimary: true,
        },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://www.facebook.com/Ezenz.de/',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'India Culture Forum e.V. (ICF)',
      slug: 'icf-ev-stuttgart',
      description:
        'One of the oldest Indian Vereine in Germany, registered in Stuttgart since 2006. Promotes Indian culture through events like Diwali, Navaratri, and Summerfest.',
      languages: ['Hindi', 'German'],
      personaSegments: ['family', 'working-professional'],
      foundedYear: 2006,
      memberCountApprox: 200,
      activityScore: 68,
      completenessScore: 80,
      trustScore: 78,
      status: 'ACTIVE' as const,
      lastActivityAt: past(10),
      categories: ['cultural', 'arts-entertainment'],
      cityId: stuttgart.id,
      channels: [
        { channelType: 'WEBSITE' as const, url: 'https://indiacultureforum.de/', isPrimary: true },
        {
          channelType: 'INSTAGRAM' as const,
          url: 'https://www.instagram.com/icfev/',
          isPrimary: false,
        },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://www.facebook.com/icfev/',
          isPrimary: false,
        },
        {
          channelType: 'YOUTUBE' as const,
          url: 'https://www.youtube.com/@indiacultureforum',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'SAMVAAD Germany',
      slug: 'samvaad-germany',
      description:
        'Focused on integration of Indian families in Germany. Organises open dialogues on German schooling, career pathways, and Indo-German relations.',
      languages: ['Hindi', 'German', 'English'],
      personaSegments: ['family', 'working-professional', 'newcomer'],
      activityScore: 48,
      completenessScore: 58,
      trustScore: 55,
      status: 'ACTIVE' as const,
      lastActivityAt: past(15),
      categories: ['networking-social', 'cultural'],
      cityId: stuttgart.id,
      channels: [
        { channelType: 'WEBSITE' as const, url: 'https://www.samvadgermany.org/', isPrimary: true },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://www.facebook.com/people/Samvad-Germany/100068660136672/',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Bindi e.V.',
      slug: 'bindi-ev-stuttgart',
      description:
        'BINDI: Bengalische Indische und Deutsche Initiative — Bengali/Indian cultural organisation since 2015. Durga Puja, Bengali Borshoboron, and cultural events.',
      languages: ['Bengali', 'German'],
      personaSegments: ['family', 'working-professional'],
      foundedYear: 2015,
      activityScore: 52,
      completenessScore: 65,
      trustScore: 60,
      status: 'ACTIVE' as const,
      lastActivityAt: past(12),
      categories: ['cultural', 'language-regional'],
      cityId: stuttgart.id,
      channels: [
        { channelType: 'WEBSITE' as const, url: 'https://bindi-ev.org/', isPrimary: true },
        {
          channelType: 'INSTAGRAM' as const,
          url: 'https://www.instagram.com/bindi.ev/',
          isPrimary: false,
        },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://www.facebook.com/100070137490845/',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Maitree e.V.',
      slug: 'maitree-ev-esslingen',
      description:
        'Indian Bengali community in Esslingen/Stuttgart area. Organises Stuttgart Sarbojonin Durga Puja, Saraswati Puja, and cultural integration events.',
      languages: ['Bengali', 'German'],
      personaSegments: ['family', 'working-professional'],
      activityScore: 55,
      completenessScore: 70,
      trustScore: 65,
      status: 'ACTIVE' as const,
      lastActivityAt: past(10),
      categories: ['cultural', 'language-regional', 'religious'],
      cityId: satelliteIds.esslingen,
      channels: [
        { channelType: 'WEBSITE' as const, url: 'https://maitree-ev.org/', isPrimary: true },
        {
          channelType: 'INSTAGRAM' as const,
          url: 'https://www.instagram.com/maitree.ev/',
          isPrimary: false,
        },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://www.facebook.com/MaitreeStuttgart/',
          isPrimary: false,
        },
        {
          channelType: 'YOUTUBE' as const,
          url: 'https://www.youtube.com/@maitree_ev',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'DeBI e.V.',
      slug: 'debi-ev-stuttgart',
      description:
        'A group of expatriate Bengalis fostering Bengali culture and heritage in Germany. Known for Durga Pujo in Stuttgart and music events.',
      languages: ['Bengali', 'German'],
      personaSegments: ['family', 'working-professional'],
      activityScore: 50,
      completenessScore: 62,
      trustScore: 58,
      status: 'ACTIVE' as const,
      lastActivityAt: past(14),
      categories: ['cultural', 'language-regional', 'arts-entertainment'],
      cityId: stuttgart.id,
      channels: [
        { channelType: 'WEBSITE' as const, url: 'https://www.debiev.de/', isPrimary: true },
        {
          channelType: 'INSTAGRAM' as const,
          url: 'https://www.instagram.com/debi_ev/',
          isPrimary: false,
        },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://www.facebook.com/61555151894316/',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Sindelfingen Squirrels e.V.',
      slug: 'sindelfingen-squirrels-cricket',
      description:
        'Cricket club in Sindelfingen playing in BW Landesliga. Active in tape ball and leather ball cricket with youth programs.',
      languages: ['English', 'Hindi'],
      personaSegments: ['working-professional', 'single'],
      activityScore: 55,
      completenessScore: 62,
      trustScore: 55,
      status: 'ACTIVE' as const,
      lastActivityAt: past(8),
      categories: ['sports-fitness'],
      cityId: satelliteIds.sindelfingen,
      channels: [
        { channelType: 'WEBSITE' as const, url: 'https://squirrels.de/', isPrimary: true },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://www.facebook.com/SindelfingenSquirrels/',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Indians in The Länd',
      slug: 'indians-in-the-laend',
      description:
        'BW-wide informal community for Indians living, studying, or working across Baden-Württemberg.',
      languages: ['Hindi', 'English', 'German'],
      personaSegments: ['newcomer', 'working-professional'],
      activityScore: 40,
      completenessScore: 45,
      trustScore: 48,
      status: 'ACTIVE' as const,
      lastActivityAt: past(10),
      categories: ['networking-social'],
      cityId: stuttgart.id,
      channels: [
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://www.facebook.com/groups/1393064338860177/',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'German Tamil Sangam e.V.',
      slug: 'german-tamil-sangam',
      description:
        'Fosters Tamil art, culture, language, and heritage. Runs Tamil Academy for children. Registered at Amtsgericht Stuttgart, based in Böblingen.',
      languages: ['Tamil', 'German'],
      personaSegments: ['family', 'working-professional'],
      activityScore: 58,
      completenessScore: 68,
      trustScore: 65,
      status: 'ACTIVE' as const,
      lastActivityAt: past(15),
      categories: ['language-regional', 'cultural', 'family-kids'],
      cityId: satelliteIds.boeblingen,
      channels: [
        { channelType: 'WEBSITE' as const, url: 'https://tamilsangam.de/', isPrimary: true },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://www.facebook.com/103474994944223/',
          isPrimary: false,
        },
        {
          channelType: 'YOUTUBE' as const,
          url: 'https://www.youtube.com/c/GermanTamilSangam',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'TSVM Cricket Stuttgart (Cricket Vision Campus)',
      slug: 'tsvm-cricket-stuttgart',
      description:
        'Professional cricket club in Malmsheim (Landkreis Böblingen), est. 2019. Cricket Vision Campus initiative for skilled worker integration through cricket.',
      languages: ['English', 'Hindi'],
      personaSegments: ['working-professional', 'single'],
      foundedYear: 2019,
      activityScore: 52,
      completenessScore: 65,
      trustScore: 58,
      status: 'ACTIVE' as const,
      lastActivityAt: past(6),
      categories: ['sports-fitness'],
      cityId: stuttgart.id,
      channels: [
        {
          channelType: 'WEBSITE' as const,
          url: 'https://cricket.tsv-malmsheim.de/',
          isPrimary: true,
        },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://www.facebook.com/Malmsheimcricket/',
          isPrimary: false,
        },
        {
          channelType: 'YOUTUBE' as const,
          url: 'https://www.youtube.com/@TSVMalmsheimCricket',
          isPrimary: false,
        },
        {
          channelType: 'LINKEDIN' as const,
          url: 'https://de.linkedin.com/company/tsv-malmsheim-cricket',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Heilbronn Kannada Balaga e.V.',
      slug: 'heilbronn-kannada-balaga',
      description:
        'Registered Kannada community organisation in Heilbronn. Registered at Amtsgericht Stuttgart, VR 727543.',
      languages: ['Kannada', 'German'],
      personaSegments: ['family'],
      activityScore: 25,
      completenessScore: 35,
      trustScore: 45,
      status: 'ACTIVE' as const,
      lastActivityAt: past(60),
      categories: ['language-regional', 'cultural'],
      cityId: stuttgart.id,
      channels: [],
    },
  ];

  for (const c of verifiedCommunityDefs) {
    const { categories, channels, cityId, ...data } = c;
    const community = await prisma.community.upsert({
      where: { slug: data.slug },
      update: { activityScore: data.activityScore, lastActivityAt: data.lastActivityAt },
      create: {
        ...data,
        cityId,
        source: 'ADMIN_SEED',
        claimState: 'UNCLAIMED',
        categories: { create: categories.map((slug) => ({ categoryId: cats[slug] })) },
        accessChannels: { create: channels },
      },
    });
    communityIds[data.slug] = community.id;
    process.stdout.write(`  🏘 ${community.name}\n`);
  }
  console.log(`\n✅ Verified communities: ${verifiedCommunityDefs.length} seeded`);

  // ─── Resources — comprehensive Indian expat knowledge base ────────────

  const resourceDefs = [
    // ── Consular & Indian Government ──
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
        'Official Government of India portal for passport applications and renewals. For Germany-based Indians, appointments are typically handled through CGI Munich or via the e-Passport portal.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'VFS Global — Indian Visa & Passport Services Germany',
      slug: 'vfs-global-india-germany',
      resourceType: 'VISA_SERVICE' as const,
      url: 'https://www.vfsglobal.com/India/Germany',
      description:
        'VFS Global is the authorised service provider for Indian passports and OCI card applications in Germany. Nearest VFS centres to Stuttgart are in Munich and Frankfurt. You can track your application status online.',
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
        'Baden-Württemberg falls under the jurisdiction of the Consulate General of India, Munich. There is no full consulate in Stuttgart. For urgent assistance, contact CGI Munich directly.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'CGI Munich — Republic Day & Independence Day Celebrations',
      slug: 'cgi-munich-cultural-night-2026',
      resourceType: 'OFFICIAL_EVENT' as const,
      url: 'https://www.cgimunich.gov.in',
      description:
        'CGI Munich organises Republic Day (26 Jan) and Independence Day (15 Aug) flag-hoisting ceremonies at the Consulate. Special charter buses are often arranged from Stuttgart by community groups like HSS Stuttgart.',
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

    // ── City Registration & Visa ──
    {
      title: 'Anmeldung — City Registration',
      slug: 'guide-anmeldung-stuttgart',
      resourceType: 'CITY_REGISTRATION' as const,
      url: null,
      description:
        "Anmeldung (city registration) is mandatory within 14 days of moving to Stuttgart. You need: passport, rental contract, and Wohnungsgeberbestätigung (landlord confirmation form). Register at any Bürgerbüro — Mitte is the largest. Book online or walk in. You'll receive a Meldebescheinigung (registration certificate) and your Steuer-ID (tax ID) arrives by post in 2-3 weeks.",
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Abmeldung — Deregistration When Leaving',
      slug: 'guide-abmeldung-germany',
      resourceType: 'CITY_REGISTRATION' as const,
      url: null,
      description:
        "When leaving Germany permanently, you must deregister (Abmeldung) at any Bürgerbüro up to 14 days before departure. You need: passport, Meldebescheinigung, and the Abmeldung form. Also notify your bank, health insurance (Krankenkasse), employer, and cancel your GEZ (Rundfunkbeitrag). Keep the Abmeldebescheinigung — you'll need it for tax filings and closing accounts.",
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Ausländerbehörde — Residence Permit & Visa Extension',
      slug: 'guide-auslaenderbehorde-stuttgart',
      resourceType: 'CITY_REGISTRATION' as const,
      url: null,
      description:
        "The Ausländerbehörde (foreigners' registration office) in Stuttgart handles residence permits, visa extensions, and Blue Card issuance. Located at Eberhardstr. 39. Book appointments via the online portal — walk-ins have long waits. Bring: passport, biometric photo, employment contract, health insurance proof, Meldebescheinigung, and previous visa. Processing takes 4-8 weeks.",
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'EU Blue Card — For Skilled Workers',
      slug: 'guide-eu-blue-card',
      resourceType: 'CITY_REGISTRATION' as const,
      url: 'https://www.make-it-in-germany.com/en/visa-residence/types/eu-blue-card',
      description:
        'The EU Blue Card is the main residence permit for qualified Indian professionals in Germany. Requirements: a recognised university degree and a job offer with a minimum annual salary of €45,300 (2024, or €41,042 for shortage occupations like IT and engineering). Apply at the German embassy in India before arrival, or convert from a job-seeker visa at the Ausländerbehörde after arrival. Blue Card holders can apply for permanent residence (Niederlassungserlaubnis) after 21 months with B1 German.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Niederlassungserlaubnis — Permanent Residence',
      slug: 'guide-niederlassungserlaubnis-pr',
      resourceType: 'CITY_REGISTRATION' as const,
      url: null,
      description:
        'Permanent residence (Niederlassungserlaubnis) is the holy grail for long-term stay. Blue Card holders: eligible after 21 months (with B1 German) or 33 months (with A1). Requirements: 21+ months of Blue Card, pension contributions for the same period, B1 German certificate (Goethe/telc), valid health insurance, sufficient income, no criminal record. Apply at the Ausländerbehörde with all supporting documents.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Verpflichtungserklärung — Invitation Letter for Visitors',
      slug: 'guide-verpflichtungserklaerung',
      resourceType: 'CITY_REGISTRATION' as const,
      url: null,
      description:
        "To invite family from India for a visit, you may need a Verpflichtungserklärung (formal obligation letter) from the Ausländerbehörde. This guarantees you'll cover their expenses during the stay. Requirements: your passport, Meldebescheinigung, last 3 salary slips, employment contract. Fee: ~€29. The original is sent to your family member who submits it with their Schengen visa application at VFS/German embassy.",
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Family Reunion Visa — Bringing Spouse & Children',
      slug: 'guide-family-reunion-visa',
      resourceType: 'CITY_REGISTRATION' as const,
      url: null,
      description:
        "Spouse and children of Blue Card / residence permit holders can apply for a family reunion visa (Familiennachzug) at the German embassy in India. Requirements: proof of relationship (marriage certificate, birth certificates — apostilled), A1 German certificate for spouse (Goethe Institut), sufficient living space, adequate income, and health insurance. Children under 16 don't need a German certificate. Processing: 4-12 weeks.",
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Marriage Registration — Indian Couples in Germany',
      slug: 'guide-marriage-registration-germany',
      resourceType: 'CITY_REGISTRATION' as const,
      url: null,
      description:
        'To register a marriage performed in India, bring your Indian marriage certificate (apostilled), both passports, birth certificates, and Meldebescheinigung to the Standesamt (civil registry office). For marrying in Germany: apply at the Standesamt with an Ehefähigkeitszeugnis (certificate of no impediment) — Indians can get this from CGI Munich. Processing takes 6-12 weeks. A sworn translator is needed for all Hindi/regional language documents.',
      validFrom: null,
      validUntil: null,
    },

    // ── Driving ──
    {
      title: 'Driving Licence Conversion — Indian to German',
      slug: 'guide-driving-licence-conversion',
      resourceType: 'DRIVING' as const,
      url: null,
      description:
        'Indian driving licences are NOT directly convertible in Germany — you must pass both the theory test (available in English, 30 multiple-choice questions) and the practical driving test. Steps: (1) enrol at a Fahrschule, (2) attend mandatory theory hours, (3) pass theory test at TÜV/DEKRA, (4) take practical lessons, (5) pass practical test. Total cost: €1,500-€2,500. Your Indian licence is valid for 6 months after arrival — drive with an official translation during that period.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Finding an English-Speaking Fahrschule',
      slug: 'guide-fahrschule-english-stuttgart',
      resourceType: 'DRIVING' as const,
      url: null,
      description:
        'Several Fahrschulen (driving schools) in Stuttgart offer theory lessons in English. The theory test itself can be taken in English at TÜV or DEKRA. Ask Indian community WhatsApp groups for recommendations — many Indians have done this recently and can suggest good instructors. Budget: €200-€400 for theory + €1,200-€2,000 for practical lessons (number of lessons varies).',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'International Driving Permit (IDP)',
      slug: 'guide-international-driving-permit',
      resourceType: 'DRIVING' as const,
      url: null,
      description:
        'An International Driving Permit (IDP) issued in India is technically valid in Germany for 6 months after arrival alongside your Indian licence. However, many car rental companies and insurance providers require a German or EU licence. Get your Indian licence translated by a sworn translator (beglaubigte Übersetzung) for day-to-day use. After 6 months, you MUST have a German licence.',
      validFrom: null,
      validUntil: null,
    },

    // ── Grocery & Food ──
    {
      title: 'Finding Indian Groceries in Stuttgart',
      slug: 'guide-indian-groceries-stuttgart',
      resourceType: 'GROCERY_FOOD' as const,
      url: null,
      description:
        'Stuttgart has several Indian and Asian grocery stores stocking spices, dals, rice (basmati, sona masoori), atta, frozen parathas, paneer, and fresh vegetables like curry leaves and green chillies. Key areas: Charlottenplatz, Bad Cannstatt, and Vaihingen. Ask in the "Indians in Stuttgart" WhatsApp group for current recommendations — stores change frequently. For specific South Indian items (urad dal, MTR mixes, coconut oil), check dedicated Indian stores over general Asian shops.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Indian Restaurants in Stuttgart',
      slug: 'guide-indian-restaurants-stuttgart',
      resourceType: 'GROCERY_FOOD' as const,
      url: null,
      description:
        'Stuttgart has a growing Indian restaurant scene with options ranging from budget dosa counters to upscale North Indian dining. Popular areas: Stadtmitte, Bad Cannstatt, Vaihingen (near uni). Many offer lunch buffets (€10-€15). Vegetarian-friendly options are common. For authentic home-style cooking, check community potluck events run by groups like Tamil Sangam and Malayalee Deutsches Treffen. Search "Indian restaurant Stuttgart" on Google Maps for current ratings.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Online Indian Grocery Delivery — Germany-Wide',
      slug: 'guide-online-indian-grocery-germany',
      resourceType: 'GROCERY_FOOD' as const,
      url: null,
      description:
        'Several online stores deliver Indian groceries across Germany: desicorner.de, indischekost.de, and spicevillage.eu are popular. Delivery to Stuttgart usually takes 2-4 business days. Useful for bulk buys (25kg basmati rice, dal in bulk) and hard-to-find items (specific brands like MDH, Everest, Patanjali). Compare prices — local stores are sometimes cheaper for fresh items.',
      validFrom: null,
      validUntil: null,
    },

    // ── Jobs & Careers ──
    {
      title: 'Job Portals for Internationals in Germany',
      slug: 'guide-job-portals-internationals',
      resourceType: 'JOBS_CAREERS' as const,
      url: null,
      description:
        'Key job portals: StepStone.de and Indeed.de (largest general boards), LinkedIn (strong for international roles), XING (German LinkedIn — important for local networking), Glassdoor.de (company reviews + jobs). For Stuttgart automotive: check career pages of Bosch, Mercedes-Benz, Porsche, ZF, Mahle, Continental directly. IT roles: check Stack Overflow Jobs and WeAreDevelopers. Agencies: Hays, Robert Half, Michael Page handle many Indian professional placements.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Freelance Visa — Self-Employment in Germany (§21 AufenthG)',
      slug: 'guide-freelance-visa-germany',
      resourceType: 'JOBS_CAREERS' as const,
      url: null,
      description:
        'The freelance visa (Aufenthaltserlaubnis zur Ausübung einer selbständigen Tätigkeit, §21 AufenthG) lets non-EU citizens work as freelancers (Freiberufler) in Germany. Requirements: business plan, proof of clients, sufficient savings (€5,000+), health insurance, and a tax advisor (Steuerberater). Apply at the Ausländerbehörde. Processing: 2-4 months. Note: you cannot freelance on a Blue Card without a separate permit.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Agentur für Arbeit — Job Search & Unemployment Benefits',
      slug: 'guide-agentur-fuer-arbeit',
      resourceType: 'JOBS_CAREERS' as const,
      url: 'https://www.arbeitsagentur.de/en/',
      description:
        "The Agentur für Arbeit (Federal Employment Agency) offers job placement, career counselling, and unemployment benefits (ALG I). If you lose your job, register immediately — ALG I is 60-67% of your last net salary for up to 12 months (if you've contributed for 12+ months). Blue Card holders: you have 3 months to find a new job before your residence permit is affected. The Stuttgart office is at Nordbahnhofstr. 30-34.",
      validFrom: null,
      validUntil: null,
    },

    // ── Tax & Finance ──
    {
      title: 'Annual Tax Declaration (Steuererklärung)',
      slug: 'guide-steuererklaerung-basics',
      resourceType: 'TAX_FINANCE' as const,
      url: 'https://www.elster.de',
      description:
        'Every employee in Germany should file an annual tax return (Steuererklärung) — most Indians get €500-€2,000 back. File via ELSTER (free, official portal), tax software (WISO Steuer, SteuerGo — some in English), or a Steuerberater. Key deductions: commuting (Pendlerpauschale, €0.30/km), home office (€6/day), work equipment, language courses, moving costs, and double household maintenance (doppelte Haushaltsführung) if your family is still in India. Deadline: 31 July (or 28 Feb next year with a Steuerberater).',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'India-Germany DTAA — Double Taxation Avoidance',
      slug: 'guide-dtaa-india-germany',
      resourceType: 'TAX_FINANCE' as const,
      url: null,
      description:
        'The India-Germany Double Taxation Avoidance Agreement (DTAA) prevents you from being taxed twice on the same income. Key points: (1) Salary earned in Germany is taxed only in Germany, (2) Indian rental income: taxed in India, but you get a credit in Germany, (3) RSUs/ESOPs: complex — usually taxed in both, credit applies, (4) NRE account interest: tax-free in India, must be declared in Germany, (5) Capital gains on Indian mutual funds: declare in German return. A Steuerberater who understands DTAA is essential — not all do.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'NRE & NRO Accounts — Managing Indian Finances from Germany',
      slug: 'guide-nre-nro-accounts',
      resourceType: 'TAX_FINANCE' as const,
      url: null,
      description:
        'As an NRI (Non-Resident Indian), you must convert your Indian savings accounts to NRE (Non-Resident External) or NRO (Non-Resident Ordinary). NRE: for parking foreign earnings in India — interest is tax-free in India, fully repatriable. NRO: for Indian-sourced income (rent, dividends) — taxed in India, limited repatriation ($1M/year). Notify your Indian bank within a reasonable time of moving abroad. Keep both types for flexibility.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'ELSTER — Online Tax Filing Portal',
      slug: 'guide-elster-tax-portal',
      resourceType: 'TAX_FINANCE' as const,
      url: 'https://www.elster.de',
      description:
        'ELSTER is the official German online tax filing system. Create an account (takes ~2 weeks for activation letter). You can file your Steuererklärung, change your tax class (Steuerklasse), and submit VAT returns here — all free. The interface is in German only, but browser translation works. Your Steuer-ID (11-digit number) arrives by post after Anmeldung and is used for all tax matters.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Finding an English-Speaking Steuerberater',
      slug: 'guide-steuerberater-english',
      resourceType: 'TAX_FINANCE' as const,
      url: null,
      description:
        "A Steuerberater (tax advisor) costs €300-€1,500/year depending on complexity but often pays for itself in deductions you'd miss. For Indians: look for one who understands DTAA, RSU/ESOP taxation, and NRE/NRO accounts. Ask in Indian community WhatsApp groups for recommendations. Alternatively, tax software like WISO Steuer (€30/year, partly English) or SteuerGo (English) works for simpler cases. Steuerberater extends your filing deadline to February of the following year.",
      validFrom: null,
      validUntil: null,
    },

    // ── Business Setup ──
    {
      title: 'Freiberufler vs Gewerbe — Understanding the Difference',
      slug: 'guide-freiberufler-vs-gewerbe',
      resourceType: 'BUSINESS_SETUP' as const,
      url: null,
      description:
        "Germany distinguishes between Freiberufler (freelancers in regulated professions: IT consultants, engineers, doctors, teachers, artists) and Gewerbetreibende (tradespeople running a Gewerbe: shops, agencies, most online businesses). Key difference: Freiberufler don't pay Gewerbesteuer (trade tax) and have simpler bookkeeping. Your Finanzamt decides your classification. If you're an IT consultant from India — you're likely Freiberufler. If you open a restaurant — that's Gewerbe.",
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Gewerbeanmeldung — Trade Licence Registration',
      slug: 'guide-gewerbeanmeldung',
      resourceType: 'BUSINESS_SETUP' as const,
      url: null,
      description:
        "If you're starting a Gewerbe (not Freiberufler), register at the Gewerbeamt in Stuttgart. Bring: passport, residence permit (must allow self-employment), and the completed Gewerbeanmeldung form. Fee: ~€26. After registration you'll automatically be enrolled in the IHK (Chamber of Commerce, ~€150-€300/year) and receive a Gewerbeschein. You must also register with the Finanzamt separately.",
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Fragebogen zur steuerlichen Erfassung — Finanzamt Registration',
      slug: 'guide-fragebogen-steuerliche-erfassung',
      resourceType: 'BUSINESS_SETUP' as const,
      url: null,
      description:
        "Every new business (Freiberufler or Gewerbe) must register with the Finanzamt using the Fragebogen zur steuerlichen Erfassung. This 8-page form (available on ELSTER) asks about your business type, expected revenue, and VAT status. Key decision: Kleinunternehmerregelung (small business exemption) — if revenue <€22,000/year, you can skip charging VAT (simpler, but you can't reclaim VAT on purchases). Processing: 4-8 weeks to get your Steuernummer.",
      validFrom: null,
      validUntil: null,
    },

    // ── Family & Children ──
    {
      title: 'Kindergeld — Child Benefit for Non-EU Families',
      slug: 'guide-kindergeld-non-eu',
      resourceType: 'FAMILY_CHILDREN' as const,
      url: 'https://familienportal.de/familienportal/familienleistungen/kindergeld',
      description:
        "Kindergeld (child benefit) is €250/month per child. Non-EU citizens are eligible if they have a residence permit that allows employment (Blue Card, work permit). Apply at the Familienkasse (part of Agentur für Arbeit) with: birth certificate (apostilled + translated), passport, residence permit, Meldebescheinigung, and Steuer-ID for both parent and child. Children don't need to live in Germany — but the child must be registered. Processing: 4-6 weeks. Retrospective claim: up to 6 months.",
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Elterngeld — Parental Allowance',
      slug: 'guide-elterngeld-parental-allowance',
      resourceType: 'FAMILY_CHILDREN' as const,
      url: 'https://familienportal.de/familienportal/familienleistungen/elterngeld',
      description:
        "Elterngeld replaces 65-67% of your net income (up to €1,800/month) for 12-14 months after a child's birth. Both parents can split this. ElterngeldPlus lets you work part-time and receive reduced Elterngeld for up to 28 months. Apply at the L-Bank (Baden-Württemberg) within the first 3 months of birth — it's only paid retroactively for 3 months. Documents: birth certificate, salary slips (last 12 months), tax ID, residence permit. Non-EU parents are eligible with a work permit.",
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Mutterschutz & Elternzeit — Maternity Leave & Parental Leave',
      slug: 'guide-mutterschutz-elternzeit',
      resourceType: 'FAMILY_CHILDREN' as const,
      url: null,
      description:
        'Mutterschutz (maternity protection): 6 weeks before due date + 8 weeks after birth — full pay, job protected. Elternzeit (parental leave): up to 3 years per parent, job guaranteed — can be taken by fathers too. You can work up to 32 hours/week during Elternzeit. Notify your employer in writing at least 7 weeks before start. Both parents can take Elternzeit simultaneously. This is a legal right — employers cannot refuse.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Kita & Kindergarten Search — Stuttgart',
      slug: 'guide-kita-kindergarten-stuttgart',
      resourceType: 'FAMILY_CHILDREN' as const,
      url: 'https://kitafinder.stuttgart.de',
      description:
        'Use kitafinder.stuttgart.de to search and apply for Kita/Kindergarten spots in Stuttgart. Register early — waitlists can be 6-12+ months. Children have a legal right to a Kita place from age 1. Costs: income-dependent, typically €0-€400/month (meals extra). Types: Krippe (0-3 years), Kindergarten (3-6 years), Ganztag (full-day). Apply to multiple Kitas in your area. Some Kitas have bilingual (German-English) programs — ask specifically.',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'School Enrollment — For Indian Families',
      slug: 'guide-school-enrollment-stuttgart',
      resourceType: 'FAMILY_CHILDREN' as const,
      url: null,
      description:
        "Children in BW must attend school from age 6. Enrollment: register at the Grundschule (primary, ages 6-10) assigned to your residential district. Bring: child's passport, birth certificate, Meldebescheinigung, vaccination record (Masern-Impfpflicht — measles vaccination is mandatory). For children who don't speak German: Vorbereitungsklassen (VKL, preparatory classes) are available at many schools. International schools (e.g., International School of Stuttgart) are an alternative but cost €15,000-€20,000/year.",
      validFrom: null,
      validUntil: null,
    },

    // ── Health & Doctors ──
    {
      title: 'Health Insurance — GKV vs PKV',
      slug: 'guide-health-insurance-gkv-pkv',
      resourceType: 'HEALTH_DOCTORS' as const,
      url: null,
      description:
        "Health insurance is mandatory in Germany. Two types: GKV (public — TK, AOK, Barmer; ~14.6% of gross salary, split with employer) and PKV (private — only if earning >€69,300/year or self-employed). GKV: covers family members free, income-based premiums. PKV: lower premiums when young, but increases with age and doesn't cover family. Most Indians on Blue Card start with GKV (TK is the most popular among expats — English-friendly). Switch to PKV only after careful analysis.",
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Finding a Hausarzt (Family Doctor) in Stuttgart',
      slug: 'guide-finding-hausarzt-stuttgart',
      resourceType: 'HEALTH_DOCTORS' as const,
      url: null,
      description:
        "Register with a Hausarzt (GP/family doctor) as soon as you arrive — they're your gateway to the German healthcare system and provide referrals to specialists. Use jameda.de or doctolib.de to search by language (English or Hindi). Many doctors in Stuttgart accept new patients but may have waitlists. Bring your Versichertenkarte (insurance card) from your Krankenkasse. For Hindi/Tamil/Telugu-speaking doctors, ask in community WhatsApp groups.",
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Emergency Numbers & Hospitals',
      slug: 'guide-emergency-numbers-germany',
      resourceType: 'HEALTH_DOCTORS' as const,
      url: null,
      description:
        'Emergency: 112 (ambulance, fire — free, available everywhere). Police: 110. Non-emergency medical: 116 117 (ärztlicher Bereitschaftsdienst — after-hours doctor service). Nearest hospitals with emergency rooms (Notaufnahme): Katharinenhospital (Kriegsbergstr. 60), Marienhospital (Böheimstr. 37), Robert-Bosch-Krankenhaus (Auerbachstr. 110). Pharmacy emergency (Apothekennotdienst): apotheken.de shows which pharmacies are open 24/7. Keep your insurance card in your wallet.',
      validFrom: null,
      validUntil: null,
    },

    // ── Housing ──
    {
      title: 'Apartment Search in Stuttgart',
      slug: 'guide-apartment-search-stuttgart',
      resourceType: 'HOUSING' as const,
      url: null,
      description:
        "Stuttgart has a tight housing market. Key portals: ImmoScout24.de (largest), WG-Gesucht.de (shared flats/WGs), eBay Kleinanzeigen (private listings), immowelt.de. Budget for Kaltmiete (cold rent without utilities): €12-€18/sqm. Deposit (Kaution): max 3 months' cold rent. Always get a Wohnungsgeberbestätigung from your landlord for Anmeldung. For Indians arriving fresh: temporary furnished apartments (wunderflats.com, homelike.com) for the first 1-3 months while searching.",
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'Schufa — Credit Score in Germany',
      slug: 'guide-schufa-credit-score',
      resourceType: 'HOUSING' as const,
      url: 'https://www.schufa.de',
      description:
        'Schufa is Germany\'s credit reporting agency. Many landlords and banks require a Schufa-Auskunft (credit report). New arrivals have no Schufa history — this isn\'t negative, it just means no data. Get your free annual report: meineschufa.de → "Datenkopie (nach Art. 15 DS-GVO)" (free, takes 1-4 weeks by post). The paid "BonitätsAuskunft" (€29.95) is faster and formatted for landlords. Building Schufa: get a German bank account, pay bills by Lastschrift (direct debit), and use a mobile plan (not prepaid).',
      validFrom: null,
      validUntil: null,
    },
    {
      title: 'GEZ / Rundfunkbeitrag — TV & Radio License Fee',
      slug: 'guide-gez-rundfunkbeitrag',
      resourceType: 'HOUSING' as const,
      url: 'https://www.rundfunkbeitrag.de',
      description:
        "Every household in Germany pays €18.36/month for the Rundfunkbeitrag (public broadcasting fee), regardless of whether you own a TV. You're automatically registered after Anmeldung and will receive a payment letter. One fee per household (not per person). Pay by Lastschrift to avoid forgetting. If you receive social benefits (Bürgergeld), you can apply for an exemption (Befreiung). This fee is NOT optional and debts accumulate with penalties.",
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
  console.log(`✅ Resources: ${resourceCount} resources seeded (consular + expat guides)`);

  // ─── Karlsruhe ───────────────────────────────────────────────────────────

  const karlsruhe = await prisma.city.upsert({
    where: { slug: 'karlsruhe' },
    update: {},
    create: {
      name: 'Karlsruhe',
      slug: 'karlsruhe',
      state: 'Baden-Württemberg',
      country: 'Germany',
      latitude: 49.0069,
      longitude: 8.4037,
      population: 313092,
      diasporaDensityEstimate: 6000,
      isActive: true,
      isMetroPrimary: true,
      timezone: 'Europe/Berlin',
    },
  });
  console.log(`\n✅ City: ${karlsruhe.name} (no communities yet — pipeline will discover)`);

  // ─── Mannheim ────────────────────────────────────────────────────────────

  const mannheim = await prisma.city.upsert({
    where: { slug: 'mannheim' },
    update: {},
    create: {
      name: 'Mannheim',
      slug: 'mannheim',
      state: 'Baden-Württemberg',
      country: 'Germany',
      latitude: 49.4875,
      longitude: 8.466,
      population: 310658,
      diasporaDensityEstimate: 5500,
      isActive: true,
      isMetroPrimary: true,
      timezone: 'Europe/Berlin',
    },
  });
  console.log(`\n✅ City: ${mannheim.name} (no communities yet — pipeline will discover)`);

  // ─── Munich ───────────────────────────────────────────────────────────────

  const munich = await prisma.city.upsert({
    where: { slug: 'munich' },
    update: {},
    create: {
      name: 'Munich',
      slug: 'munich',
      state: 'Bavaria',
      country: 'Germany',
      latitude: 48.1351,
      longitude: 11.582,
      population: 1488202,
      diasporaDensityEstimate: 18000,
      isActive: true,
      isMetroPrimary: true,
      timezone: 'Europe/Berlin',
    },
  });
  console.log(`\n✅ City: ${munich.name} (no communities yet — pipeline will discover)`);

  // ─── Frankfurt ────────────────────────────────────────────────────────────

  const frankfurt = await prisma.city.upsert({
    where: { slug: 'frankfurt' },
    update: {},
    create: {
      name: 'Frankfurt',
      slug: 'frankfurt',
      state: 'Hesse',
      country: 'Germany',
      latitude: 50.1109,
      longitude: 8.6821,
      population: 773068,
      diasporaDensityEstimate: 14000,
      isActive: true,
      isMetroPrimary: true,
      timezone: 'Europe/Berlin',
    },
  });
  console.log(`\n✅ City: ${frankfurt.name} (no communities yet — pipeline will discover)`);

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

  // ─── Platform admin user ────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@indlokal.de';
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'PLATFORM_ADMIN' },
    create: {
      email: adminEmail,
      displayName: 'Admin',
      role: 'PLATFORM_ADMIN',
    },
  });
  console.log(`✅ Admin user: ${admin.email} (${admin.role})`);

  console.log('\n✅ Seed complete!');
  console.log(`   Stuttgart metro: 1 primary + ${satellites.length} satellites`);
  console.log(`   Karlsruhe: city seeded (communities via pipeline)`);
  console.log(`   Mannheim: city seeded (communities via pipeline)`);
  console.log(`   Munich: city seeded (communities via pipeline)`);
  console.log(`   Frankfurt: city seeded (communities via pipeline)`);
  console.log(
    `   Communities: ${communityDefs.length} + ${verifiedCommunityDefs.length} = ${communityDefs.length + verifiedCommunityDefs.length} (Stuttgart)`,
  );
  console.log(`   Events: ${eventCount} (Stuttgart, past + this week + upcoming)`);
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
