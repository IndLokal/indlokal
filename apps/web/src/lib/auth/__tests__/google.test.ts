/**
 * Google auth helper tests — Part D guarantee: normal login authenticates the
 * user only and NEVER assigns a platform role, RoleAssignment, or community
 * authority. Authorization stays controlled by RoleAssignment /
 * CommunityCollaborator.
 *
 * Mocks `@/lib/db` so it runs without a database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const findFirstMock = vi.fn();
const updateMock = vi.fn();
const createMock = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

import { getGoogleOAuthConfig, GoogleAuthError, upsertGoogleUser } from '../google';

const PROFILE = {
  googleId: 'google-sub-123',
  email: 'newuser@example.com',
  emailVerified: true,
  name: 'New User',
  picture: 'https://example.com/p.png',
};

beforeEach(() => {
  findFirstMock.mockReset();
  updateMock.mockReset();
  createMock.mockReset();
});

describe('getGoogleOAuthConfig', () => {
  const original = { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET };
  afterEach(() => {
    process.env.GOOGLE_CLIENT_ID = original.id;
    process.env.GOOGLE_CLIENT_SECRET = original.secret;
  });

  it('throws a classified not_configured error when env is missing', () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    try {
      getGoogleOAuthConfig();
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(GoogleAuthError);
      expect((err as GoogleAuthError).reason).toBe('not_configured');
    }
  });
});

describe('upsertGoogleUser', () => {
  it('creates a new user WITHOUT any role / RoleAssignment / community authority', async () => {
    findFirstMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: 'u1', email: PROFILE.email, role: 'USER', city: null });

    const { isNewUser } = await upsertGoogleUser(PROFILE);

    expect(isNewUser).toBe(true);
    expect(createMock).toHaveBeenCalledTimes(1);
    const data = createMock.mock.calls[0][0].data as Record<string, unknown>;
    // The create payload must only carry identity fields — never authority.
    expect(data).not.toHaveProperty('role');
    expect(data).not.toHaveProperty('roleAssignments');
    expect(data).not.toHaveProperty('collaboratorMemberships');
    expect(data).not.toHaveProperty('claimedCommunities');
    expect(Object.keys(data).sort()).toEqual(
      ['avatarUrl', 'displayName', 'email', 'googleId', 'lastActiveAt'].sort(),
    );
  });

  it('links an existing user by googleId/email without mutating their role', async () => {
    findFirstMock.mockResolvedValue({
      id: 'u2',
      email: PROFILE.email,
      role: 'PLATFORM_ADMIN',
      displayName: 'Existing',
      avatarUrl: null,
    });
    updateMock.mockResolvedValue({
      id: 'u2',
      email: PROFILE.email,
      role: 'PLATFORM_ADMIN',
      city: null,
    });

    const { isNewUser } = await upsertGoogleUser(PROFILE);

    expect(isNewUser).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
    const data = updateMock.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty('role');
    // findFirst must look up by googleId first, then email.
    const where = findFirstMock.mock.calls[0][0].where as { OR: Array<Record<string, unknown>> };
    expect(where.OR).toEqual([{ googleId: PROFILE.googleId }, { email: PROFILE.email }]);
  });
});
