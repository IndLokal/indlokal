'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import { assertCan } from '@/lib/auth/permissions';
import { refreshCommunityScore } from '@/modules/scoring';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';
import { enqueueCommunityUpdateForFollowers } from '@/modules/engagement';
import {
  sendCollaboratorAccessApprovedEmail,
  sendCollaboratorAccessRejectedEmail,
  sendClaimApprovedEmail,
  sendClaimRejectedEmail,
  sendOrganizerCollaboratorApprovedNotificationEmail,
  sendOrganizerCollaboratorRejectedNotificationEmail,
  sendSubmissionApprovedEmail,
  sendHostEventApprovedEmail,
  sendHostEventRejectedEmail,
} from '@/lib/email';

type CityChangeRequestPayload = {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy?: string;
  requestedAt?: string;
  fromCityId?: string;
  toCityId?: string;
  reason?: string;
  evidenceUrl?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
};

function asObject(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

/* --- Community contribution actions --- */

export async function approveCommunityContribution(formData: FormData) {
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
  // ADR-0008: granting organizer access creates an OWNER membership row + audit
  // log - never a global User.role. Defaulted from the submitter's declared
  // relationship.
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
        role: 'USER',
      },
      select: { id: true },
    });
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
          db.communityCollaborator.upsert({
            where: { communityId_userId: { communityId: id, userId: ownerUserId } },
            update: { role: 'COMMUNITY_ADMIN', status: 'ACTIVE' },
            create: {
              communityId: id,
              userId: ownerUserId,
              role: 'COMMUNITY_ADMIN',
              status: 'ACTIVE',
              source: 'ADMIN_ADD',
            },
          }),
          db.contentLog.create({
            data: {
              entityType: 'community',
              entityId: id,
              action: 'ROLE_GRANTED',
              changedBy: ownerUserId,
              metadata: {
                targetUserId: ownerUserId,
                toRole: 'COMMUNITY_ADMIN',
                via: 'submission_approval',
              },
            },
          }),
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

