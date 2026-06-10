'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/session';
import {
  toggleFollowCommunityForUser,
  toggleSaveEventForUser,
  toggleSaveResourceForUser,
} from '@/modules/engagement';

export type SaveResult =
  | { saved: boolean; remindersScheduled?: number; remindersSuppressed?: number }
  | { requiresAuth: true }
  | { error: string };

// ─── Community saves ──────────────────────────────────────────────────────────

export async function toggleSaveCommunity(communityId: string): Promise<SaveResult> {
  const user = await getSessionUser();
  if (!user) return { requiresAuth: true };

  if (!communityId || typeof communityId !== 'string') {
    return { error: 'Invalid community ID' };
  }

  try {
    const result = await toggleFollowCommunityForUser(user.id, communityId);
    revalidatePath('/me');
    return { saved: result.followed };
  } catch {
    return { error: 'Failed to update follow. Please try again.' };
  }
}

export const toggleFollowCommunity = toggleSaveCommunity;

// ─── Event saves ──────────────────────────────────────────────────────────────

export async function toggleSaveEvent(
  eventId: string,
  options?: { lensContext?: 'business_careers' },
): Promise<SaveResult> {
  const user = await getSessionUser();
  if (!user) return { requiresAuth: true };

  if (!eventId || typeof eventId !== 'string') {
    return { error: 'Invalid event ID' };
  }

  try {
    const metadata = options?.lensContext ? { lens_context: options.lensContext } : undefined;
    const result = await toggleSaveEventForUser(user.id, eventId, metadata);
    revalidatePath('/me');
    return result;
  } catch {
    return { error: 'Failed to update save. Please try again.' };
  }
}

// ─── Resource saves ──────────────────────────────────────────────────────────

export async function toggleSaveResource(
  resourceId: string,
  options?: { sourceSurface?: 'resources_journey' | 'resources_hub' | 'resources_category' },
): Promise<SaveResult> {
  const user = await getSessionUser();
  if (!user) return { requiresAuth: true };

  if (!resourceId || typeof resourceId !== 'string') {
    return { error: 'Invalid resource ID' };
  }

  try {
    const metadata = options?.sourceSurface ? { source_surface: options.sourceSurface } : undefined;
    const result = await toggleSaveResourceForUser(user.id, resourceId, metadata);
    revalidatePath('/me');
    return { saved: result.saved };
  } catch {
    return { error: 'Failed to update resource save. Please try again.' };
  }
}
