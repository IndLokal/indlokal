import { db } from '@/lib/db';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client, UPLOAD_BUCKET, UPLOAD_PRESIGN_TTL_SECONDS } from '@/lib/storage';
import { computeSimilarity } from '@/modules/pipeline';
import slugify from 'slugify';
import type { ChannelType } from '@prisma/client';
import { submit as s } from '@indlokal/shared';
type EventSubmission = s.EventSubmission;
type CommunitySubmission = s.CommunitySubmission;
type SuggestSubmission = s.SuggestSubmission;

export interface PresignResult {
  url: string;
  key: string;
  expiresAt: string;
}

/**
 * Generate a presigned PUT URL for uploading a media asset.
 * Records a MediaAsset row so we can verify the upload later.
 */
export async function createPresignUrl(opts: {
  userId: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
}): Promise<PresignResult> {
  const ext = opts.contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
  const key = `uploads/${opts.userId}/${Date.now()}-${opts.sha256.slice(0, 8)}.${ext}`;

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: UPLOAD_BUCKET,
    Key: key,
    ContentType: opts.contentType,
    ContentLength: opts.sizeBytes,
    ChecksumSHA256: Buffer.from(opts.sha256, 'hex').toString('base64'),
    Metadata: { 'x-uploader': opts.userId },
  });

  const url = await getSignedUrl(client, command, { expiresIn: UPLOAD_PRESIGN_TTL_SECONDS });
  const expiresAt = new Date(Date.now() + UPLOAD_PRESIGN_TTL_SECONDS * 1000).toISOString();

  // Record intent so we can verify the upload later
  await db.mediaAsset.create({
    data: {
      key,
      contentType: opts.contentType,
      sizeBytes: opts.sizeBytes,
      sha256: opts.sha256,
      createdBy: opts.userId,
    },
  });

  return { url, key, expiresAt };
}

// ─── Event submission ──────────────────────────────────────────────────────

export async function createEventSubmission(
  userId: string,
  data: EventSubmission,
): Promise<{ id: string; entityType: string; status: string; createdAt: Date }> {
  const city = await db.city.findFirst({
    where: { slug: data.citySlug, isActive: true },
    select: { id: true },
  });
  if (!city) throw new Error('CITY_NOT_FOUND');

  const extractedData = {
    title: data.title,
    description: data.description ?? null,
    startsAt: data.startsAt,
    endsAt: data.endsAt ?? null,
    venueName: data.venueName ?? null,
    venueAddress: data.venueAddress ?? null,
    isOnline: data.isOnline ?? false,
    cost: data.cost ?? null,
    categories: data.categorySlugx ?? [],
    communitySlug: data.communitySlug ?? null,
    contactEmail: data.contactEmail ?? null,
    contactName: data.contactName ?? null,
  };

  return db.pipelineItem.create({
    data: {
      entityType: 'EVENT',
      status: 'PENDING',
      reviewKind: 'DISCOVERY',
      sourceType: 'USER_SUBMITTED',
      extractedData,
      confidence: 1.0,
      cityId: city.id,
      submittedBy: userId,
      imageKey: data.imageKey ?? null,
    },
    select: { id: true, entityType: true, status: true, createdAt: true },
  });
}

// ─── Community submission ──────────────────────────────────────────────────

export async function createCommunitySubmission(
  userId: string,
  data: CommunitySubmission,
): Promise<{ id: string; entityType: string; status: string; createdAt: Date }> {
  const city = await db.city.findFirst({
    where: { slug: data.citySlug, isActive: true },
    select: { id: true },
  });
  if (!city) throw new Error('CITY_NOT_FOUND');

  // Dedup check
  const existing = await db.community.findMany({
    where: { cityId: city.id, status: { not: 'INACTIVE' } },
    select: { name: true },
  });
  for (const c of existing) {
    if (computeSimilarity(data.name.toLowerCase(), c.name.toLowerCase()) > 0.7) {
      throw new Error(`DUPLICATE:${c.name}`);
    }
  }

  const channels: { channelType: ChannelType; url: string; label: string; isPrimary: boolean }[] = [
    {
      channelType: data.primaryChannelType as ChannelType,
      url: data.primaryChannelUrl,
      label: data.primaryChannelType,
      isPrimary: true,
    },
  ];
  if (data.secondaryChannelType && data.secondaryChannelUrl) {
    channels.push({
      channelType: data.secondaryChannelType as ChannelType,
      url: data.secondaryChannelUrl,
      label: data.secondaryChannelType,
      isPrimary: false,
    });
  }

  const extractedData = {
    name: data.name,
    description: data.description,
    categories: data.categories,
    languages: data.languages,
    channels,
    contactEmail: data.contactEmail,
    contactName: data.contactName,
  };

  return db.pipelineItem.create({
    data: {
      entityType: 'COMMUNITY',
      status: 'PENDING',
      reviewKind: 'DISCOVERY',
      sourceType: 'USER_SUBMITTED',
      extractedData,
      confidence: 1.0,
      cityId: city.id,
      submittedBy: userId,
      imageKey: data.imageKey ?? null,
    },
    select: { id: true, entityType: true, status: true, createdAt: true },
  });
}

// ─── Suggest community ──────────────────────────────────────────────────────

export async function createSuggestSubmission(
  userId: string,
  data: SuggestSubmission,
): Promise<{ id: string; entityType: string; status: string; createdAt: Date }> {
  const city = await db.city.findFirst({
    where: { slug: data.citySlug, isActive: true },
    select: { id: true },
  });
  if (!city) throw new Error('CITY_NOT_FOUND');

  const extractedData = {
    name: data.name,
    description: data.description ?? null,
    contactEmail: data.contactEmail ?? null,
    note: data.note ?? null,
  };

  return db.pipelineItem.create({
    data: {
      entityType: 'COMMUNITY',
      status: 'PENDING',
      reviewKind: 'DISCOVERY',
      sourceType: 'COMMUNITY_SUGGESTION',
      extractedData,
      confidence: 0.5,
      cityId: city.id,
      submittedBy: userId,
    },
    select: { id: true, entityType: true, status: true, createdAt: true },
  });
}
