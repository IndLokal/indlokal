'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import {
  sendClaimApprovedEmail,
  sendClaimRejectedEmail,
  sendSubmissionApprovedEmail,
} from '@/lib/email';

/* ——— Submission actions ——— */

export async function approveSubmission(formData: FormData) {
  const id = formData.get('id') as string;
  if (!id) return;

  const community = await db.community.update({
    where: { id },
    data: { status: 'ACTIVE' },
    select: {
      name: true,
      slug: true,
      metadata: true,
      city: { select: { slug: true } },
    },
  });

  await db.trustSignal.create({
    data: {
      entityType: 'COMMUNITY',
      communityId: id,
      signalType: 'ADMIN_VERIFIED',
    },
  });

  const meta = community.metadata as Record<string, unknown> | null;
  const submitter = meta?.submitter as { name?: string; email?: string } | undefined;
  if (submitter?.email && community.city?.slug && community.slug) {
    await sendSubmissionApprovedEmail(
      submitter.email,
      submitter.name ?? 'there',
      community.name,
      community.city.slug,
      community.slug,
    );
  }

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
    select: {
      claimedByUserId: true,
      name: true,
      slug: true,
      city: { select: { slug: true } },
      claimedBy: { select: { email: true } },
    },
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
    db.trustSignal.create({
      data: {
        entityType: 'COMMUNITY',
        communityId: id,
        signalType: 'ADMIN_VERIFIED',
        createdBy: community.claimedByUserId,
      },
    }),
  ]);

  if (community.city?.slug && community.slug) {
    revalidatePath(`/${community.city.slug}/communities/${community.slug}`);
    if (community.claimedBy?.email) {
      await sendClaimApprovedEmail(
        community.claimedBy.email,
        community.name,
        community.city.slug,
        community.slug,
      );
    }
  }
  revalidatePath('/admin/claims');
}

export async function rejectClaim(formData: FormData) {
  const id = formData.get('id') as string;
  if (!id) return;

  const community = await db.community.findUnique({
    where: { id },
    select: {
      name: true,
      slug: true,
      city: { select: { slug: true } },
      claimedBy: { select: { email: true } },
    },
  });

  await db.community.update({
    where: { id },
    data: {
      claimState: 'UNCLAIMED',
      claimedByUserId: null,
    },
  });

  if (community?.city?.slug && community?.slug) {
    revalidatePath(`/${community.city.slug}/communities/${community.slug}`);
  }
  if (community?.claimedBy?.email && community?.name) {
    await sendClaimRejectedEmail(community.claimedBy.email, community.name);
  }
  revalidatePath('/admin/claims');
}
