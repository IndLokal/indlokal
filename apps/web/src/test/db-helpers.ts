/**
 * Test database helpers.
 *
 * Provides a Prisma client that connects to the isolated test database
 * (indlokal_test) and utilities for resetting state between tests.
 *
 * Usage:
 *   import { testDb, cleanDb } from '@/test/db-helpers';
 *
 *   beforeEach(() => cleanDb());
 *   afterAll(() => testDb.$disconnect());
 *
 * Prerequisites:
 *   Run `npm run test:setup` once to create the test DB and push the schema.
 */
import { PrismaClient } from '@prisma/client';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/indlokal_test?schema=public';

// Singleton scoped to the test process — avoids connection exhaustion
const globalForTestPrisma = globalThis as unknown as {
  testPrisma: PrismaClient | undefined;
};

export const testDb =
  globalForTestPrisma.testPrisma ??
  new PrismaClient({
    datasources: { db: { url: TEST_DATABASE_URL } },
    log: [], // keep test output clean
  });

if (process.env.NODE_ENV !== 'production') {
  globalForTestPrisma.testPrisma = testDb;
}

/**
 * Truncates all application tables in dependency-safe order.
 * Call this in beforeEach for integration tests.
 */
export async function cleanDb(): Promise<void> {
  // Order matters — child tables first to respect FK constraints
  await testDb.$transaction([
    testDb.userInteraction.deleteMany(),
    testDb.magicLinkToken.deleteMany(),
    testDb.savedCommunity.deleteMany(),
    testDb.savedEvent.deleteMany(),
    testDb.activitySignal.deleteMany(),
    testDb.trustSignal.deleteMany(),
    testDb.relationshipEdge.deleteMany(),
    testDb.pipelineItem.deleteMany(),
    testDb.keywordSuggestion.deleteMany(),
    testDb.contentLog.deleteMany(),
    testDb.contentReport.deleteMany(),
    testDb.communityCategory.deleteMany(),
    testDb.eventCategory.deleteMany(),
    testDb.accessChannel.deleteMany(),
    testDb.event.deleteMany(),
    testDb.resource.deleteMany(),
    testDb.community.deleteMany(),
    testDb.user.deleteMany(),
    testDb.category.deleteMany(),
    testDb.city.deleteMany(),
  ]);
}
