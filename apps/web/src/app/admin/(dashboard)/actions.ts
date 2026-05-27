'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import { assertCan } from '@/lib/auth/permissions';
import { refreshCommunityScore } from '@/modules/scoring';
import {
  sendCollaboratorAccessApprovedEmail,
  sendCollaboratorAccessRejectedEmail,
  sendClaimApprovedEmail,
  sendClaimRejectedEmail,
  sendOrganizerCollaboratorApprovedNotificationEmail,
  sendOrganizerCollaboratorRejectedNotificationEmail,
  sendSubmissionApprovedEmail,
} from '@/lib/email';

/* --- Submission actions --- */

export async function approveSubmission(formData: FormData) {
  await assertCan('pipeline.approve');
  const id = formData.get('id') as string;
  const grantOwnership = formData.has('grantOwnership');
  if (!id) return;

  const existing = await db.community.findUnique({
    where: { id },
    select: {
      claimState: true,
      claimedByUserId: true,
      metadata: true,
    },
  });
  if (!existing) return;

  const meta = existing.metadata as Record<string, unknown> | null;
  const submitter = meta?.submitter as { name?: string; email?: string } | undefined;

  // Ownership is an explicit admin decision during approval.
  let ownerUserId: string | null = null;
  if (
    grantOwnership &&
    submitter?.email &&
    existing.claimState === 'UNCLAIMED' &&
    !existing.claimedByUserId
  ) {
    const email = submitter.email.trim().toLowerCase();
    const owner = await db.user.upsert({
      where: { email },
      update: {
        ...(submitter.name ? { displayName: submitter.name } : {}),
      },
      create: {
        email,
        ...(submitter.name ? { displayName: submitter.name } : {}),
        role: 'COMMUNITY_ADMIN',
      },
      select: { id: true, role: true },
    });

    if (owner.role === 'USER') {
      await db.user.update({
        where: { id: owner.id },
        data: { role: 'COMMUNITY_ADMIN' },
      });
    }
    ownerUserId = owner.id;
  }

  const community = await db.community.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      ...(ownerUserId
        ? {
            claimState: 'CLAIMED',
            claimedByUserId: ownerUserId,
          }
        : {}),
    },
    select: {
      name: true,
      slug: true,
      metadata: true,
      city: { select: { slug: true } },
    },
  });

  await db.$transaction([
    db.trustSignal.create({
      data: {
        entityType: 'COMMUNITY',
        communityId: id,
        signalType: 'ADMIN_VERIFIED',
      },
    }),
    ...(ownerUserId
      ? [
          db.trustSignal.create({
            data: {
              entityType: 'COMMUNITY',
              communityId: id,
              signalType: 'COMMUNITY_CLAIMED',
              createdBy: ownerUserId,
            },
          }),
        ]
      : []),
  ]);

  if (submitter?.email && community.city?.slug && community.slug) {
    try {
      await sendSubmissionApprovedEmail(
        submitter.email,
        submitter.name ?? 'there',
        community.name,
        community.city.slug,
        community.slug,
        Boolean(ownerUserId),
      );
    } catch {
      // Email is best-effort - don't fail admin action
    }
  }

  // Refresh scores - trust and completeness change on approval
  await refreshCommunityScore(id);

  if (community.city?.slug && community.slug) {
    revalidatePath(`/${community.city.slug}/communities/${community.slug}`);
    revalidatePath(`/${community.city.slug}/communities`);
  }

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

/* --- Claim actions --- */

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
  // Refresh scores - trust score changes when claimed
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

/* --- Collaborator request actions --- */

export async function approveCollaboratorRequest(formData: FormData) {
  const reviewer = await assertCan('claims.approve');
  const id = formData.get('id') as string;
  if (!id) return;

  const request = await db.communityCollaborator.findUnique({
    where: { id },
    select: {
      id: true,
      communityId: true,
      userId: true,
      status: true,
      requestedByUserId: true,
      requestedByUser: { select: { email: true } },
      user: { select: { email: true } },
      community: {
        select: {
          name: true,
          slug: true,
          city: { select: { slug: true } },
          claimedBy: { select: { email: true } },
        },
      },
    },
  });
  if (!request || request.status !== 'PENDING') return;

  await db.$transaction([
    db.communityCollaborator.update({
      where: { id: request.id },
      data: {
        status: 'ACTIVE',
        reviewedAt: new Date(),
        reviewedByUserId: reviewer.id,
      },
    }),
    db.user.updateMany({
      where: { id: request.userId, role: 'USER' },
      data: { role: 'COMMUNITY_ADMIN' },
    }),
  ]);

  try {
    if (request.user.email && request.community.city?.slug && request.community.slug) {
      await sendCollaboratorAccessApprovedEmail(
        request.user.email,
        request.community.name,
        request.community.city.slug,
        request.community.slug,
      );
    }

    const organizerNotificationEmails = new Set<string>();
    if (request.community.claimedBy?.email) {
      organizerNotificationEmails.add(request.community.claimedBy.email);
    }
    if (request.requestedByUser?.email) {
      organizerNotificationEmails.add(request.requestedByUser.email);
    }

    for (const organizerEmail of organizerNotificationEmails) {
      if (organizerEmail === request.user.email) continue;
      await sendOrganizerCollaboratorApprovedNotificationEmail(
        organizerEmail,
        request.user.email,
        request.community.name,
      );
    }
  } catch {
    // Email is best-effort - do not fail admin action
  }

  if (request.community.city?.slug && request.community.slug) {
    revalidatePath(`/${request.community.city.slug}/communities/${request.community.slug}`);
    revalidatePath(`/${request.community.city.slug}/communities`);
  }
  revalidatePath('/admin/collaborators');
}

export async function rejectCollaboratorRequest(formData: FormData) {
  const reviewer = await assertCan('claims.reject');
  const id = formData.get('id') as string;
  if (!id) return;

  const request = await db.communityCollaborator.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      user: { select: { email: true } },
      requestedByUser: { select: { email: true } },
      community: {
        select: {
          name: true,
          claimedBy: { select: { email: true } },
        },
      },
    },
  });
  if (!request || request.status !== 'PENDING') return;

  await db.communityCollaborator.update({
    where: { id: request.id },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewedByUserId: reviewer.id,
    },
  });

  try {
    if (request.user.email) {
      await sendCollaboratorAccessRejectedEmail(request.user.email, request.community.name);
    }

    const organizerNotificationEmails = new Set<string>();
    if (request.community.claimedBy?.email) {
      organizerNotificationEmails.add(request.community.claimedBy.email);
    }
    if (request.requestedByUser?.email) {
      organizerNotificationEmails.add(request.requestedByUser.email);
    }

    for (const organizerEmail of organizerNotificationEmails) {
      if (organizerEmail === request.user.email) continue;
      await sendOrganizerCollaboratorRejectedNotificationEmail(
        organizerEmail,
        request.user.email,
        request.community.name,
      );
    }
  } catch {
    // Email is best-effort - do not fail admin action
  }

  revalidatePath('/admin/collaborators');
}

/* --- Report actions --- */

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
