'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import { assertCan } from '@/lib/auth/permissions';
import { refreshCommunityScore } from '@/modules/scoring';
import {
  sendClaimApprovedEmail,
  sendClaimRejectedEmail,
  sendSubmissionApprovedEmail,
} from '@/lib/email';

/* ——— Submission actions ——— */

export async function approveSubmission(formData: FormData) {
  await assertCan('pipeline.approve');
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
    try {
      await sendSubmissionApprovedEmail(
        submitter.email,
        submitter.name ?? 'there',
        community.name,
        community.city.slug,
        community.slug,
      );
    } catch {
      // Email is best-effort — don't fail admin action
    }
  }

  // Refresh scores — trust and completeness change on approval
  await refreshCommunityScore(id);

  revalidateTag('city-feed', 'max');
  revalidatePath('/admin/submissions');
}

export async function rejectSubmission(formData: FormData) {
  await assertCan('pipeline.reject');
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
  await assertCan('claims.approve');
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
    revalidatePath(`/${community.city.slug}/communities`);
    if (community.claimedBy?.email) {
      try {
        await sendClaimApprovedEmail(
          community.claimedBy.email,
          community.name,
          community.city.slug,
          community.slug,
        );
      } catch {
        // Email is best-effort
      }
    }
  }
  // Refresh scores — trust score changes when claimed
  await refreshCommunityScore(id);

  revalidateTag('city-feed', 'max');
  revalidatePath('/admin/data/communities');
  revalidatePath('/admin/claims');
}

export async function rejectClaim(formData: FormData) {
  await assertCan('claims.reject');
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
    revalidatePath(`/${community.city.slug}/communities`);
  }
  if (community?.claimedBy?.email && community?.name) {
    try {
      await sendClaimRejectedEmail(community.claimedBy.email, community.name);
    } catch {
      // Email is best-effort
    }
  }
  revalidateTag('city-feed', 'max');
  revalidatePath('/admin/data/communities');
  revalidatePath('/admin/claims');
}

/* ——— Report actions ——— */

export async function reviewReport(formData: FormData) {
  await assertCan('reports.read');
  const id = formData.get('id') as string;
  if (!id) return;

  await db.contentReport.update({
    where: { id },
    data: { status: 'REVIEWED' },
  });

  revalidatePath('/admin/reports');
}

export async function resolveReport(formData: FormData) {
  await assertCan('reports.resolve');
  const id = formData.get('id') as string;
  if (!id) return;

  await db.contentReport.update({
    where: { id },
    data: { status: 'RESOLVED' },
  });

  revalidatePath('/admin/reports');
}
