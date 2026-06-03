'use server';

import { db } from '@/lib/db';
import { withAction } from '@/lib/api/handlers';
import { claimCommunitySchema } from '@/lib/validation';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';
import { headers } from 'next/headers';
import { checkRateLimit, reportLimiter } from '@/lib/rate-limit';
import { sendCollaboratorRequestReceivedEmail } from '@/lib/email';
import { z } from 'zod';

export type ClaimResult =
  | { success: true }
  | { success: false; errors: Record<string, string[]> }
  | null;

export type AccessRequestResult =
  | { success: true }
  | { success: false; errors: Record<string, string[]> }
  | null;

const collaboratorAccessRequestSchema = z.object({
  communityId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(2).max(120),
  relationship: z.string().min(2).max(100),
  message: z.string().max(500).optional().or(z.literal('')),
});

export async function claimCommunity(_prev: ClaimResult, formData: FormData): Promise<ClaimResult> {
  const noticePolicyVersion = '2026-05-v1';
  const noticeRecordedAt = new Date().toISOString();
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(reportLimiter, ip).allowed) {
    return {
      success: false,
      errors: { communityId: ['Too many requests. Please try again later.'] },
    };
  }

  const evidenceLinksJson = (formData.get('evidenceLinksJson') as string) || '[]';
  let parsedEvidenceLinks: Array<{ type: string; url: string }> = [];
  try {
    const rawEvidence = JSON.parse(evidenceLinksJson) as unknown;
    parsedEvidenceLinks = Array.isArray(rawEvidence)
      ? (rawEvidence as Array<{ type: string; url: string }>)
      : [];
  } catch {
    parsedEvidenceLinks = [];
  }

  const whatsappUrl = (formData.get('whatsappUrl') as string) || '';
  const telegramUrl = (formData.get('telegramUrl') as string) || '';
  const socialUrl = (formData.get('socialUrl') as string) || '';

  const raw = {
    communityId: formData.get('communityId') as string,
    email: formData.get('email') as string,
    name: formData.get('name') as string,
    relationship: formData.get('relationship') as string,
    message: (formData.get('message') as string) || '',
    evidenceLinks: parsedEvidenceLinks,
    whatsappUrl,
    telegramUrl,
    socialUrl,
  };

  const parsed = claimCommunitySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;
  const evidenceLinks =
    data.evidenceLinks.length > 0
      ? data.evidenceLinks
      : ([
          whatsappUrl ? { type: 'WHATSAPP', url: whatsappUrl } : null,
          telegramUrl ? { type: 'TELEGRAM', url: telegramUrl } : null,
          socialUrl ? { type: 'OTHER', url: socialUrl } : null,
        ].filter(Boolean) as Array<{ type: string; url: string }>);

  return withAction(
    async () => {
      // Verify community exists and is claimable
      const community = await db.community.findUnique({
        where: { id: data.communityId },
        select: { id: true, claimState: true, metadata: true },
      });

      if (!community) {
        return { success: false, errors: { communityId: ['Community not found'] } };
      }

      if (community.claimState !== 'UNCLAIMED') {
        return {
          success: false,
          errors: { communityId: ['This community already has a pending or approved claim'] },
        };
      }

      // Find or create user
      let user = await db.user.findUnique({ where: { email: data.email } });
      if (!user) {
        user = await db.user.create({
          data: {
            email: data.email,
            displayName: data.name,
            role: 'USER',
          },
        });
      }

      // Update community claim state - merge into existing metadata to avoid overwriting submission data
      const existingMetadata = (community.metadata ?? {}) as Record<string, unknown>;
      await db.community.update({
        where: { id: data.communityId },
        data: {
          claimState: 'CLAIM_PENDING',
          claimedByUserId: user.id,
          metadata: {
            ...existingMetadata,
            claimRequest: {
              relationship: data.relationship,
              message: data.message,
              evidenceLinks,
              whatsappUrl: data.whatsappUrl || undefined,
              telegramUrl: data.telegramUrl || undefined,
              socialUrl: data.socialUrl || undefined,
              requestedAt: new Date().toISOString(),
              notice: {
                policyVersion: noticePolicyVersion,
                source: 'claim_form',
                recordedAt: noticeRecordedAt,
              },
            },
          },
        },
      });

      // Record trust signal
      await db.trustSignal.create({
        data: {
          entityType: 'COMMUNITY',
          communityId: data.communityId,
          signalType: 'COMMUNITY_CLAIMED',
          createdBy: user.id,
        },
      });

      await captureServerEvent(user.id, Events.CLAIM_SUBMITTED, {
        community_id: data.communityId,
        relationship: data.relationship,
      });

      return { success: true } as ClaimResult;
    },
    () => ({ success: false, errors: { _: ['Something went wrong. Please try again.'] } }),
  );
}

