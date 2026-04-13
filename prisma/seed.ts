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

    // ── Additional events to reach 20+ density ──
    {
      title: 'Indian Running Group — Stuttgart Lauf Training',
      slug: 'indian-running-group-lauf-training-2026',
      description:
        'Group training run along Neckartal for the upcoming Stuttgart Lauf. All paces welcome — 5K and 10K groups.',
      communitySlug: 'indian-running-group-bw',
      venueName: 'Neckarpark Eingang Bad Cannstatt',
      venueAddress: 'Mercedesstr. 73, 70372 Stuttgart',
      startsAt: future(5, 8),
      endsAt: future(5, 10),
      cost: 'free',
      status: 'UPCOMING' as const,
      categories: ['sports-fitness'],
    },
    {
      title: 'Bollywood Fitness — Open Air Spring Session',
      slug: 'bollywood-fitness-spring-2026',
      description:
        'Special outdoor Bollywood dance workout in Schlossgarten. Bring a mat and water! Free trial for newcomers.',
      communitySlug: 'bollywood-fitness-stuttgart',
      venueName: 'Schlossgarten Stuttgart',
      venueAddress: 'Schlossgarten, 70173 Stuttgart',
      startsAt: future(6, 17),
      endsAt: future(6, 18),
      cost: 'free',
      status: 'UPCOMING' as const,
      categories: ['sports-fitness', 'arts-entertainment'],
    },
    {
      title: 'Indian Cooking Workshop — South Indian Dosa Masterclass',
      slug: 'dosa-masterclass-stuttgart-2026',
      description:
        'Learn to make crispy dosa, sambar and coconut chutney from scratch. Ingredients provided. Limited to 15 participants.',
      communitySlug: 'indian-cooking-circle-stuttgart',
      venueName: 'Mietküche Stuttgart-West',
      venueAddress: 'Rotebühlstr. 87, 70178 Stuttgart',
      startsAt: future(10, 11),
      endsAt: future(10, 14),
      cost: 'paid',
      status: 'UPCOMING' as const,
      categories: ['food-cooking'],
    },
    {
      title: 'Desi Hikers — Swabian Alps Spring Hike',
      slug: 'desi-hikers-swabian-alps-spring-2026',
      description:
        'Moderate 14km hike through the Swabian Alps with packed Indian lunch. Meeting at Stuttgart Hbf for carpool.',
      communitySlug: 'desi-hikers-stuttgart',
      venueName: 'Stuttgart Hauptbahnhof (main entrance)',
      venueAddress: 'Arnulf-Klett-Platz 2, 70173 Stuttgart',
      startsAt: future(8, 8),
      endsAt: future(8, 17),
      cost: 'free',
      status: 'UPCOMING' as const,
      categories: ['sports-fitness', 'networking-social'],
    },
    {
      title: 'Indian IT Professionals — Cloud Architecture Talk',
      slug: 'indian-it-cloud-talk-2026',
      description:
        'Tech talk on cloud-native architecture patterns by a senior architect from Bosch. Networking drinks after. Open to all Indian tech professionals.',
      communitySlug: 'indian-it-professionals-stuttgart',
      venueName: 'WeWork Stuttgart — Königstr.',
      venueAddress: 'Königstr. 60, 70173 Stuttgart',
      startsAt: future(12, 18),
      endsAt: future(12, 21),
      cost: 'free',
      status: 'UPCOMING' as const,
      categories: ['professional'],
    },
    {
      title: 'Hyderabadi Biryani Potluck',
      slug: 'hyderabadi-biryani-potluck-2026',
      description:
        'Community biryani cookoff and potluck — everyone brings their best biryani and we vote for the champion. Vegetarian options available.',
      communitySlug: 'hyderabadi-foodies-bw',
      venueName: 'Bürgerhaus Sindelfingen',
      venueAddress: 'Corbeil-Essonnes-Platz 6, 71063 Sindelfingen',
      startsAt: future(16, 12),
      endsAt: future(16, 16),
      cost: 'free',
      status: 'UPCOMING' as const,
      categories: ['food-cooking', 'networking-social'],
    },
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
    {
      title: 'Indian Moms — Summer Playday at Killesbergpark',
      slug: 'indian-moms-playday-summer-2026',
      description:
        'Open air playday for Indian families at Killesbergpark. Kids activities, snack sharing and parent networking. All families welcome.',
      communitySlug: 'indian-moms-stuttgart',
      venueName: 'Killesbergpark — Spielplatz',
      venueAddress: 'Stresemannstr. 4, 70191 Stuttgart',
      startsAt: future(18, 10),
      endsAt: future(18, 14),
      cost: 'free',
      status: 'UPCOMING' as const,
      categories: ['family-kids'],
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
    // ── Wave 3: 30 more communities to reach 60+ density ──
    {
      name: 'Assamese Association Stuttgart',
      slug: 'assamese-association-stuttgart',
      description:
        'Axomiya community in Stuttgart — Bihu celebrations, Assamese food festivals, and cultural preservation for BW-based Assamese families.',
      languages: ['Assamese', 'Hindi', 'English'],
      personaSegments: ['family', 'working-professional'],
      foundedYear: 2019,
      memberCountApprox: 45,
      activityScore: 38,
      completenessScore: 55,
      trustScore: 50,
      status: 'ACTIVE' as const,
      lastActivityAt: past(40),
      categories: ['language-regional', 'cultural'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/assamese-stgt',
          label: 'WhatsApp Group',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Odia Samaj Stuttgart',
      slug: 'odia-samaj-stuttgart',
      description:
        'Odia-speaking families and professionals in Stuttgart celebrating Raja, Nuakhai and Durga Puja together.',
      languages: ['Odia', 'Hindi', 'English'],
      personaSegments: ['family', 'working-professional'],
      foundedYear: 2018,
      memberCountApprox: 55,
      activityScore: 35,
      completenessScore: 50,
      trustScore: 48,
      status: 'ACTIVE' as const,
      lastActivityAt: past(45),
      categories: ['language-regional', 'cultural'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/odia-stgt',
          label: 'WhatsApp Group',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Bihar Jharkhand Forum BW',
      slug: 'bihar-jharkhand-forum-bw',
      description:
        'Network for people from Bihar and Jharkhand in Baden-Württemberg — Chhath Puja, Maithili literature events, and social get-togethers.',
      languages: ['Hindi', 'Bhojpuri', 'Maithili', 'English'],
      personaSegments: ['working-professional', 'newcomer'],
      foundedYear: 2020,
      memberCountApprox: 70,
      activityScore: 40,
      completenessScore: 52,
      trustScore: 50,
      status: 'ACTIVE' as const,
      lastActivityAt: past(35),
      categories: ['language-regional', 'networking-social'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/bihar-jh-bw',
          label: 'WhatsApp Group',
          isPrimary: true,
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
          channelType: 'WEBSITE' as const,
          url: 'https://gurudwara-stuttgart.de',
          label: 'Website',
          isPrimary: true,
        },
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/sikh-stgt',
          label: 'WhatsApp',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Jain Sangh Stuttgart',
      slug: 'jain-sangh-stuttgart',
      description:
        'Jain community group organising Paryushana, Mahavir Jayanti celebrations and vegetarian potlucks for Jain families in BW.',
      languages: ['Hindi', 'Gujarati', 'English'],
      personaSegments: ['family'],
      foundedYear: 2015,
      memberCountApprox: 40,
      activityScore: 32,
      completenessScore: 48,
      trustScore: 52,
      status: 'ACTIVE' as const,
      lastActivityAt: past(60),
      categories: ['religious', 'food-cooking'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/jain-stgt',
          label: 'WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indian IT Professionals Stuttgart',
      slug: 'indian-it-professionals-stuttgart',
      description:
        'Networking group for Indian software engineers, data scientists and IT consultants in the Stuttgart area. Monthly tech talks and career workshops.',
      languages: ['English', 'Hindi'],
      personaSegments: ['working-professional'],
      foundedYear: 2019,
      memberCountApprox: 210,
      activityScore: 58,
      completenessScore: 65,
      trustScore: 60,
      status: 'ACTIVE' as const,
      lastActivityAt: past(10),
      categories: ['professional', 'networking-social'],
      channels: [
        {
          channelType: 'LINKEDIN' as const,
          url: 'https://linkedin.com/groups/indian-it-stuttgart',
          label: 'LinkedIn Group',
          isPrimary: true,
        },
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/indian-it-stgt',
          label: 'WhatsApp',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Indian Automotive Engineers BW',
      slug: 'indian-automotive-engineers-bw',
      description:
        'Engineers from Bosch, Mercedes, Porsche, ZF and Continental connect over industry trends, career growth and social events.',
      languages: ['English', 'Hindi'],
      personaSegments: ['working-professional'],
      foundedYear: 2016,
      memberCountApprox: 340,
      activityScore: 72,
      completenessScore: 75,
      trustScore: 68,
      status: 'ACTIVE' as const,
      lastActivityAt: past(5),
      categories: ['professional'],
      channels: [
        {
          channelType: 'LINKEDIN' as const,
          url: 'https://linkedin.com/groups/indian-auto-bw',
          label: 'LinkedIn Group',
          isPrimary: true,
        },
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/auto-eng-bw',
          label: 'WhatsApp',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'SAP Indian Network Stuttgart',
      slug: 'sap-indian-network-stuttgart',
      description:
        'Indian employees and consultants at SAP Walldorf/Stuttgart — career advice, cultural events and relocation help for SAP newcomers.',
      languages: ['English', 'Hindi', 'Telugu'],
      personaSegments: ['working-professional', 'newcomer'],
      foundedYear: 2014,
      memberCountApprox: 280,
      activityScore: 60,
      completenessScore: 62,
      trustScore: 58,
      status: 'ACTIVE' as const,
      lastActivityAt: past(12),
      categories: ['professional', 'networking-social'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/sap-indian-stgt',
          label: 'WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indian Photography Club Stuttgart',
      slug: 'indian-photography-club-stuttgart',
      description:
        'Weekend photo walks, landscape trips and editing workshops for Indian photography enthusiasts in the Stuttgart area.',
      languages: ['English', 'Hindi'],
      personaSegments: ['single', 'working-professional'],
      foundedYear: 2021,
      memberCountApprox: 35,
      activityScore: 30,
      completenessScore: 45,
      trustScore: 42,
      status: 'ACTIVE' as const,
      lastActivityAt: past(55),
      categories: ['arts-entertainment', 'networking-social'],
      channels: [
        {
          channelType: 'INSTAGRAM' as const,
          url: 'https://instagram.com/indian_photo_stgt',
          label: 'Instagram',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indian Book Club Stuttgart',
      slug: 'indian-book-club-stuttgart',
      description:
        'Monthly book discussions covering Indian authors, translations and diaspora literature. Meets at the Stadtbibliothek.',
      languages: ['English', 'Hindi'],
      personaSegments: ['working-professional', 'single'],
      foundedYear: 2022,
      memberCountApprox: 20,
      activityScore: 28,
      completenessScore: 42,
      trustScore: 40,
      status: 'ACTIVE' as const,
      lastActivityAt: past(30),
      categories: ['arts-entertainment', 'cultural'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/bookclub-stgt',
          label: 'WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indian Running Group BW',
      slug: 'indian-running-group-bw',
      description:
        'Indian runners in Baden-Württemberg training together for Stuttgart Lauf, Halbmarathon and 10K races. All fitness levels welcome.',
      languages: ['English', 'Hindi'],
      personaSegments: ['working-professional', 'single'],
      foundedYear: 2020,
      memberCountApprox: 65,
      activityScore: 48,
      completenessScore: 55,
      trustScore: 50,
      status: 'ACTIVE' as const,
      lastActivityAt: past(7),
      categories: ['sports-fitness'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/running-indian-bw',
          label: 'WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Stuttgart Indian Badminton Club',
      slug: 'stuttgart-indian-badminton-club',
      description:
        'Weekly badminton sessions at Sporthalle Vaihingen for Indian players of all levels. Tournaments every quarter.',
      languages: ['English', 'Hindi'],
      personaSegments: ['working-professional', 'single', 'persona-student'],
      foundedYear: 2018,
      memberCountApprox: 50,
      activityScore: 52,
      completenessScore: 58,
      trustScore: 55,
      status: 'ACTIVE' as const,
      lastActivityAt: past(5),
      categories: ['sports-fitness'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/badminton-indian-stgt',
          label: 'WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indian Yoga Circle Stuttgart',
      slug: 'indian-yoga-circle-stuttgart',
      description:
        'Free weekend yoga sessions in Schlossgarten led by Indian yoga instructors. Pranayama, Hatha and meditation.',
      languages: ['English', 'Hindi'],
      personaSegments: ['family', 'working-professional', 'single'],
      foundedYear: 2019,
      memberCountApprox: 75,
      activityScore: 45,
      completenessScore: 52,
      trustScore: 48,
      status: 'ACTIVE' as const,
      lastActivityAt: past(8),
      categories: ['sports-fitness', 'cultural'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/yoga-indian-stgt',
          label: 'WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indian Moms Stuttgart',
      slug: 'indian-moms-stuttgart',
      description:
        'Support network for Indian mothers in Stuttgart — playdates, parenting tips, Kita recommendations and cultural activities for kids.',
      languages: ['Hindi', 'English'],
      personaSegments: ['family'],
      foundedYear: 2018,
      memberCountApprox: 130,
      activityScore: 55,
      completenessScore: 60,
      trustScore: 58,
      status: 'ACTIVE' as const,
      lastActivityAt: past(3),
      categories: ['family-kids'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/indian-moms-stgt',
          label: 'WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Little India Stuttgart — Kids Culture Classes',
      slug: 'little-india-stuttgart-kids',
      description:
        'Weekend cultural classes for Indian children ages 4-14: Hindi, Bollywood dance, drawing and festivals. Vaihingen location.',
      languages: ['Hindi', 'English'],
      personaSegments: ['family'],
      foundedYear: 2020,
      memberCountApprox: 60,
      activityScore: 50,
      completenessScore: 58,
      trustScore: 55,
      status: 'ACTIVE' as const,
      lastActivityAt: past(12),
      categories: ['family-kids', 'cultural'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/little-india-stgt',
          label: 'WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indian Cooking Circle Stuttgart',
      slug: 'indian-cooking-circle-stuttgart',
      description:
        'Monthly potlucks and cooking workshops for Indian food lovers — regional recipes, fusion experiments and spice sourcing tips.',
      languages: ['Hindi', 'English'],
      personaSegments: ['family', 'single'],
      foundedYear: 2021,
      memberCountApprox: 40,
      activityScore: 36,
      completenessScore: 48,
      trustScore: 45,
      status: 'ACTIVE' as const,
      lastActivityAt: past(20),
      categories: ['food-cooking'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/cooking-indian-stgt',
          label: 'WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Hyderabadi Foodies BW',
      slug: 'hyderabadi-foodies-bw',
      description:
        'Biryani meetups, Irani chai sessions and Hyderabadi food crawls. For anyone who misses Hyderabad food in Germany.',
      languages: ['Telugu', 'Hindi', 'English', 'Urdu'],
      personaSegments: ['single', 'working-professional'],
      foundedYear: 2022,
      memberCountApprox: 55,
      activityScore: 34,
      completenessScore: 45,
      trustScore: 42,
      status: 'ACTIVE' as const,
      lastActivityAt: past(25),
      categories: ['food-cooking', 'networking-social'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/hyd-foodies-bw',
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
    {
      name: 'Indians in Esslingen',
      slug: 'indians-in-esslingen',
      description:
        'Informal group for Indians living in Esslingen am Neckar — apartment hunting, meetups, festival celebrations and local tips.',
      languages: ['Hindi', 'English'],
      personaSegments: ['newcomer', 'family'],
      foundedYear: 2019,
      memberCountApprox: 70,
      activityScore: 38,
      completenessScore: 45,
      trustScore: 42,
      status: 'ACTIVE' as const,
      lastActivityAt: past(30),
      categories: ['networking-social'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/indians-esslingen',
          label: 'WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indians in Sindelfingen-Böblingen',
      slug: 'indians-sindelfingen-boeblingen',
      description:
        'Community WhatsApp group for Indians in the Sindelfingen-Böblingen area — many Bosch and Mercedes employees. Newcomer support and social events.',
      languages: ['Hindi', 'English', 'Telugu'],
      personaSegments: ['newcomer', 'working-professional'],
      foundedYear: 2015,
      memberCountApprox: 180,
      activityScore: 52,
      completenessScore: 55,
      trustScore: 52,
      status: 'ACTIVE' as const,
      lastActivityAt: past(6),
      categories: ['networking-social'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/indians-sifi-bb',
          label: 'WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Marathi Mandal Stuttgart',
      slug: 'marathi-mandal-stuttgart',
      description:
        'Marathi community celebrating Ganesh Chaturthi, Gudi Padwa and hosting Marathi Natak (theatre) shows in the Stuttgart area.',
      languages: ['Marathi', 'Hindi', 'English'],
      personaSegments: ['family', 'working-professional'],
      foundedYear: 2013,
      memberCountApprox: 110,
      activityScore: 48,
      completenessScore: 58,
      trustScore: 55,
      status: 'ACTIVE' as const,
      lastActivityAt: past(15),
      categories: ['language-regional', 'cultural'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/marathi-stgt',
          label: 'WhatsApp',
          isPrimary: true,
        },
        {
          channelType: 'FACEBOOK' as const,
          url: 'https://facebook.com/groups/marathimandal.stgt',
          label: 'Facebook',
          isPrimary: false,
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
          channelType: 'WEBSITE' as const,
          url: 'https://bengali-stuttgart.de',
          label: 'Website',
          isPrimary: true,
        },
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/bengali-stgt',
          label: 'WhatsApp',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Indian Women Entrepreneurs Stuttgart',
      slug: 'indian-women-entrepreneurs-stuttgart',
      description:
        'Networking and mentoring group for Indian women entrepreneurs, freelancers and startup founders in the Stuttgart region.',
      languages: ['English', 'Hindi'],
      personaSegments: ['working-professional'],
      foundedYear: 2021,
      memberCountApprox: 35,
      activityScore: 32,
      completenessScore: 48,
      trustScore: 46,
      status: 'ACTIVE' as const,
      lastActivityAt: past(22),
      categories: ['professional', 'networking-social'],
      channels: [
        {
          channelType: 'LINKEDIN' as const,
          url: 'https://linkedin.com/groups/indian-women-ent-stgt',
          label: 'LinkedIn',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Bollywood Fitness Stuttgart',
      slug: 'bollywood-fitness-stuttgart',
      description:
        'Bollywood dance fitness classes twice a week in Stuttgart — cardio choreography to the latest Bollywood hits. No experience needed.',
      languages: ['Hindi', 'English'],
      personaSegments: ['single', 'family'],
      foundedYear: 2020,
      memberCountApprox: 45,
      activityScore: 44,
      completenessScore: 55,
      trustScore: 50,
      status: 'ACTIVE' as const,
      lastActivityAt: past(4),
      categories: ['sports-fitness', 'arts-entertainment'],
      channels: [
        {
          channelType: 'INSTAGRAM' as const,
          url: 'https://instagram.com/bollywoodfitness_stgt',
          label: 'Instagram',
          isPrimary: true,
        },
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/bolly-fit-stgt',
          label: 'WhatsApp',
          isPrimary: false,
        },
      ],
    },
    {
      name: 'Hochschule der Medien — Indian Students',
      slug: 'hdm-indian-students',
      description:
        'Indian students at HdM Stuttgart — orientation help, semester parties and industry connection events for media/design students.',
      languages: ['English', 'Hindi'],
      personaSegments: ['persona-student'],
      foundedYear: 2018,
      memberCountApprox: 30,
      activityScore: 35,
      completenessScore: 42,
      trustScore: 45,
      status: 'ACTIVE' as const,
      lastActivityAt: past(28),
      categories: ['student'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/hdm-indians',
          label: 'WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indian PhD & Researchers Network BW',
      slug: 'indian-phd-researchers-bw',
      description:
        'Indian doctoral students and post-docs at Stuttgart and Tübingen universities. Research talks, Stammtisch and career workshops.',
      languages: ['English', 'Hindi'],
      personaSegments: ['persona-student', 'working-professional'],
      foundedYear: 2017,
      memberCountApprox: 85,
      activityScore: 42,
      completenessScore: 52,
      trustScore: 50,
      status: 'ACTIVE' as const,
      lastActivityAt: past(15),
      categories: ['student', 'professional'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/phd-india-bw',
          label: 'WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Desi Hikers Stuttgart',
      slug: 'desi-hikers-stuttgart',
      description:
        'Indian hiking group exploring the Swabian Alps, Black Forest and Schurwald. Monthly hikes every second Saturday.',
      languages: ['Hindi', 'English'],
      personaSegments: ['single', 'working-professional'],
      foundedYear: 2019,
      memberCountApprox: 80,
      activityScore: 50,
      completenessScore: 55,
      trustScore: 52,
      status: 'ACTIVE' as const,
      lastActivityAt: past(9),
      categories: ['sports-fitness', 'networking-social'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/desi-hikers-stgt',
          label: 'WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indian Entrepreneurs Stuttgart',
      slug: 'indian-entrepreneurs-stuttgart',
      description:
        'Startup founders, freelancers and side-hustlers from India networking in Stuttgart. Monthly pitch nights and mentoring circles.',
      languages: ['English', 'Hindi'],
      personaSegments: ['working-professional'],
      foundedYear: 2020,
      memberCountApprox: 50,
      activityScore: 38,
      completenessScore: 50,
      trustScore: 48,
      status: 'ACTIVE' as const,
      lastActivityAt: past(18),
      categories: ['professional', 'networking-social'],
      channels: [
        {
          channelType: 'LINKEDIN' as const,
          url: 'https://linkedin.com/groups/indian-ent-stgt',
          label: 'LinkedIn',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indian Classical Music Circle Stuttgart',
      slug: 'indian-classical-music-circle-stuttgart',
      description:
        'Monthly baithaks (sitting concerts) for Hindustani and Carnatic music lovers. Occasional guest artist sessions.',
      languages: ['Hindi', 'English'],
      personaSegments: ['family', 'working-professional'],
      foundedYear: 2016,
      memberCountApprox: 30,
      activityScore: 30,
      completenessScore: 45,
      trustScore: 48,
      status: 'ACTIVE' as const,
      lastActivityAt: past(35),
      categories: ['arts-entertainment', 'cultural'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/classical-music-stgt',
          label: 'WhatsApp',
          isPrimary: true,
        },
      ],
    },
    {
      name: 'Indian Table Tennis Stuttgart',
      slug: 'indian-table-tennis-stuttgart',
      description:
        'Casual and competitive table tennis for Indians in Stuttgart. Weekly sessions at Sporthalle Degerloch.',
      languages: ['English', 'Hindi'],
      personaSegments: ['single', 'working-professional'],
      foundedYear: 2021,
      memberCountApprox: 25,
      activityScore: 28,
      completenessScore: 40,
      trustScore: 38,
      status: 'ACTIVE' as const,
      lastActivityAt: past(14),
      categories: ['sports-fitness'],
      channels: [
        {
          channelType: 'WHATSAPP' as const,
          url: 'https://chat.whatsapp.com/tt-indian-stgt',
          label: 'WhatsApp',
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
  console.log(
    `   Communities: ${communityDefs.length} + ${moreCommunityDefs.length} = ${communityDefs.length + moreCommunityDefs.length}`,
  );
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
