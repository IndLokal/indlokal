'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { refreshCommunityScore } from '@/modules/scoring';
import { Prisma } from '@prisma/client';

async function requireAdminAction() {
  const user = await getSessionUser();
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    throw new Error('Unauthorized');
  }
  return user;
}

function getMetadataObject(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

export async function mergeCommunities(formData: FormData) {
  await requireAdminAction();

  const primaryId = (formData.get('primaryId') as string | null)?.trim();
  const secondaryId = (formData.get('secondaryId') as string | null)?.trim();

  if (!primaryId || !secondaryId || primaryId === secondaryId) {
    throw new Error('Choose two different communities to merge.');
  }

  const [primary, secondary] = await Promise.all([
    db.community.findUnique({
      where: { id: primaryId },
      include: {
        city: { select: { slug: true } },
        accessChannels: true,
        categories: { select: { categoryId: true } },
        savedBy: { select: { userId: true } },
      },
    }),
    db.community.findUnique({
      where: { id: secondaryId },
      include: {
        city: { select: { slug: true } },
        accessChannels: true,
        categories: { select: { categoryId: true } },
        savedBy: { select: { userId: true } },
      },
    }),
  ]);

  if (!primary || !secondary) {
    throw new Error('One of the selected communities no longer exists.');
  }

  if (secondary.mergedIntoId) {
    throw new Error('The secondary community has already been merged.');
  }

  const primaryChannelKeys = new Set(
    primary.accessChannels.map((channel) => `${channel.channelType}:${channel.url.toLowerCase()}`),
  );
  const channelsToCreate = secondary.accessChannels
    .filter(
      (channel) => !primaryChannelKeys.has(`${channel.channelType}:${channel.url.toLowerCase()}`),
    )
    .map((channel) => ({
      communityId: primary.id,
      channelType: channel.channelType,
      url: channel.url,
      label: channel.label,
      isPrimary: false,
      isVerified: channel.isVerified,
      lastVerifiedAt: channel.lastVerifiedAt,
    }));

  const primaryCategoryIds = new Set(primary.categories.map((category) => category.categoryId));
  const categoriesToCreate = secondary.categories
    .filter((category) => !primaryCategoryIds.has(category.categoryId))
    .map((category) => ({
      communityId: primary.id,
      categoryId: category.categoryId,
    }));

  const primarySavedUserIds = new Set(primary.savedBy.map((entry) => entry.userId));
  const savedCommunitiesToCreate = secondary.savedBy
    .filter((entry) => !primarySavedUserIds.has(entry.userId))
    .map((entry) => ({
      userId: entry.userId,
      communityId: primary.id,
    }));

  const mergedAt = new Date().toISOString();

  await db.$transaction(async (tx) => {
    if (channelsToCreate.length > 0) {
      await tx.accessChannel.createMany({ data: channelsToCreate });
    }
    if (secondary.accessChannels.length > 0) {
      await tx.accessChannel.deleteMany({
        where: { id: { in: secondary.accessChannels.map((channel) => channel.id) } },
      });
    }

    if (categoriesToCreate.length > 0) {
      await tx.communityCategory.createMany({ data: categoriesToCreate, skipDuplicates: true });
    }
    await tx.communityCategory.deleteMany({ where: { communityId: secondary.id } });

    if (savedCommunitiesToCreate.length > 0) {
      await tx.savedCommunity.createMany({
        data: savedCommunitiesToCreate,
        skipDuplicates: true,
      });
    }
    await tx.savedCommunity.deleteMany({ where: { communityId: secondary.id } });

    await Promise.all([
      tx.event.updateMany({
        where: { communityId: secondary.id },
        data: { communityId: primary.id },
      }),
      tx.activitySignal.updateMany({
        where: { communityId: secondary.id },
        data: { communityId: primary.id },
      }),
      tx.trustSignal.updateMany({
        where: { communityId: secondary.id },
        data: { communityId: primary.id },
      }),
      tx.contentReport.updateMany({
        where: { communityId: secondary.id },
        data: { communityId: primary.id },
      }),
    ]);

    const primaryMetadata = getMetadataObject(primary.metadata);
    const secondaryMetadata = getMetadataObject(secondary.metadata);
    const existingMergeHistory = Array.isArray(primaryMetadata.mergeHistory)
      ? primaryMetadata.mergeHistory
      : [];

    const primaryUpdate: Prisma.CommunityUpdateInput = {
      metadata: {
        ...primaryMetadata,
        mergeHistory: [
          ...existingMergeHistory,
          {
            mergedCommunityId: secondary.id,
            mergedCommunityName: secondary.name,
            mergedAt,
          },
        ],
      } as Prisma.InputJsonValue,
    };

    if (!primary.claimedByUserId && secondary.claimedByUserId) {
      primaryUpdate.claimedBy = { connect: { id: secondary.claimedByUserId } };
      primaryUpdate.claimState = secondary.claimState;
      if (primary.status !== 'ACTIVE' && secondary.status === 'ACTIVE') {
        primaryUpdate.status = 'ACTIVE';
      }
    }

    await tx.community.update({ where: { id: primary.id }, data: primaryUpdate });

    await tx.community.update({
      where: { id: secondary.id },
      data: {
        status: 'INACTIVE',
        claimState: 'UNCLAIMED',
        claimedByUserId: null,
        mergedIntoId: primary.id,
        redirectSlug: primary.slug,
        metadata: {
          ...secondaryMetadata,
          mergedInto: {
            id: primary.id,
            slug: primary.slug,
            citySlug: primary.city.slug,
            mergedAt,
          },
        } as Prisma.InputJsonValue,
      },
    });

    await tx.contentLog.createMany({
      data: [
        {
          entityType: 'community',
          entityId: primary.id,
          action: 'UPDATED',
          source: 'IMPORTED',
          changedBy: 'admin',
          metadata: {
            merge: true,
            mergedCommunityId: secondary.id,
            mergedCommunityName: secondary.name,
          } as Prisma.InputJsonValue,
        },
        {
          entityType: 'community',
          entityId: secondary.id,
          action: 'UPDATED',
          source: 'IMPORTED',
          changedBy: 'admin',
          metadata: {
            merge: true,
            mergedIntoId: primary.id,
            mergedIntoSlug: primary.slug,
          } as Prisma.InputJsonValue,
        },
      ],
    });
  });

  await refreshCommunityScore(primary.id);

  revalidateTag('city-feed', 'max');
  revalidatePath('/admin');
  revalidatePath('/admin/merge');
  revalidatePath(`/${primary.city.slug}/communities/${primary.slug}`);
  redirect('/admin/merge');
}