export async function requestCollaboratorAccess(
  _prev: AccessRequestResult,
  formData: FormData,
): Promise<AccessRequestResult> {
  const noticePolicyVersion = '2026-05-v1';
  const noticeRecordedAt = new Date().toISOString();
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(reportLimiter, ip).allowed) {
    return {
      success: false,
      errors: { communityId: ['Too many requests. Please try again later.'] },
    };
  }

  const raw = {
    communityId: formData.get('communityId') as string,
    email: ((formData.get('email') as string) || '').trim().toLowerCase(),
    name: (formData.get('name') as string) || '',
    relationship: (formData.get('relationship') as string) || '',
    message: ((formData.get('message') as string) || '').trim(),
  };

  const parsed = collaboratorAccessRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  return withAction(
    async () => {
      const community = await db.community.findUnique({
        where: { id: data.communityId },
        select: {
          id: true,
          claimState: true,
          name: true,
          claimedBy: { select: { email: true } },
        },
      });

      if (!community) {
        return { success: false, errors: { communityId: ['Community not found'] } };
      }

      if (community.claimState !== 'CLAIMED') {
        return {
          success: false,
          errors: { communityId: ['This community is not claimed yet. Use claim flow instead.'] },
        };
      }

      let user = await db.user.findUnique({ where: { email: data.email } });
      if (!user) {
        user = await db.user.create({
          data: {
            email: data.email,
            displayName: data.name,
            role: 'USER',
          },
        });
      }

      const existing = await db.communityCollaborator.findUnique({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId: user.id,
          },
        },
        select: { status: true },
      });

      if (existing?.status === 'ACTIVE' || existing?.status === 'PENDING') {
        return { success: true } as AccessRequestResult;
      }

      await db.communityCollaborator.upsert({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId: user.id,
          },
        },
        update: {
          status: 'PENDING',
          source: 'PUBLIC_REQUEST',
          requestedEmail: data.email,
          requestedByUserId: user.id,
          reviewedAt: null,
          reviewedByUserId: null,
          metadata: {
            relationship: data.relationship,
            message: data.message,
            requestedAt: new Date().toISOString(),
            notice: {
              policyVersion: noticePolicyVersion,
              source: 'collaborator_request_form',
              recordedAt: noticeRecordedAt,
            },
          },
        },
        create: {
          communityId: community.id,
          userId: user.id,
          status: 'PENDING',
          source: 'PUBLIC_REQUEST',
          requestedEmail: data.email,
          requestedByUserId: user.id,
          metadata: {
            relationship: data.relationship,
            message: data.message,
            requestedAt: new Date().toISOString(),
            notice: {
              policyVersion: noticePolicyVersion,
              source: 'collaborator_request_form',
              recordedAt: noticeRecordedAt,
            },
          },
        },
      });

      // Notify the primary community owner so they can approve or reject
      // the request directly from their organizer workspace.
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';
      const reviewUrl = `${appUrl}/organizer/collaborators`;
      if (community.claimedBy?.email) {
        try {
          await sendCollaboratorRequestReceivedEmail(
            community.claimedBy.email,
            community.name,
            data.name,
            data.email,
            data.relationship,
            reviewUrl,
          );
        } catch {
          // Email is best-effort; do not block the request submission
        }
      }

      return { success: true } as AccessRequestResult;
    },
    () => ({ success: false, errors: { _: ['Something went wrong. Please try again.'] } }),
  );
}
