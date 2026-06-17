'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser, getCurrentCommunityId } from '@/lib/session';
import { withAction } from '@/lib/api/handlers';
import { communityOptions } from '@indlokal/shared';
import { refreshCommunityScore } from '@/modules/scoring';
import { canEditCommunity, canManageCommunity } from '@/lib/auth/community-permissions';
import {
  resolveActiveOrganizerCommunity,
  type OrganizerSessionCommunity,
} from '@/lib/organizer/workspace';
import {
  communityDescriptionSchema,
  communityLanguagesSchema,
  communityNameSchema,
  readCommunityCoreFormData,
} from '@/lib/communities/form-input';

const editProfileSchema = z.object({
  name: communityNameSchema,
  description: communityDescriptionSchema,
  descriptionLong: z.string().max(10000).optional().or(z.literal('')),
  logoUrl: z.string().trim().url().optional().or(z.literal('')),
  organizationType: z.enum(communityOptions.ORGANIZATION_TYPE_VALUES).optional().or(z.literal('')),
  personaSegments: z.array(z.string()).default([]),
  languages: communityLanguagesSchema,
  foundedYear: z.coerce
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear())
    .optional()
    .or(z.nan()),
  memberCountApprox: z.coerce.number().int().min(0).optional().or(z.nan()),
});

export type EditProfileResult =
  | { success: true }
  | { success: false; errors: Record<string, string[]> }
  | null;

const cityChangeRequestSchema = z.object({
  cityId: z.string().min(1, 'Target city is required.'),
  reason: z.string().trim().min(10, 'Please provide a bit more context.').max(1000),
  evidenceUrl: z.string().trim().url().optional().or(z.literal('')),
});

type CityChangeRequestPayload = {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy: string;
  requestedAt: string;
  fromCityId: string;
  toCityId: string;
  reason: string;
  evidenceUrl?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
};

export type CityChangeRequestResult =
  | { success: true; message: string }
  | { success: false; errors: Record<string, string[]> }
  | null;

export async function editCommunityProfile(
  _prev: EditProfileResult,
  formData: FormData,
): Promise<EditProfileResult> {
  const user = await getSessionUser();
  if (!user || user.claimedCommunities.length === 0) {
    return { success: false, errors: { _: ['Not authenticated'] } };
  }

  const currentId = await getCurrentCommunityId();
  const community = resolveActiveOrganizerCommunity<OrganizerSessionCommunity>(
    user.claimedCommunities,
    currentId,
  );

  if (!community) {
    return { success: false, errors: { _: ['No active community found.'] } };
  }

  // ADR-0008: enforce per-community authority on the backend, not the cookie.
  if (!canEditCommunity(user, community.id)) {
    return {
      success: false,
      errors: { _: ['You do not have permission to edit this community.'] },
    };
  }

  const core = readCommunityCoreFormData(formData);
  const personaSegmentsRaw = formData.getAll('personaSegments') as string[];

  const raw = {
    name: core.name,
    description: core.description,
    descriptionLong: (formData.get('descriptionLong') as string) || undefined,
    logoUrl: (formData.get('logoUrl') as string) || undefined,
    organizationType: (formData.get('organizationType') as string) || undefined,
    personaSegments: personaSegmentsRaw,
    languages: core.languages,
    foundedYear: formData.get('foundedYear') ? Number(formData.get('foundedYear')) : undefined,
    memberCountApprox: formData.get('memberCountApprox')
      ? Number(formData.get('memberCountApprox'))
      : undefined,
  };

  const parsed = editProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  return withAction(
    async () => {
      await db.community.update({
        where: { id: community.id },
        data: {
          name: data.name,
          description: data.description,
          descriptionLong: data.descriptionLong || null,
          logoUrl: data.logoUrl || null,
          organizationType: data.organizationType ? data.organizationType : null,
          personaSegments: data.personaSegments,
          languages: data.languages,
          foundedYear: data.foundedYear && !isNaN(data.foundedYear) ? data.foundedYear : null,
          memberCountApprox:
            data.memberCountApprox && !isNaN(data.memberCountApprox)
              ? data.memberCountApprox
              : null,
        },
      });

      await db.activitySignal.create({
        data: {
          communityId: community.id,
          signalType: 'PROFILE_UPDATED',
        },
      });

      // Refresh completeness score after profile edit
      await refreshCommunityScore(community.id);

      revalidatePath(`/${community.city.slug}/communities/${community.slug}`);
      revalidatePath('/organizer');
      revalidatePath('/organizer/profile');
      revalidateTag('city-feed', 'max');

      return { success: true } as EditProfileResult;
    },
    () => ({ success: false, errors: { _: ['Something went wrong. Please try again.'] } }),
  );
}

