'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { assertCan } from '@/lib/auth/permissions';
import { Prisma } from '@prisma/client';
import type { SubmitResult } from '../lib/form-state';

// Allowed S3/R2 key format - alphanumeric, hyphens, underscores, dots, slashes.
// Prevents arbitrary strings from reaching storage layers.
const PHOTO_KEY_RE = /^[\w\-.\/]{1,512}$/;

// How far before/after an event's start time an ambassador can check in.
const CHECKIN_WINDOW_BEFORE_MS = 2 * 60 * 60 * 1000; // 2 h before startsAt
const CHECKIN_WINDOW_AFTER_MS = 8 * 60 * 60 * 1000; // 8 h after startsAt (or endsAt if set)

export async function checkInToEvent(
  _prev: SubmitResult | null,
  formData: FormData,
): Promise<SubmitResult> {
  const user = await assertCan('ambassador.checkin');

  const eventId = (formData.get('eventId') as string | null)?.trim();
  const notes = (formData.get('notes') as string | null)?.trim();
  // photoKey comes from a pre-signed upload; validate format before persisting
  const photoKeyRaw = (formData.get('photoKey') as string | null)?.trim() || null;

  if (!eventId) return { success: false, error: 'Missing event ID.' };

  if (photoKeyRaw && !PHOTO_KEY_RE.test(photoKeyRaw)) {
    return { success: false, error: 'Invalid photo key format.' };
  }
  const photoKey = photoKeyRaw;

  // Load event - need startsAt/endsAt for the temporal guard
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      communityId: true,
      cityId: true,
      startsAt: true,
      endsAt: true,
    },
  });

  if (!event) return { success: false, error: 'Event not found.' };

  // ── Temporal guard ────────────────────────────────────────────────────────
  // An ambassador may only check in within 2 h before the event starts and up
  // to 8 h after it starts (or after endsAt, whichever is later). This prevents
  // retroactive inflation of activity signals.
  const now = Date.now();
  const windowStart = event.startsAt.getTime() - CHECKIN_WINDOW_BEFORE_MS;
  const windowEnd = (event.endsAt ?? event.startsAt).getTime() + CHECKIN_WINDOW_AFTER_MS;

  if (now < windowStart) {
    return { success: false, error: 'Check-in opens 2 hours before the event starts.' };
  }
  if (now > windowEnd) {
    return {
      success: false,
      error: 'Check-in closed. It must be submitted within 8 hours of the event ending.',
    };
  }
  // ─────────────────────────────────────────────────────────────────────────

  const communityId = event.communityId;

  // If no community, we cannot log an ActivitySignal (communityId is required).
  if (!communityId) {
    return {
      success: false,
      error: 'This event has no associated community - check-in not supported.',
    };
  }

  try {
    await db.activitySignal.create({
      data: {
        communityId,
        eventId,
        createdBy: user.id,
        signalType: 'EVENT_VERIFIED_ATTENDED',
        metadata: {
          notes: notes ?? '',
          photoKey: photoKey ?? null,
          cityId: event.cityId,
        },
      },
    });
  } catch (err) {
    // Unique constraint violation → already checked in
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { success: true, message: `You've already checked in to "${event.title}".` };
    }
    throw err;
  }

  // Note: MediaAsset stubs are NOT created here. The photo upload flow (pre-signed
  // URL → confirm endpoint) will create the MediaAsset record when the upload
  // actually completes. Storing an empty stub with sizeBytes=0 / sha256='' is
  // misleading and could break downstream integrity checks.

  revalidatePath('/ambassador');
  revalidatePath('/ambassador/me');
  revalidatePath(`/ambassador/checkin/${eventId}`);
  return { success: true, message: `Checked in to "${event.title}". Thanks!` };
}
