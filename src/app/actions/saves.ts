'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export type SaveResult = { saved: boolean } | { requiresAuth: true };

// ─── Community saves ──────────────────────────────────────────────────────────

export async function toggleSaveCommunity(communityId: string): Promise<SaveResult> {
  const user = await getSessionUser();
  if (!user) return { requiresAuth: true };

  const existing = await db.savedCommunity.findUnique({
    where: { userId_communityId: { userId: user.id, communityId } },
  });

  if (existing) {
    await db.savedCommunity.delete({
      where: { userId_communityId: { userId: user.id, communityId } },
    });
    revalidatePath('/me');
    return { saved: false };
  }

  await db.savedCommunity.create({ data: { userId: user.id, communityId } });
  revalidatePath('/me');
  return { saved: true };
}

// ─── Event saves ──────────────────────────────────────────────────────────────

export async function toggleSaveEvent(eventId: string): Promise<SaveResult> {
  const user = await getSessionUser();
  if (!user) return { requiresAuth: true };

  const existing = await db.savedEvent.findUnique({
    where: { userId_eventId: { userId: user.id, eventId } },
  });

  if (existing) {
    await db.savedEvent.delete({
      where: { userId_eventId: { userId: user.id, eventId } },
    });
    revalidatePath('/me');
    return { saved: false };
  }

  await db.savedEvent.create({ data: { userId: user.id, eventId } });
  revalidatePath('/me');
  return { saved: true };
}
