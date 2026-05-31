/**
 * Integration tests - community governance actions (ADR-0008 / TDD-0036).
 *
 * @db - requires test database.
 * Prerequisites: `./dev.sh test:setup`
 *
 * Verifies the authoritative-membership invariants:
 *  - inviting always creates a COLLABORATOR (never an elevated role) and
 *    requires OWNER (organizer) authority;
 *  - the OWNER row cannot be removed;
 *  - ownership transfer promotes the target to OWNER, demotes the prior owner
 *    to COLLABORATOR, and keeps Community.claimedByUserId in sync.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { testDb, cleanDb } from '@/test/db-helpers';
import { createCity, createCommunity, createUser } from '@/test/fixtures';

// Point the app `db` singleton at the test database.
vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  return { ...mod, db: testDb };
});

// Controllable session: tests assign `currentSession` before each action call.
type SessionUser = {
  id: string;
  role: string;
  claimedCommunities: Array<{ id: string; claimedByUserId: string | null }>;
  communityMemberships: Array<{ communityId: string; role: 'COMMUNITY_ADMIN' | 'COLLABORATOR' }>;
};
let currentSession: SessionUser | null = null;
let activeCommunityId: string | null = null;

vi.mock('@/lib/session', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/session')>();
  return {
    ...mod,
    getSessionUser: async () => currentSession,
    getCurrentCommunityId: async () => activeCommunityId,
  };
});

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/analytics/server', () => ({ captureServerEvent: vi.fn() }));

import {
  inviteCollaborator,
  promoteCollaboratorToAdmin,
  removeCollaborator,
  transferOwnership,
} from '../actions';

beforeEach(async () => {
  await cleanDb();
  currentSession = null;
  activeCommunityId = null;
});

afterAll(async () => {
  await testDb.$disconnect();
});

async function seedOwnedCommunity() {
  const city = await createCity(testDb);
  const owner = await createUser(testDb, { email: 'owner@example.com' });
  const community = await createCommunity(testDb, {
    cityId: city.id,
    claimState: 'CLAIMED',
    claimedByUserId: owner.id,
  });
  await testDb.communityCollaborator.create({
    data: {
      communityId: community.id,
      userId: owner.id,
      role: 'COMMUNITY_ADMIN',
      status: 'ACTIVE',
      source: 'ADMIN_ADD',
    },
  });
  return { city, owner, community };
}

function sessionFor(
  userId: string,
  community: { id: string; claimedByUserId: string | null },
  role: 'COMMUNITY_ADMIN' | 'COLLABORATOR',
): SessionUser {
  return {
    id: userId,
    role: 'USER',
    claimedCommunities: [{ id: community.id, claimedByUserId: community.claimedByUserId }],
    communityMemberships: [{ communityId: community.id, role }],
  };
}

describe('@db inviteCollaborator', () => {
  it('creates a PENDING COLLABORATOR row when the organizer invites', async () => {
    const { owner, community } = await seedOwnedCommunity();
    currentSession = sessionFor(owner.id, community, 'COMMUNITY_ADMIN');
    activeCommunityId = community.id;

    const form = new FormData();
    form.set('email', 'new-collab@example.com');
    const result = await inviteCollaborator(null, form);

    expect(result).toMatchObject({ success: true });
    const invited = await testDb.user.findUnique({ where: { email: 'new-collab@example.com' } });
    expect(invited).not.toBeNull();
    const row = await testDb.communityCollaborator.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: invited!.id } },
    });
    expect(row?.role).toBe('COLLABORATOR');
    expect(row?.status).toBe('PENDING');
  });

  it('refuses invites from a non-owner collaborator', async () => {
    const { community } = await seedOwnedCommunity();
    const collaborator = await createUser(testDb, { email: 'collab@example.com' });
    await testDb.communityCollaborator.create({
      data: {
        communityId: community.id,
        userId: collaborator.id,
        role: 'COLLABORATOR',
        status: 'ACTIVE',
        source: 'COMMUNITY_ADMIN_INVITE',
      },
    });
    currentSession = sessionFor(collaborator.id, community, 'COLLABORATOR');
    activeCommunityId = community.id;

    const form = new FormData();
    form.set('email', 'someone-else@example.com');
    const result = await inviteCollaborator(null, form);

    expect(result).toMatchObject({ success: false });
    const created = await testDb.user.findUnique({
      where: { email: 'someone-else@example.com' },
    });
    expect(created).toBeNull();
  });

  it('stores collaborator name on the invited user when provided', async () => {
    const { owner, community } = await seedOwnedCommunity();
    currentSession = sessionFor(owner.id, community, 'COMMUNITY_ADMIN');
    activeCommunityId = community.id;

    const form = new FormData();
    form.set('name', 'Priya Sharma');
    form.set('email', 'named-collab@example.com');
    const result = await inviteCollaborator(null, form);

    expect(result).toMatchObject({ success: true });
    const invited = await testDb.user.findUnique({ where: { email: 'named-collab@example.com' } });
    expect(invited?.displayName).toBe('Priya Sharma');
  });
});

describe('@db removeCollaborator', () => {
  it('refuses to remove the OWNER row', async () => {
    const { owner, community } = await seedOwnedCommunity();
    currentSession = sessionFor(owner.id, community, 'COMMUNITY_ADMIN');
    activeCommunityId = community.id;

    const ownerRow = await testDb.communityCollaborator.findFirstOrThrow({
      where: { communityId: community.id, role: 'COMMUNITY_ADMIN' },
    });
    const form = new FormData();
    form.set('collaboratorId', ownerRow.id);
    const result = await removeCollaborator(null, form);

    expect(result).toMatchObject({ success: false });
    const stillThere = await testDb.communityCollaborator.findUnique({
      where: { id: ownerRow.id },
    });
    expect(stillThere?.role).toBe('COMMUNITY_ADMIN');
  });

  it('soft-removes non-owner collaborators by marking status REMOVED', async () => {
    const { owner, community } = await seedOwnedCommunity();
    const member = await createUser(testDb, { email: 'member-remove@example.com' });
    const memberRow = await testDb.communityCollaborator.create({
      data: {
        communityId: community.id,
        userId: member.id,
        role: 'COLLABORATOR',
        status: 'ACTIVE',
        source: 'COMMUNITY_ADMIN_INVITE',
      },
    });

    currentSession = sessionFor(owner.id, community, 'COMMUNITY_ADMIN');
    activeCommunityId = community.id;

    const form = new FormData();
    form.set('collaboratorId', memberRow.id);
    const result = await removeCollaborator(null, form);

    expect(result).toEqual({ success: true });
    const updated = await testDb.communityCollaborator.findUnique({
      where: { id: memberRow.id },
      select: { status: true, reviewedByUserId: true },
    });
    expect(updated?.status).toBe('REMOVED');
    expect(updated?.reviewedByUserId).toBe(owner.id);
  });

  it('allows removing a non-primary community admin', async () => {
    const { owner, community } = await seedOwnedCommunity();
    const secondAdmin = await createUser(testDb, { email: 'second-admin@example.com' });
    const secondAdminRow = await testDb.communityCollaborator.create({
      data: {
        communityId: community.id,
        userId: secondAdmin.id,
        role: 'COMMUNITY_ADMIN',
        status: 'ACTIVE',
        source: 'ADMIN_ADD',
      },
    });

    currentSession = sessionFor(owner.id, community, 'COMMUNITY_ADMIN');
    activeCommunityId = community.id;

    const form = new FormData();
    form.set('collaboratorId', secondAdminRow.id);
    const result = await removeCollaborator(null, form);

    expect(result).toEqual({ success: true });
    const updated = await testDb.communityCollaborator.findUnique({
      where: { id: secondAdminRow.id },
      select: { status: true, role: true },
    });
    expect(updated?.status).toBe('REMOVED');
    expect(updated?.role).toBe('COMMUNITY_ADMIN');
  });
});

describe('@db promoteCollaboratorToAdmin', () => {
  it('promotes target collaborator without demoting existing admin', async () => {
    const { owner, community } = await seedOwnedCommunity();
    const promoted = await createUser(testDb, { email: 'promoted@example.com' });
    await testDb.communityCollaborator.create({
      data: {
        communityId: community.id,
        userId: promoted.id,
        role: 'COLLABORATOR',
        status: 'ACTIVE',
        source: 'COMMUNITY_ADMIN_INVITE',
      },
    });

    currentSession = sessionFor(owner.id, community, 'COMMUNITY_ADMIN');
    activeCommunityId = community.id;

    const form = new FormData();
    form.set('targetUserId', promoted.id);
    const result = await promoteCollaboratorToAdmin(null, form);
    expect(result).toEqual({ success: true });

    const admins = await testDb.communityCollaborator.findMany({
      where: { communityId: community.id, role: 'COMMUNITY_ADMIN', status: 'ACTIVE' },
      select: { userId: true },
    });

    expect(admins).toHaveLength(2);
    expect(admins.map((row) => row.userId)).toContain(owner.id);
    expect(admins.map((row) => row.userId)).toContain(promoted.id);

    const refreshed = await testDb.community.findUnique({ where: { id: community.id } });
    expect(refreshed?.claimedByUserId).toBe(owner.id);
  });
});

describe('@db transferOwnership', () => {
  it('promotes the target to OWNER, demotes the prior owner, and syncs claimedByUserId', async () => {
    const { owner, community } = await seedOwnedCommunity();
    const successor = await createUser(testDb, { email: 'successor@example.com' });
    await testDb.communityCollaborator.create({
      data: {
        communityId: community.id,
        userId: successor.id,
        role: 'COLLABORATOR',
        status: 'ACTIVE',
        source: 'COMMUNITY_ADMIN_INVITE',
      },
    });
    currentSession = sessionFor(owner.id, community, 'COMMUNITY_ADMIN');
    activeCommunityId = community.id;

    const form = new FormData();
    form.set('targetUserId', successor.id);
    const result = await transferOwnership(null, form);

    expect(result).toEqual({ success: true });

    const owners = await testDb.communityCollaborator.findMany({
      where: { communityId: community.id, role: 'COMMUNITY_ADMIN' },
    });
    expect(owners).toHaveLength(1);
    expect(owners[0].userId).toBe(successor.id);

    const priorOwner = await testDb.communityCollaborator.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: owner.id } },
    });
    expect(priorOwner?.role).toBe('COLLABORATOR');

    const refreshed = await testDb.community.findUnique({ where: { id: community.id } });
    expect(refreshed?.claimedByUserId).toBe(successor.id);
  });
});
