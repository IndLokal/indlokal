'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { withAction } from '@/lib/api/handlers';
import { getCurrentCommunityId, getSessionUser } from '@/lib/session';
import { resolveActiveOrganizerCommunity } from '@/lib/organizer/workspace';
import {
  canManageCommunity,
  getCommunityRole,
  isCommunityOwner,
} from '@/lib/auth/community-permissions';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';

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

  // ADR-0008: inviting requires OWNER (organizer) authority, checked on the
  // backend against CommunityCollaborator (not the workspace cookie).
  if (!canManageCommunity(user, community.id)) {
    return {
      success: false,
      errors: { _: ['Only the community organizer can invite collaborators.'] },
    };
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
          source: 'COMMUNITY_ADMIN_INVITE',
          role: 'COLLABORATOR',
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
          source: 'COMMUNITY_ADMIN_INVITE',
          role: 'COLLABORATOR',
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

// ─────────────────────────────────────────────────────────────────────────────
// Governance actions (ADR-0008 / TDD-0036): collaborator removal and ownership
// transfer. Authority is checked on the backend against CommunityCollaborator
// (never User.role or the workspace cookie) and every change is audited via
// ContentLog(ROLE_GRANTED | ROLE_REVOKED).
// ─────────────────────────────────────────────────────────────────────────────

export type CollaboratorMutationResult =
  | { success: true }
  | { success: false; error: string }
  | null;

const removeSchema = z.object({
  collaboratorId: z.string().min(1),
});

const transferSchema = z.object({
  targetUserId: z.string().min(1),
});

async function resolveActiveCommunityId(): Promise<{ userId: string; communityId: string } | null> {
  const user = await getSessionUser();
  if (!user || user.claimedCommunities.length === 0) return null;
  const currentId = await getCurrentCommunityId();
  const community = resolveActiveOrganizerCommunity(user.claimedCommunities, currentId);
  if (!community) return null;
  return { userId: user.id, communityId: community.id };
}

/** Remove a collaborator. OWNER only; the OWNER cannot be removed. */
export async function removeCollaborator(
  _prev: CollaboratorMutationResult,
  formData: FormData,
): Promise<CollaboratorMutationResult> {
  const user = await getSessionUser();
  const ctx = await resolveActiveCommunityId();
  if (!user || !ctx) return { success: false, error: 'Not authenticated' };

  if (!canManageCommunity(user, ctx.communityId)) {
    return { success: false, error: 'Only the organizer can remove collaborators.' };
  }

  const parsed = removeSchema.safeParse({ collaboratorId: formData.get('collaboratorId') });
  if (!parsed.success) return { success: false, error: 'Invalid input.' };

  return withAction(
    async () => {
      const member = await db.communityCollaborator.findUnique({
        where: { id: parsed.data.collaboratorId },
        select: { id: true, communityId: true, userId: true, role: true },
      });
      if (!member || member.communityId !== ctx.communityId) {
        return { success: false, error: 'Collaborator not found.' } as CollaboratorMutationResult;
      }
      if (member.role === 'COMMUNITY_ADMIN') {
        return {
          success: false,
          error: 'The owner cannot be removed. Transfer ownership first.',
        } as CollaboratorMutationResult;
      }

      await db.$transaction([
        db.communityCollaborator.update({
          where: { id: member.id },
          data: {
            status: 'REMOVED',
            reviewedAt: new Date(),
            reviewedByUserId: user.id,
          },
        }),
        db.contentLog.create({
          data: {
            entityType: 'community',
            entityId: ctx.communityId,
            action: 'ROLE_REVOKED',
            changedBy: user.id,
            metadata: {
              targetUserId: member.userId,
              fromRole: member.role,
              toRole: null,
              actorRole: getCommunityRole(user, ctx.communityId),
            },
          },
        }),
      ]);

      await captureServerEvent(user.id, Events.COMMUNITY_ROLE_CHANGED, {
        community_id: ctx.communityId,
        target_user_id: member.userId,
        from_role: member.role,
        to_role: null,
      });

      revalidatePath('/organizer');
      revalidatePath('/organizer/collaborators');
      return { success: true } as CollaboratorMutationResult;
    },
    () => ({ success: false, error: 'Something went wrong. Please try again.' }),
  );
}

/**
 * Transfer ownership to an existing ACTIVE member. OWNER only. Atomically
 * demotes the current owner to COLLABORATOR, promotes the target to OWNER, and
 * keeps Community.claimedByUserId in sync with the single OWNER row.
 */
export async function transferOwnership(
  _prev: CollaboratorMutationResult,
  formData: FormData,
): Promise<CollaboratorMutationResult> {
  const user = await getSessionUser();
  const ctx = await resolveActiveCommunityId();
  if (!user || !ctx) return { success: false, error: 'Not authenticated' };

  if (!isCommunityOwner(user, ctx.communityId)) {
    return { success: false, error: 'Only the owner can transfer ownership.' };
  }

  const parsed = transferSchema.safeParse({ targetUserId: formData.get('targetUserId') });
  if (!parsed.success) return { success: false, error: 'Invalid input.' };
  if (parsed.data.targetUserId === user.id) {
    return { success: false, error: 'You already own this community.' };
  }

  return withAction(
    async () => {
      const result = await db.$transaction(async (tx) => {
        const target = await tx.communityCollaborator.findUnique({
          where: {
            communityId_userId: {
              communityId: ctx.communityId,
              userId: parsed.data.targetUserId,
            },
          },
          select: { id: true, status: true, role: true },
        });
        if (!target || target.status !== 'ACTIVE') {
          return { ok: false as const, error: 'New owner must be an active member.' };
        }

        // Demote every current OWNER row to COLLABORATOR (there should be exactly one).
        await tx.communityCollaborator.updateMany({
          where: { communityId: ctx.communityId, role: 'COMMUNITY_ADMIN' },
          data: { role: 'COLLABORATOR' },
        });

        // Promote the target to OWNER.
        await tx.communityCollaborator.update({
          where: { id: target.id },
          data: { role: 'COMMUNITY_ADMIN', status: 'ACTIVE' },
        });

        // Keep the denormalized pointer in sync (ADR-0008 invariant).
        await tx.community.update({
          where: { id: ctx.communityId },
          data: { claimedByUserId: parsed.data.targetUserId },
        });

        await tx.contentLog.create({
          data: {
            entityType: 'community',
            entityId: ctx.communityId,
            action: 'ROLE_REVOKED',
            changedBy: user.id,
            metadata: {
              targetUserId: user.id,
              fromRole: 'COMMUNITY_ADMIN',
              toRole: 'COLLABORATOR',
            },
          },
        });
        await tx.contentLog.create({
          data: {
            entityType: 'community',
            entityId: ctx.communityId,
            action: 'ROLE_GRANTED',
            changedBy: user.id,
            metadata: {
              targetUserId: parsed.data.targetUserId,
              fromRole: target.role,
              toRole: 'COMMUNITY_ADMIN',
            },
          },
        });

        return { ok: true as const };
      });

      if (!result.ok) {
        return { success: false, error: result.error } as CollaboratorMutationResult;
      }

      await captureServerEvent(user.id, Events.COMMUNITY_ROLE_CHANGED, {
        community_id: ctx.communityId,
        target_user_id: parsed.data.targetUserId,
        from_role: 'COLLABORATOR',
        to_role: 'COMMUNITY_ADMIN',
      });

      revalidatePath('/organizer');
      revalidatePath('/organizer/collaborators');
      return { success: true } as CollaboratorMutationResult;
    },
    () => ({ success: false, error: 'Something went wrong. Please try again.' }),
  );
}
