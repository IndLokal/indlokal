'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

/* ——— Submission actions ——— */

export async function approveSubmission(formData: FormData) {
  const id = formData.get('id') as string;
  if (!id) return;

  await db.community.update({
    where: { id },
    data: { status: 'ACTIVE' },
  });

  await db.trustSignal.create({
    data: {
      entityType: 'COMMUNITY',
      communityId: id,
      signalType: 'ADMIN_VERIFIED',
    },
  });

  revalidatePath('/admin/submissions');
}

export async function rejectSubmission(formData: FormData) {
  const id = formData.get('id') as string;
  if (!id) return;

  await db.community.update({
    where: { id },
    data: { status: 'INACTIVE' },
  });

  revalidatePath('/admin/submissions');
}

/* ——— Claim actions ——— */

export async function approveClaim(formData: FormData) {
  const id = formData.get('id') as string;
  if (!id) return;

  const community = await db.community.findUnique({
    where: { id },
    select: { claimedByUserId: true },
  });

  if (!community?.claimedByUserId) return;

  await db.$transaction([
    db.community.update({
      where: { id },
      data: { claimState: 'CLAIMED' },
    }),
    db.user.update({
      where: { id: community.claimedByUserId },
      data: { role: 'COMMUNITY_ADMIN' },
    }),
  ]);

  revalidatePath('/admin/claims');
}

export async function rejectClaim(formData: FormData) {
  const id = formData.get('id') as string;
  if (!id) return;

  await db.community.update({
    where: { id },
    data: {
      claimState: 'UNCLAIMED',
      claimedByUserId: null,
    },
  });

  revalidatePath('/admin/claims');
}