export async function rejectCommunityContribution(formData: FormData) {
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
  const reviewer = await assertCan('claims.approve');
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
  const ownerUserId = community.claimedByUserId;

  // ADR-0008: a community-scoped approval grants community authority via an
  // OWNER membership row + audit log - never a global User.role.
  await db.$transaction([
    db.community.update({
      where: { id },
      data: { claimState: 'CLAIMED' },
    }),
    db.communityCollaborator.upsert({
      where: { communityId_userId: { communityId: id, userId: ownerUserId } },
      update: {
        role: 'COMMUNITY_ADMIN',
        status: 'ACTIVE',
        reviewedAt: new Date(),
        reviewedByUserId: reviewer.id,
      },
      create: {
        communityId: id,
        userId: ownerUserId,
        role: 'COMMUNITY_ADMIN',
        status: 'ACTIVE',
        source: 'ADMIN_ADD',
        reviewedAt: new Date(),
        reviewedByUserId: reviewer.id,
      },
    }),
    db.contentLog.create({
      data: {
        entityType: 'community',
        entityId: id,
        action: 'ROLE_GRANTED',
        changedBy: reviewer.id,
        metadata: { targetUserId: ownerUserId, toRole: 'COMMUNITY_ADMIN', via: 'claim_approval' },
      },
    }),
    db.trustSignal.create({
      data: {
        entityType: 'COMMUNITY',
        communityId: id,
        signalType: 'ADMIN_VERIFIED',
        createdBy: ownerUserId,
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
      source: true,
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
  if (!request || request.status !== 'PENDING' || request.source !== 'PUBLIC_REQUEST') return;

  // ADR-0008: approving grants community authority via the membership row +
  // audit log - never a global User.role.
  await db.$transaction([
    db.communityCollaborator.update({
      where: { id: request.id },
      data: {
        status: 'ACTIVE',
        reviewedAt: new Date(),
        reviewedByUserId: reviewer.id,
      },
    }),
    db.contentLog.create({
      data: {
        entityType: 'community',
        entityId: request.communityId,
        action: 'ROLE_GRANTED',
        changedBy: reviewer.id,
        metadata: { targetUserId: request.userId, via: 'collaborator_approval' },
      },
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
      source: true,
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
  if (!request || request.status !== 'PENDING' || request.source !== 'PUBLIC_REQUEST') return;

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

/* --- Event moderation actions (ADR-0009) --- */

async function loadReviewableEvent(id: string) {
  return db.event.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      communityId: true,
      moderationState: true,
      createdByUserId: true,
      city: { select: { slug: true } },
      createdBy: { select: { email: true, displayName: true } },
    },
  });
}

export async function approveEvent(formData: FormData) {
  const reviewer = await assertCan('events.review.approve');
  const id = formData.get('id') as string;
  if (!id) return;

  const event = await loadReviewableEvent(id);
  if (!event || event.moderationState !== 'PENDING_REVIEW') return;

  await db.$transaction([
    db.event.update({
      where: { id },
      data: {
        moderationState: 'PUBLISHED',
        reviewedById: reviewer.id,
        reviewedAt: new Date(),
        reviewReason: null,
      },
    }),
    db.contentLog.create({
      data: {
        entityType: 'event',
        entityId: id,
        action: 'UPDATED',
        changedBy: reviewer.id,
        metadata: { decision: 'approved', moderationState: 'PUBLISHED' },
      },
    }),
    db.pipelineItem.updateMany({
      where: {
        createdEntityId: id,
        entityType: 'EVENT',
        sourceType: 'EVENT_SUGGESTION',
        status: 'PENDING',
      },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: reviewer.id,
        reviewNotes: 'Approved via Admin Events moderation queue.',
      },
    }),
  ]);

  await captureServerEvent(reviewer.id, Events.EVENT_REVIEW_DECISION, {
    event_id: id,
    decision: 'approved',
    // Backward-compatible alias for existing PostHog dashboards.
    eventId: id,
  });

  if (event.communityId) {
    try {
      await enqueueCommunityUpdateForFollowers({
        communityId: event.communityId,
        eventId: event.id,
        updateId: `event:${event.id}:published`,
      });
    } catch {
      // Notification fan-out is best-effort and must not block moderation.
    }
  }

  if (event.createdBy?.email && event.city?.slug) {
    try {
      await sendHostEventApprovedEmail(
        event.createdBy.email,
        event.title,
        event.city.slug,
        event.slug,
      );
    } catch {
      // Email is best-effort
    }
  }

  revalidateTag('city-feed', 'max');
  revalidatePath('/admin/events');
  revalidatePath('/admin/pipeline');
}

export async function rejectEvent(formData: FormData) {
  const reviewer = await assertCan('events.review.reject');
  const id = formData.get('id') as string;
  const reason = ((formData.get('reason') as string) ?? '').trim() || null;
  if (!id) return;

  const event = await loadReviewableEvent(id);
  if (!event || event.moderationState !== 'PENDING_REVIEW') return;

  await db.$transaction([
    db.event.update({
      where: { id },
      data: {
        moderationState: 'REJECTED',
        reviewedById: reviewer.id,
        reviewedAt: new Date(),
        reviewReason: reason,
      },
    }),
    db.contentLog.create({
      data: {
        entityType: 'event',
        entityId: id,
        action: 'UPDATED',
        changedBy: reviewer.id,
        metadata: { decision: 'rejected', moderationState: 'REJECTED', reason },
      },
    }),
    db.pipelineItem.updateMany({
      where: {
        createdEntityId: id,
        entityType: 'EVENT',
        sourceType: 'EVENT_SUGGESTION',
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: reviewer.id,
        reviewNotes: reason || 'Rejected via Admin Events moderation queue.',
      },
    }),
  ]);

  await captureServerEvent(reviewer.id, Events.EVENT_REVIEW_DECISION, {
    event_id: id,
    decision: 'rejected',
    // Backward-compatible alias for existing PostHog dashboards.
    eventId: id,
  });

  if (event.createdBy?.email) {
    try {
      await sendHostEventRejectedEmail(event.createdBy.email, event.title, reason);
    } catch {
      // Email is best-effort
    }
  }

  revalidatePath('/admin/events');
  revalidatePath('/admin/pipeline');
}

/* --- City-change governance actions --- */

export async function approveCityChangeRequest(formData: FormData) {
  const reviewer = await assertCan('claims.approve');
  const id = formData.get('id') as string;
  if (!id) return;

  const community = await db.community.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      cityId: true,
      city: { select: { slug: true } },
      metadata: true,
    },
  });
  if (!community) return;

  const metadata = asObject(community.metadata);
  const request = asObject(metadata.cityChangeRequest) as CityChangeRequestPayload;
  if (request.status !== 'PENDING' || !request.toCityId) return;

  const toCity = await db.city.findUnique({
    where: { id: request.toCityId },
    select: { id: true, slug: true },
  });
  if (!toCity) return;

  if (toCity.id === community.cityId) {
    await db.community.update({
      where: { id },
      data: {
        metadata: {
          ...metadata,
          cityChangeRequest: {
            ...request,
            status: 'APPROVED',
            reviewedBy: reviewer.id,
            reviewedAt: new Date().toISOString(),
            reviewNote: 'No-op: already in target city.',
          },
        },
      },
    });
    revalidatePath('/admin/claims');
    revalidatePath('/organizer/profile');
    return;
  }

  await db.$transaction([
    db.community.update({
      where: { id },
      data: {
        cityId: toCity.id,
        metadata: {
          ...metadata,
          cityChangeRequest: {
            ...request,
            status: 'APPROVED',
            reviewedBy: reviewer.id,
            reviewedAt: new Date().toISOString(),
          },
        },
      },
    }),
    db.contentLog.create({
      data: {
        entityType: 'community',
        entityId: id,
        action: 'UPDATED',
        changedBy: reviewer.id,
        metadata: {
          via: 'city_change_request_approval',
          fromCityId: community.cityId,
          toCityId: toCity.id,
        },
      },
    }),
  ]);

  revalidateTag('city-feed', 'max');
  revalidatePath(`/${community.city.slug}/communities/${community.slug}`);
  revalidatePath(`/${community.city.slug}/communities`);
  revalidatePath(`/${toCity.slug}/communities/${community.slug}`);
  revalidatePath(`/${toCity.slug}/communities`);
  revalidatePath('/admin/claims');
  revalidatePath('/organizer/profile');
}

export async function rejectCityChangeRequest(formData: FormData) {
  const reviewer = await assertCan('claims.reject');
  const id = formData.get('id') as string;
  const reason = ((formData.get('reason') as string) ?? '').trim() || undefined;
  if (!id) return;

  const community = await db.community.findUnique({
    where: { id },
    select: { id: true, city: { select: { slug: true } }, slug: true, metadata: true },
  });
  if (!community) return;

  const metadata = asObject(community.metadata);
  const request = asObject(metadata.cityChangeRequest) as CityChangeRequestPayload;
  if (request.status !== 'PENDING') return;

  await db.community.update({
    where: { id },
    data: {
      metadata: {
        ...metadata,
        cityChangeRequest: {
          ...request,
          status: 'REJECTED',
          reviewedBy: reviewer.id,
          reviewedAt: new Date().toISOString(),
          ...(reason ? { reviewNote: reason } : {}),
        },
      },
    },
  });

  revalidatePath('/admin/claims');
  revalidatePath('/organizer/profile');
}
