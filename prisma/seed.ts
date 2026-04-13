/**
 * Database seed script for LocalPulse.
 *
 * Seeds Stuttgart as the launch city with metro region,
 * all 11 MVP categories, and example data structure.
 *
 * Run: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding LocalPulse database...\n');

  // ─── Cities: Stuttgart metro region ───
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

  console.log(`✅ City: ${stuttgart.name} (${stuttgart.slug})`);

  // Satellite cities in Stuttgart metro
  const satellites = [
    { name: 'Böblingen', slug: 'boeblingen', lat: 48.6833, lng: 9.0167, pop: 49312 },
    { name: 'Sindelfingen', slug: 'sindelfingen', lat: 48.7133, lng: 9.0028, pop: 64858 },
    { name: 'Ludwigsburg', slug: 'ludwigsburg', lat: 48.8975, lng: 9.1922, pop: 93593 },
    { name: 'Esslingen', slug: 'esslingen', lat: 48.7397, lng: 9.3108, pop: 94046 },
    { name: 'Leonberg', slug: 'leonberg', lat: 48.8, lng: 9.0167, pop: 48670 },
    { name: 'Göppingen', slug: 'goeppingen', lat: 48.7033, lng: 9.6519, pop: 57868 },
  ];

  for (const sat of satellites) {
    const city = await prisma.city.upsert({
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
        isActive: false, // Satellite — not independently launchable
        isMetroPrimary: false,
        metroRegionId: stuttgart.id,
        timezone: 'Europe/Berlin',
      },
    });
    console.log(`  📍 Satellite: ${city.name}`);
  }

  // ─── Categories: all 11 MVP categories ───
  const categories = [
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

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        name: cat.name,
        slug: cat.slug,
        type: 'CATEGORY',
        icon: cat.icon,
        sortOrder: cat.sort,
      },
    });
  }
  console.log(`✅ Categories: ${categories.length} seeded`);

  // ─── Persona segments ───
  const personas = [
    { name: 'Newcomer', slug: 'newcomer', icon: '🆕', sort: 1 },
    { name: 'Student', slug: 'persona-student', icon: '📚', sort: 2 },
    { name: 'Working Professional', slug: 'working-professional', icon: '💻', sort: 3 },
    { name: 'Family', slug: 'family', icon: '👨‍👩‍👧‍👦', sort: 4 },
    { name: 'Single', slug: 'single', icon: '🙋', sort: 5 },
  ];

  for (const p of personas) {
    await prisma.category.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        name: p.name,
        slug: p.slug,
        type: 'PERSONA',
        icon: p.icon,
        sortOrder: p.sort,
      },
    });
  }
  console.log(`✅ Personas: ${personas.length} seeded`);

  console.log('\n✅ Seed complete!');
  console.log(`   Stuttgart metro: 1 primary + ${satellites.length} satellites`);
  console.log(`   Categories: ${categories.length}`);
  console.log(`   Personas: ${personas.length}`);
  console.log('\n📝 Next steps:');
  console.log('   1. Add community profiles (npm run db:studio)');
  console.log('   2. Add events for those communities');
  console.log('   3. Run scoring: refreshAllScores()');
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
