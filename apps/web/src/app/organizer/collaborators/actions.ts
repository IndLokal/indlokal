'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { withAction } from '@/lib/api/handlers';
import { getCurrentCommunityId, getSessionUser } from '@/lib/session';
import { resolveActiveOrganizerCommunity } from '@/lib/organizer/workspace';

const inviteCollaboratorSchema = z.object({
  email: z.string().email(),
  note: z.string().max(300).optional().or(z.literal('')),
});

export type InviteCollaboratorResult =
  | { success: true }
  | { success: false; errors: Record<string, string[]> }
  | null;

export async function inviteCollaborator(
  _prev: InviteCollaboratorResult,
  formData: FormData,
): Promise<InviteCollaboratorResult> {
  const user = await getSessionUser();
  if (!user || user.claimedCommunities.length === 0) {
    return { success: false, errors: { _: ['Not authenticated'] } };
  }

  const currentId = await getCurrentCommunityId();
  const community = resolveActiveOrganizerCommunity(user.claimedCommunities, currentId);

  if (!community) {
    return { success: false, errors: { _: ['No active community found.'] } };
  }

  const raw = {
    email: ((formData.get('email') as string) || '').trim().toLowerCase(),
    note: ((formData.get('note') as string) || '').trim(),
  };

  const parsed = inviteCollaboratorSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  return withAction(
    async () => {
      let target = await db.user.findUnique({ where: { email: data.email } });
      if (!target) {
        target = await db.user.create({
          data: {
            email: data.email,
            role: 'USER',
          },
        });
      }

      if (target.id === user.id) {
        return {
          success: false,
          errors: { email: ['You are already part of this community.'] },
        } as InviteCollaboratorResult;
      }

      const existing = await db.communityCollaborator.findUnique({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId: target.id,
          },
        },
        select: { status: true },
      });

      if (existing?.status === 'ACTIVE' || existing?.status === 'PENDING') {
        return { success: true } as InviteCollaboratorResult;
      }

      await db.communityCollaborator.upsert({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId: target.id,
          },
        },
        update: {
          status: 'PENDING',
          source: 'OWNER_INVITE',
          requestedByUserId: user.id,
          requestedEmail: data.email,
          reviewedAt: null,
          reviewedByUserId: null,
          metadata: {
            note: data.note,
            invitedAt: new Date().toISOString(),
          },
        },
        create: {
          communityId: community.id,
          userId: target.id,
          status: 'PENDING',
          source: 'OWNER_INVITE',
          requestedByUserId: user.id,
          requestedEmail: data.email,
          metadata: {
            note: data.note,
            invitedAt: new Date().toISOString(),
          },
        },
      });

      revalidatePath('/organizer');
      revalidatePath('/organizer/collaborators');

      return { success: true } as InviteCollaboratorResult;
    },
    () => ({ success: false, errors: { _: ['Something went wrong. Please try again.'] } }),
  );
}
