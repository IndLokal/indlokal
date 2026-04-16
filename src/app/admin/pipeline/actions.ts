'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import slugify from 'slugify';
import type {
  ExtractedEvent,
  ExtractedCommunity,
  PipelineRunResult,
} from '@/modules/pipeline/types';

/** Guard: reject if caller is not PLATFORM_ADMIN */
async function requireAdminAction() {
  const user = await getSessionUser();
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    throw new Error('Unauthorized');
  }
  return user;
}

/* ——— Run the pipeline on demand ——— */

export async function triggerPipelineRun(): Promise<PipelineRunResult> {
  await requireAdminAction();
  // Dynamic import to avoid bundling the pipeline in the client
  const { runPipeline } = await import('@/modules/pipeline/orchestrator');
  const result = await runPipeline();
  revalidatePath('/admin/pipeline');
  return result;
}

/* ——— Approve: create entity from pipeline item ——— */

export async function approvePipelineItem(formData: FormData) {
  await requireAdminAction();
  const id = formData.get('id') as string;
  if (!id) return;

  const item = await db.pipelineItem.findUnique({
    where: { id },
    include: { city: { select: { id: true, slug: true } } },
  });

  if (!item || item.status !== 'PENDING') return;

  const data = item.extractedData as unknown as ExtractedEvent | ExtractedCommunity;

  if (item.entityType === 'EVENT') {
    const event = data as ExtractedEvent;
    const createdEntityId = await createEventFromExtraction(event, item.cityId);

    await db.pipelineItem.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: 'admin',
        createdEntityId,
      },
    });
  } else {
    const community = data as ExtractedCommunity;
    const createdEntityId = await createCommunityFromExtraction(community, item.cityId);

    await db.pipelineItem.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: 'admin',
        createdEntityId,
      },
    });
  }

  // Log provenance
  await db.contentLog.create({
    data: {
      entityType: item.entityType.toLowerCase(),
      entityId: id,
      action: 'CREATED',
      source: 'IMPORTED',
      changedBy: 'admin',
      metadata: {
        pipeline: true,
        sourceType: item.sourceType,
        sourceUrl: item.sourceUrl,
        confidence: item.confidence,
      },
    },
  });

  revalidatePath('/admin/pipeline');
}

/* ——— Reject pipeline item ——— */

export async function rejectPipelineItem(formData: FormData) {
  await requireAdminAction();
  const id = formData.get('id') as string;
  if (!id) return;

  await db.pipelineItem.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewedBy: 'admin',
      reviewNotes: (formData.get('reason') as string) || undefined,
    },
  });

  revalidatePath('/admin/pipeline');
}

/* ——— Batch approve high-confidence items ——— */

export async function batchApprovePipelineItems(formData: FormData) {
  await requireAdminAction();
  const ids = (formData.get('ids') as string)?.split(',').filter(Boolean);
  if (!ids?.length) return;

  for (const id of ids) {
    const itemForm = new FormData();
    itemForm.set('id', id);
    await approvePipelineItem(itemForm);
  }

  revalidatePath('/admin/pipeline');
}

/* ——— Helper: create Event from extracted data ——— */

async function createEventFromExtraction(event: ExtractedEvent, cityId: string): Promise<string> {
  // Build startsAt from date + time
  let startsAt: Date;
  if (event.date) {
    const timeStr = event.time ?? '00:00';
    startsAt = new Date(`${event.date}T${timeStr}:00`);
  } else {
    startsAt = new Date(); // fallback — shouldn't happen for approved items
  }

  let endsAt: Date | undefined;
  if (event.endDate || event.endTime) {
    const endDateStr = event.endDate ?? event.date ?? new Date().toISOString().slice(0, 10);
    const endTimeStr = event.endTime ?? '23:59';
    endsAt = new Date(`${endDateStr}T${endTimeStr}:00`);
  }

  // Try to match hostCommunity to an existing community
  let communityId: string | undefined;
  if (event.hostCommunity) {
    const match = await db.community.findFirst({
      where: {
        cityId,
        name: { contains: event.hostCommunity, mode: 'insensitive' },
      },
      select: { id: true },
    });
    communityId = match?.id;
  }

  // Resolve categories
  const categoryRecords = await db.category.findMany({
    where: { slug: { in: event.categories } },
    select: { id: true },
  });

  const slug = slugify(event.title, { lower: true, strict: true }) + '-' + Date.now().toString(36);

  const created = await db.event.create({
    data: {
      title: event.title,
      slug,
      description: event.description,
      cityId,
      communityId,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      startsAt,
      endsAt,
      isOnline: event.isOnline,
      registrationUrl: event.registrationUrl,
      cost: event.isFree ? 'free' : (event.cost ?? 'unclear'),
      imageUrl: event.imageUrl,
      source: 'IMPORTED',
      status: 'UPCOMING',
      metadata: {
        pipelineExtracted: true,
        confidence: event.confidence,
        languages: event.languages,
      },
      categories: {
        create: categoryRecords.map((c) => ({ categoryId: c.id })),
      },
    },
  });

  return created.id;
}

/* ——— Helper: create Community from extracted data ——— */

async function createCommunityFromExtraction(
  community: ExtractedCommunity,
  cityId: string,
): Promise<string> {
  const categoryRecords = await db.category.findMany({
    where: { slug: { in: community.categories } },
    select: { id: true },
  });

  const slug =
    slugify(community.name, { lower: true, strict: true }) + '-' + Date.now().toString(36);

  const created = await db.community.create({
    data: {
      name: community.name,
      slug,
      description: community.description,
      cityId,
      languages: community.languages,
      source: 'IMPORTED',
      status: 'UNVERIFIED',
      metadata: {
        pipelineExtracted: true,
        confidence: community.confidence,
      },
      categories: {
        create: categoryRecords.map((c) => ({ categoryId: c.id })),
      },
      accessChannels: {
        create: buildAccessChannels(community),
      },
    },
  });

  return created.id;
}

function buildAccessChannels(community: ExtractedCommunity): Array<{
  channelType: 'WEBSITE' | 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP' | 'TELEGRAM' | 'EMAIL';
  url: string;
  isPrimary: boolean;
}> {
  const channels: Array<{
    channelType: 'WEBSITE' | 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP' | 'TELEGRAM' | 'EMAIL';
    url: string;
    isPrimary: boolean;
  }> = [];
  let hasPrimary = false;

  if (community.websiteUrl) {
    channels.push({ channelType: 'WEBSITE', url: community.websiteUrl, isPrimary: !hasPrimary });
    hasPrimary = true;
  }
  if (community.facebookUrl) {
    channels.push({ channelType: 'FACEBOOK', url: community.facebookUrl, isPrimary: !hasPrimary });
    hasPrimary = true;
  }
  if (community.instagramUrl) {
    channels.push({
      channelType: 'INSTAGRAM',
      url: community.instagramUrl,
      isPrimary: !hasPrimary,
    });
    hasPrimary = true;
  }
  if (community.whatsappUrl) {
    channels.push({ channelType: 'WHATSAPP', url: community.whatsappUrl, isPrimary: !hasPrimary });
    hasPrimary = true;
  }
  if (community.telegramUrl) {
    channels.push({ channelType: 'TELEGRAM', url: community.telegramUrl, isPrimary: !hasPrimary });
    hasPrimary = true;
  }
  if (community.contactEmail) {
    channels.push({ channelType: 'EMAIL', url: community.contactEmail, isPrimary: !hasPrimary });
  }

  return channels;
}