export async function requestCommunityCityChange(
  _prev: CityChangeRequestResult,
  formData: FormData,
): Promise<CityChangeRequestResult> {
  const user = await getSessionUser();
  if (!user || user.claimedCommunities.length === 0) {
    return { success: false, errors: { _: ['Not authenticated'] } };
  }

  const currentId = await getCurrentCommunityId();
  const community = resolveActiveOrganizerCommunity<OrganizerSessionCommunity>(
    user.claimedCommunities,
    currentId,
  );

  if (!community) {
    return { success: false, errors: { _: ['No active community found.'] } };
  }

  // City changes affect routing/discovery and must be owner-governed.
  if (!canManageCommunity(user, community.id)) {
    return {
      success: false,
      errors: { _: ['Only the primary organizer can request city changes.'] },
    };
  }

  const parsed = cityChangeRequestSchema.safeParse({
    cityId: formData.get('cityId') as string,
    reason: formData.get('reason') as string,
    evidenceUrl: (formData.get('evidenceUrl') as string) || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  return withAction(
    async () => {
      const freshCommunity = await db.community.findUnique({
        where: { id: community.id },
        select: {
          id: true,
          slug: true,
          cityId: true,
          city: {
            select: { id: true, slug: true, name: true, metroRegionId: true, isMetroPrimary: true },
          },
          metadata: true,
        },
      });
      if (!freshCommunity) {
        return {
          success: false,
          errors: { _: ['Community not found.'] },
        } as CityChangeRequestResult;
      }

      const targetCity = await db.city.findUnique({
        where: { id: parsed.data.cityId },
        select: { id: true, slug: true, name: true, metroRegionId: true, isMetroPrimary: true },
      });

      if (!targetCity) {
        return {
          success: false,
          errors: { cityId: ['Selected city does not exist.'] },
        } as CityChangeRequestResult;
      }

      if (targetCity.id === freshCommunity.city.id) {
        return {
          success: false,
          errors: { cityId: ['Community is already in this city.'] },
        } as CityChangeRequestResult;
      }

      const metadata =
        freshCommunity.metadata && typeof freshCommunity.metadata === 'object'
          ? (freshCommunity.metadata as Record<string, unknown>)
          : {};
      const existingRequest =
        metadata.cityChangeRequest && typeof metadata.cityChangeRequest === 'object'
          ? (metadata.cityChangeRequest as CityChangeRequestPayload)
          : null;

      if (existingRequest?.status === 'PENDING') {
        return {
          success: false,
          errors: {
            _: ['A city-change request is already pending review. Please wait for admin decision.'],
          },
        } as CityChangeRequestResult;
      }

      const sourceMetroId = freshCommunity.city.metroRegionId ?? freshCommunity.city.id;
      const targetMetroId = targetCity.metroRegionId ?? targetCity.id;
      const isWithinSameMetroRegion = sourceMetroId === targetMetroId;
      const shouldAutoApprove = isWithinSameMetroRegion;

      const nowIso = new Date().toISOString();

      const request: CityChangeRequestPayload = {
        status: shouldAutoApprove ? 'APPROVED' : 'PENDING',
        requestedBy: user.id,
        requestedAt: nowIso,
        fromCityId: freshCommunity.city.id,
        toCityId: targetCity.id,
        reason: parsed.data.reason,
        ...(shouldAutoApprove
          ? {
              reviewedBy: user.id,
              reviewedAt: nowIso,
              reviewNote: 'Auto-approved: move within same metro region.',
            }
          : {}),
        ...(parsed.data.evidenceUrl ? { evidenceUrl: parsed.data.evidenceUrl } : {}),
      };

      if (shouldAutoApprove) {
        await db.$transaction([
          db.community.update({
            where: { id: freshCommunity.id },
            data: {
              cityId: targetCity.id,
              metadata: {
                ...metadata,
                cityChangeRequest: request,
              },
            },
          }),
          db.contentLog.create({
            data: {
              entityType: 'community',
              entityId: freshCommunity.id,
              action: 'UPDATED',
              changedBy: user.id,
              metadata: {
                via: 'city_change_request_auto_approval',
                fromCityId: freshCommunity.cityId,
                toCityId: targetCity.id,
              },
            },
          }),
        ]);

        revalidatePath(`/${freshCommunity.city.slug}/communities/${freshCommunity.slug}`);
        revalidatePath(`/${freshCommunity.city.slug}/communities`);
        revalidatePath(`/${targetCity.slug}/communities/${freshCommunity.slug}`);
        revalidatePath(`/${targetCity.slug}/communities`);
        revalidateTag('city-feed', 'max');
      } else {
        await db.community.update({
          where: { id: freshCommunity.id },
          data: {
            metadata: {
              ...metadata,
              cityChangeRequest: request,
            },
          },
        });

        revalidatePath('/admin/claims');
      }

      revalidatePath('/organizer/profile');

      return {
        success: true,
        message: shouldAutoApprove
          ? `City updated to ${targetCity.name}.`
          : `City-change request sent for admin review (${freshCommunity.city.name} → ${targetCity.name}).`,
      } as CityChangeRequestResult;
    },
    () => ({ success: false, errors: { _: ['Failed to submit request. Please try again.'] } }),
  );
}
