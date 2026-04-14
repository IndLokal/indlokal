'use server';

import { db } from '@/lib/db';
import type { ChannelType } from '@prisma/client';
import { submitCommunitySchema } from '@/lib/validation';
import slugify from 'slugify';

export type SubmitResult =
  | { success: true; communityName: string }
  | { success: false; errors: Record<string, string[]> }
  | null;

export async function submitCommunity(
  _prev: SubmitResult,
  formData: FormData,
): Promise<SubmitResult> {
  const raw = {
    name: formData.get('name') as string,
    description: formData.get('description') as string,
    citySlug: formData.get('citySlug') as string,
    categories: formData.getAll('categories') as string[],
    languages: formData.getAll('languages') as string[],
    primaryChannelType: formData.get('primaryChannelType') as string,
    primaryChannelUrl: formData.get('primaryChannelUrl') as string,
    secondaryChannelType: (formData.get('secondaryChannelType') as string) || undefined,
    secondaryChannelUrl: (formData.get('secondaryChannelUrl') as string) || undefined,
    contactEmail: formData.get('contactEmail') as string,
    contactName: formData.get('contactName') as string,
  };

  const parsed = submitCommunitySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  // Resolve city
  const city = await db.city.findFirst({
    where: { slug: data.citySlug, isActive: true },
    select: { id: true },
  });
  if (!city) {
    return { success: false, errors: { citySlug: ['City not found or not active'] } };
  }

  // Generate unique slug
  let slug = slugify(data.name, { lower: true, strict: true });
  const existing = await db.community.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // Resolve category IDs
  const categoryRows = await db.category.findMany({
    where: { slug: { in: data.categories } },
    select: { id: true },
  });

  // Build access channels
  const channels: { channelType: ChannelType; url: string; label: string; isPrimary: boolean }[] = [
    {
      channelType: data.primaryChannelType,
      url: data.primaryChannelUrl,
      label: data.primaryChannelType,
      isPrimary: true,
    },
  ];
  if (data.secondaryChannelType && data.secondaryChannelUrl) {
    channels.push({
      channelType: data.secondaryChannelType,
      url: data.secondaryChannelUrl,
      label: data.secondaryChannelType,
      isPrimary: false,
    });
  }

  // Create community as UNVERIFIED
  await db.community.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      cityId: city.id,
      languages: data.languages,
      status: 'UNVERIFIED',
      claimState: 'UNCLAIMED',
      source: 'COMMUNITY_SUBMITTED',
      metadata: {
        submitter: {
          name: data.contactName,
          email: data.contactEmail,
          submittedAt: new Date().toISOString(),
        },
      },
      categories: {
        create: categoryRows.map((c) => ({ categoryId: c.id })),
      },
      accessChannels: { create: channels },
    },
  });

  return { success: true, communityName: data.name };
}
