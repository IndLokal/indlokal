/**
 * Unit tests for saves action validation.
 *
 * Validates that toggle functions handle edge cases properly
 * without needing a database.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getSessionUser
const mockGetSessionUser = vi.fn();
vi.mock('@/lib/session', () => ({
  getSessionUser: () => mockGetSessionUser(),
}));

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    savedCommunity: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    },
    savedEvent: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { toggleSaveCommunity, toggleSaveEvent } from '@/app/actions/saves';

describe('toggleSaveCommunity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns requiresAuth when user is not logged in', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const result = await toggleSaveCommunity('some-id');
    expect(result).toEqual({ requiresAuth: true });
  });

  it('returns error for empty community ID', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', savedCommunities: [] });
    const result = await toggleSaveCommunity('');
    expect(result).toHaveProperty('error');
  });
});

describe('toggleSaveEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns requiresAuth when user is not logged in', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const result = await toggleSaveEvent('some-id');
    expect(result).toEqual({ requiresAuth: true });
  });

  it('returns error for empty event ID', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', savedCommunities: [] });
    const result = await toggleSaveEvent('');
    expect(result).toHaveProperty('error');
  });
});
