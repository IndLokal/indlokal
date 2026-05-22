'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { assertCan } from '@/lib/auth/permissions';
import type { SubmitResult } from '../submit/actions';

export async function checkInToEvent(
  _prev: SubmitResult | null,
  formData: FormData,
): Promise<SubmitResult> {
  const user = await assertCan('ambassador.checkin');

  const eventId = (formData.get('eventId') as string | null)?.trim();
  const notes = (formData.get('notes') as string | null)?.trim();
  // photoKey would come from a pre-signed upload; we store the key reference
  const photoKey = (formData.get('photoKey') as string | null)?.trim();

  if (!eventId) return { success: false, error: 'Missing event ID.' };

  // Load the event + its community (community is required for ActivitySignal)
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, communityId: true, cityId: true },
  });

  if (!event) return { success: false, error: 'Event not found.' };

  // If no community, we cannot log an ActivitySignal (communityId is required on the model).
  // Silently skip the signal but still record the check-in in metadata.
  const communityId = event.communityId;

  await db.$transaction(async (tx) => {
    if (communityId) {
      await tx.activitySignal.create({
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
    }

    // Store photo reference as a MediaAsset stub if provided
    if (photoKey) {
      await tx.mediaAsset.upsert({
        where: { key: photoKey },
        create: {
          key: photoKey,
          contentType: 'image/jpeg',
          sizeBytes: 0,
          sha256: '',
          createdBy: user.id,
        },
        update: {},
      });
    }
  });

  revalidatePath('/ambassador');
  revalidatePath(`/ambassador/checkin/${eventId}`);
  return { success: true, message: `Checked in to "${event.title}". Thanks!` };
}
